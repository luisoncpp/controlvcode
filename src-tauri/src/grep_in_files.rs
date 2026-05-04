use crate::project_root;

use std::fs;
use std::path::{Path, PathBuf};
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

pub(crate) fn glob_to_regex(glob: &str) -> Regex {
    let escaped = regex::escape(glob);
    let pattern = escaped
        .replace(r"\*", ".*")
        .replace(r"\?", ".");
    Regex::new(&format!("^{}$", pattern)).unwrap_or_else(|_| Regex::new(".*").unwrap())
}

pub(crate) fn is_ignored_path(relative: &str) -> bool {
    let name = relative.to_lowercase();
    IGNORED_DIRS.iter().any(|d| {
        name.starts_with(&format!("{}/", d))
            || name.starts_with(&format!("{}\\", d))
            || name.contains(&format!("/{}/", d))
            || name.contains(&format!("\\{}\\", d))
    })
}

pub(crate) fn is_binary_extension(ext: &str) -> bool {
    matches!(
        ext,
        "exe" | "dll" | "so" | "bin" | "png" | "jpg" | "jpeg" | "gif"
        | "ico" | "pdf" | "zip" | "tar" | "gz" | "wasm"
    )
}

fn build_regex(pattern: &str, ignore_case: bool) -> Result<Regex, String> {
    let mut builder = regex::RegexBuilder::new(pattern);
    builder.case_insensitive(ignore_case);
    builder.multi_line(true);
    builder.build().map_err(|e| format!("Regex inválido: {}", e))
}

// ── Configuración de búsqueda (agrupa todos los parámetros) ───────────

pub struct SearchConfig<'a> {
    pub root: &'a Path,
    pub search_path: &'a Path,
    pub pattern: &'a str,
    pub glob: Option<&'a str>,
    pub ignore_case: bool,
}

// ── Estructura con la regex compilada y la raíz ──────────────────────

pub struct GrepSearcher {
    regex: Regex,
    root: PathBuf,
}

impl GrepSearcher {
    pub fn new(root: &Path, pattern: &str, ignore_case: bool) -> Result<Self, String> {
        let regex = build_regex(pattern, ignore_case)?;
        Ok(Self {
            regex,
            root: root.to_path_buf(),
        })
    }

    /// Busca coincidencias de la regex en un solo archivo.
    pub fn find_matches_in_file(&self, entry_path: &Path) -> Result<Vec<GrepMatch>, String> {
        let content = fs::read_to_string(entry_path)
            .map_err(|e| format!("Error leyendo {:?}: {}", entry_path, e))?;

        let relative = entry_path.strip_prefix(&self.root).unwrap_or(entry_path);
        let file_path = relative.to_string_lossy().replace('\\', "/");

        let mut matches = Vec::new();
        for (line_num, line_content) in content.lines().enumerate() {
            if self.regex.is_match(line_content) {
                matches.push(GrepMatch {
                    file: file_path.clone(),
                    line: line_num + 1,
                    content: line_content.to_string(),
                });
            }
        }
        Ok(matches)
    }
}

// ── Caminata del sistema de archivos ────────────────────────────────

fn create_file_walker<'a>(
    root: &'a Path,
    search_path: &'a Path,
) -> Box<dyn Iterator<Item = walkdir::DirEntry> + 'a> {
    if search_path.is_file() {
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
                .filter(move |e| {
                    let relative = e.path().strip_prefix(root).unwrap_or(e.path());
                    !is_ignored_path(&relative.to_string_lossy())
                }),
        )
    }
}

fn should_skip_entry(entry_path: &Path, glob: Option<&str>) -> bool {
    if !entry_path.is_file() {
        return true;
    }

    if let Some(glob_pattern) = glob {
        let entry_name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        let glob_regex = glob_to_regex(glob_pattern);
        if !glob_regex.is_match(entry_name) {
            return true;
        }
    }

    if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
        if is_binary_extension(&ext.to_lowercase()) {
            return true;
        }
    }

    false
}

// ── Orquestador principal ─────────────────────────────────────────

pub fn search_files_with_regex(config: &SearchConfig) -> Result<Vec<GrepMatch>, String> {
    if !config.search_path.exists() {
        return Err(format!(
            "La ruta '{}' no existe.",
            config.search_path.display()
        ));
    }

    let searcher = GrepSearcher::new(config.root, config.pattern, config.ignore_case)?;
    let walker = create_file_walker(config.root, config.search_path);

    let mut results = Vec::new();
    for entry in walker {
        if results.len() >= 100 {
            break;
        }

        let entry_path = entry.path();
        if should_skip_entry(entry_path, config.glob) {
            continue;
        }

        results.extend(searcher.find_matches_in_file(entry_path)?);
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
    search_files_with_regex(&SearchConfig {
        root: &root,
        search_path: &search_path,
        pattern: &pattern,
        glob: glob.as_deref(),
        ignore_case,
    })
}
