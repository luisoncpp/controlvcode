use crate::project_root;

use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use crate::IGNORED_DIRS;
use serde::Serialize;
use regex::Regex;

#[derive(Serialize, Debug, PartialEq)]
pub struct GrepMatch {
    pub file: String,
    pub line: usize,
    pub content: String,
}

// ── Helpers puras (sin estado global) ──────────────────────────────────

/// Convierte un patrón glob simple (*, ?) a una expresión regular.
pub(crate) fn glob_to_regex(glob: &str) -> Regex {
    let escaped = regex::escape(glob);
    let pattern = escaped
        .replace(r"\*", ".*")
        .replace(r"\?", ".");
    Regex::new(&format!("^{}$", pattern)).unwrap_or_else(|_| Regex::new(".*").unwrap())
}

/// Verifica si una ruta relativa pertenece a un directorio ignorado.
pub(crate) fn is_ignored_path(relative: &str) -> bool {
    let name = relative.to_lowercase();
    IGNORED_DIRS.iter().any(|d| {
        name.starts_with(&format!("{}/", d))
            || name.starts_with(&format!("{}\\", d))
            || name.contains(&format!("/{}/", d))
            || name.contains(&format!("\\{}\\", d))
    })
}

/// Verifica si una extensión de archivo corresponde a un binario no textual.
pub(crate) fn is_binary_extension(ext: &str) -> bool {
    matches!(
        ext,
        "exe" | "dll" | "so" | "bin" | "png" | "jpg" | "jpeg" | "gif"
        | "ico" | "pdf" | "zip" | "tar" | "gz" | "wasm"
    )
}

// ── Lógica de búsqueda (testeable, recibe root explícito) ──────────────

pub fn search_files_with_regex(
    root: &Path,
    search_path: &Path,
    pattern: &str,
    glob: Option<&str>,
    ignore_case: bool,
) -> Result<Vec<GrepMatch>, String> {
    if !search_path.exists() {
        return Err(format!("La ruta '{}' no existe.", search_path.display()));
    }

    let mut regex_builder = regex::RegexBuilder::new(pattern);
    regex_builder.case_insensitive(ignore_case);
    regex_builder.multi_line(true);
    let regex = regex_builder
        .build()
        .map_err(|e| format!("Regex inválido: {}", e))?;

    let mut results = Vec::new();
    let max_results = 100;

    // Determinar si es un archivo individual o un directorio
    let walker: Box<dyn Iterator<Item = walkdir::DirEntry>> = if search_path.is_file() {
        Box::new(
            WalkDir::new(search_path.parent().unwrap_or(search_path))
                .min_depth(1)
                .max_depth(1)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(move |e| e.path() == search_path),
        )
    } else {
        Box::new(
            WalkDir::new(search_path)
                .min_depth(1)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let relative = e.path().strip_prefix(root).unwrap_or(e.path());
                    !is_ignored_path(&relative.to_string_lossy())
                }),
        )
    };

    for entry in walker {
        if results.len() >= max_results {
            break;
        }

        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }

        // Filtro glob
        if let Some(glob_pattern) = glob {
            let entry_name = entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            let glob_regex = glob_to_regex(glob_pattern);
            if !glob_regex.is_match(entry_name) {
                continue;
            }
        }

        // Filtro de binarios
        if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
            if is_binary_extension(&ext.to_lowercase()) {
                continue;
            }
        }

        let content = fs::read_to_string(entry_path)
            .map_err(|e| format!("Error leyendo {:?}: {}", entry_path, e))?;

        let relative = entry_path.strip_prefix(root).unwrap_or(entry_path);
        // Normalizar separadores a '/' para consistencia entre SOs
        let file_path = relative.to_string_lossy().replace('\\', "/");

        for (line_num, line_content) in content.lines().enumerate() {
            if regex.is_match(line_content) {
                results.push(GrepMatch {
                    file: file_path.clone(),
                    line: line_num + 1,
                    content: line_content.to_string(),
                });
            }
        }
    }

    Ok(results)
}

// ── Comando Tauri (fachada) ──────────────────────────────────────────

#[tauri::command]
pub fn grep_in_files(
    path: String,
    pattern: String,
    glob: Option<String>,
    ignore_case: bool,
) -> Result<Vec<GrepMatch>, String> {
    let root = project_root();
    let search_path = root.join(&path);
    search_files_with_regex(&root, &search_path, &pattern, glob.as_deref(), ignore_case)
}
