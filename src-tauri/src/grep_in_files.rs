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

/// Convierte un patrón glob simple (*, ?) a una expresión regular.
fn glob_to_regex(glob: &str) -> Regex {
    let escaped = regex::escape(glob);
    let pattern = escaped
        .replace(r"\*", ".*")
        .replace(r"\?", ".");
    Regex::new(&format!("^{}$", pattern)).unwrap_or_else(|_| Regex::new(".*").unwrap())
}

/// Verifica si una ruta relativa pertenece a un directorio ignorado.
fn is_ignored_path(relative: &str) -> bool {
    let name = relative.to_lowercase();
    IGNORED_DIRS.iter().any(|d| {
        name.starts_with(&format!("{}/", d))
            || name.starts_with(&format!("{}\\", d))
            || name.contains(&format!("/{}/", d))
            || name.contains(&format!("\\{}\\", d))
    })
}

/// Verifica si una extensión de archivo corresponde a un binario no textual.
fn is_binary_extension(ext: &str) -> bool {
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

        for (line_num, line_content) in content.lines().enumerate() {
            if regex.is_match(line_content) {
                results.push(GrepMatch {
                    file: relative.to_string_lossy().to_string(),
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

// ── Tests unitarios ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    // ── Helpers de test ──────────────────────────────────────────

    /// Crea una estructura temporal de archivos y retorna el directorio raíz.
    /// Estructura:
    ///   tmp/
    ///     src/
    ///       main.rs  : "console.log('hello');\nlet x = 1;"
    ///       lib.rs   : "// TODO: fix this\nfn foo() {}"
    ///       image.png: (binario simulado, contenido "PNG...")
    ///     test/
    ///       app.test.ts: "describe('test', () => {\n  console.log('test');\n});"
    ///     .git/
    ///       config: "ignored"
    fn setup_fixture() -> (tempfile::TempDir, PathBuf) {
        let tmp = tempfile::tempdir().expect("Failed to create temp dir");
        let root = tmp.path().to_path_buf();

        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("test")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();

        fs::write(root.join("src/main.rs"), "console.log('hello');\nlet x = 1;\n").unwrap();
        fs::write(root.join("src/lib.rs"), "// TODO: fix this\nfn foo() {}\n").unwrap();
        fs::write(root.join("src/image.png"), b"PNG...").unwrap();
        fs::write(root.join("test/app.test.ts"), "describe('test', () => {\n  console.log('test');\n});\n").unwrap();
        fs::write(root.join(".git/config"), "[core]\nignore = true\n").unwrap();

        (tmp, root)
    }

    // ── Tests unitarios de helpers ──────────────────────────────

    #[test]
    fn test_glob_to_regex_exact() {
        let re = glob_to_regex("*.rs");
        assert!(re.is_match("main.rs"));
        assert!(re.is_match("lib.rs"));
        assert!(!re.is_match("main.ts"));
    }

    #[test]
    fn test_glob_to_regex_question() {
        let re = glob_to_regex("file_?.txt");
        assert!(re.is_match("file_1.txt"));
        assert!(re.is_match("file_a.txt"));
        assert!(!re.is_match("file_12.txt"));
    }

    #[test]
    fn test_is_binary_extension() {
        assert!(is_binary_extension("png"));
        assert!(is_binary_extension("exe"));
        assert!(is_binary_extension("wasm"));
        assert!(!is_binary_extension("rs"));
        assert!(!is_binary_extension("ts"));
        assert!(!is_binary_extension("txt"));
    }

    #[test]
    fn test_is_ignored_path() {
        assert!(is_ignored_path("node_modules/foo"));
        assert!(is_ignored_path(".git/config"));
        assert!(is_ignored_path("target/debug/build"));
        assert!(!is_ignored_path("src/main.rs"));
        assert!(!is_ignored_path("lib.rs"));
    }

    // ── Tests de búsqueda ──────────────────────────────────────

    #[test]
    fn test_search_in_file() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root.join("src/main.rs"),
            "console",
            None,
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "src/main.rs");
        assert_eq!(results[0].line, 1);
        assert_eq!(results[0].content, "console.log('hello');");
    }

    #[test]
    fn test_search_in_directory_recursive() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root.join("src"),
            "console",
            None,
            false,
        )
        .unwrap();
        // Solo main.rs (image.png es binario y se omite)
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "src/main.rs");
    }

    #[test]
    fn test_search_ignores_binaries() {
        let (_tmp, root) = setup_fixture();
        // Buscamos "PNG" que está en image.png, pero debería ignorarse por ser binario
        let results = search_files_with_regex(
            &root,
            &root.join("src"),
            "PNG",
            None,
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_respects_ignored_dirs() {
        let (_tmp, root) = setup_fixture();
        // Buscamos "ignore" que está en .git/config, pero .git está ignorado
        let results = search_files_with_regex(
            &root,
            &root,
            "ignore",
            None,
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_case_insensitive() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root.join("src/lib.rs"),
            "todo",
            None,
            true, // ignore_case
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "// TODO: fix this");
    }

    #[test]
    fn test_search_with_glob_filter() {
        let (_tmp, root) = setup_fixture();
        // Solo archivos .ts
        let results = search_files_with_regex(
            &root,
            &root,
            "console",
            Some("*.ts"),
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "test/app.test.ts");
    }

    #[test]
    fn test_search_with_glob_and_case_insensitive() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root,
            "console",
            Some("*.rs"),
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "src/main.rs");
    }

    #[test]
    fn test_search_nonexistent_path_errors() {
        let (_tmp, root) = setup_fixture();
        let err = search_files_with_regex(
            &root,
            &root.join("nonexistent"),
            "foo",
            None,
            false,
        )
        .unwrap_err();
        assert!(err.contains("no existe"));
    }
}
