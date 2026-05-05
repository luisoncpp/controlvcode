
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

use crate::project::{project_root, IGNORED_DIRS};

#[tauri::command]
pub fn search_files(query: String) -> Result<Vec<String>, String> {
    let root = project_root();
    let query_lower = query.to_lowercase();
    let max_results = 20;

    let mut results = Vec::new();

    for entry in WalkDir::new(&root).min_depth(1).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let relative = path.strip_prefix(&root).unwrap_or(path);
        let name = relative.to_string_lossy().to_lowercase();

        if is_ignored_dir(&name) {
            continue;
        }

        if name.contains(&query_lower) {
            results.push(relative.to_string_lossy().to_string());
        }

        if results.len() >= max_results {
            break;
        }
    }

    Ok(results)
}

fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIRS
        .iter()
        .any(|d| name.starts_with(&format!("{}/", d)) || name.starts_with(&format!("{}\\", d)))
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    let file_path = project_root().join(&path);
    if !file_path.exists() {
        return Err(format!("El archivo '{}' no existe.", path));
    }
    fs::read_to_string(&file_path).map_err(|e| format!("Error leyendo {}: {}", path, e))
}

#[tauri::command]
pub fn read_file_with_line_numbers(
    path: String,
    start_line: Option<usize>,
    end_line: Option<usize>,
) -> Result<String, String> {
    let file_path = resolve_existing_file(&path)?;
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Error leyendo {}: {}", path, e))?;

    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();
    if total == 0 {
        return Ok(String::new());
    }

    let start = start_line.unwrap_or(1);
    let end = end_line.unwrap_or(total);

    validate_line_range(start, end, total)?;

    let selected: Vec<&str> = lines[start - 1..end].to_vec();
    Ok(selected.join("\n"))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<crate::shell::ExecutionResult, String> {
    let file_path = project_root().join(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    Ok(crate::shell::ExecutionResult {
        stdout: format!("Archivo '{}' escrito exitosamente.", path),
        stderr: String::new(),
        exit_code: 0,
    })
}

fn resolve_existing_file(path: &str) -> Result<PathBuf, String> {
    let file_path = project_root().join(path);
    if !file_path.exists() {
        return Err(format!("El archivo '{}' no existe.", path));
    }
    Ok(file_path)
}

fn validate_line_range(start: usize, end: usize, total: usize) -> Result<(), String> {
    if start == 0 || start > total {
        return Err(format!("Línea inicial {} fuera de rango (1-{}).", start, total));
    }
    if end < start || end > total {
        return Err(format!("Línea final {} fuera de rango ({} - {}).", end, start, total));
    }
    Ok(())
}
