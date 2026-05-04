use crate::project_root;

use std::fs;
use walkdir::WalkDir;
use crate::{IGNORED_DIRS};
use serde::Serialize;
use regex::Regex;

#[derive(Serialize)]
pub struct GrepMatch {
    pub file: String,
    pub line: usize,
    pub content: String,
}

fn glob_to_regex(glob: &str) -> Regex {
    let escaped = regex::escape(glob);
    let pattern = escaped
        .replace(r"\*", ".*")
        .replace(r"\?", ".");
    Regex::new(&format!("^{}$", pattern)).unwrap_or_else(|_| Regex::new(".*").unwrap())
}

#[tauri::command]
pub fn grep_in_files(
    path: String,
    pattern: String,
    glob: Option<String>,
    ignore_case: bool,
) -> Result<Vec<GrepMatch>, String> {
    let root = project_root();
    let search_path = root.join(&path);
    
    if !search_path.exists() {
        return Err(format!("La ruta '{}' no existe.", path));
    }

    let mut regex_builder = regex::RegexBuilder::new(&pattern);
    regex_builder.case_insensitive(ignore_case);
    regex_builder.multi_line(true);
    let regex = regex_builder.build()
        .map_err(|e| format!("Regex inválido: {}", e))?;

    let mut results = Vec::new();
    let max_results = 100;

    let walker = if search_path.is_file() {
        WalkDir::new(search_path.parent().unwrap_or(&search_path))
            .min_depth(1)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path() == search_path)
            .collect::<Vec<_>>()
            .into_iter()
    } else {
        WalkDir::new(&search_path)
            .min_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let relative = e.path().strip_prefix(&root).unwrap_or(e.path());
                let name = relative.to_string_lossy().to_lowercase();
                !IGNORED_DIRS.iter().any(|d| {
                    name.starts_with(&format!("{}/", d)) 
                    || name.starts_with(&format!("{}\\", d))
                    || name.contains(&format!("/{}/", d))
                    || name.contains(&format!("\\{}\\", d))
                })
            })
            .collect::<Vec<_>>()
            .into_iter()
    };

    for entry in walker {
        if results.len() >= max_results {
            break;
        }

        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }

        if let Some(ref glob_pattern) = glob {
            let entry_name = entry_path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            let glob_regex = glob_to_regex(glob_pattern);
            if !glob_regex.is_match(entry_name) {
                continue;
            }
        }

        if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if matches!(ext_lower.as_str(), "exe" | "dll" | "so" | "bin" | "png" | "jpg" | "jpeg" | "gif" | "ico" | "pdf" | "zip" | "tar" | "gz" | "wasm") {
                continue;
            }
        }

        let content = fs::read_to_string(entry_path)
            .map_err(|e| format!("Error leyendo {:?}: {}", entry_path, e))?;
        
        let relative = entry_path.strip_prefix(&root).unwrap_or(entry_path);
        
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
