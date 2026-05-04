pub mod git_commands;
pub mod grep_in_files;

#[cfg(test)]
mod grep_in_files_test;

use std::process::Command;
use std::path::{PathBuf, Path};
use std::fs;
use std::fmt::Write;
use std::sync::Mutex;
use serde::Serialize;
use walkdir::WalkDir;

const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    ".vscode",
    "__pycache__",
    ".idea",
    "dist",
    "gen",
];

static PROJECT_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn project_root() -> PathBuf {
    if let Ok(guard) = PROJECT_DIR.lock() {
        if let Some(dir) = guard.as_ref() {
            return dir.clone();
        }
    }
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap_or(Path::new(".")).to_path_buf()
}

#[derive(Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

#[derive(Serialize)]
pub struct ReplaceResult {
    pub replaced: usize,
}

#[derive(Serialize)]
pub struct GrepMatch {
    pub file: String,
    pub line: usize,
    pub content: String,
}

#[tauri::command]
fn get_project_dir() -> String {
    project_root().to_string_lossy().to_string()
}

#[tauri::command]
fn set_project_dir(path: String) -> Result<String, String> {
    let new_path = PathBuf::from(&path);
    if !new_path.is_dir() {
        return Err(format!("La ruta &apos;{}&apos; no es un directorio v&aacute;lido.", path));
    }
    if let Ok(mut guard) = PROJECT_DIR.lock() {
        *guard = Some(new_path.clone());
    }
    Ok(project_root().to_string_lossy().to_string())
}

#[tauri::command]
fn search_files(query: String) -> Result<Vec<String>, String> {
    let root = project_root();
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    for entry in WalkDir::new(&root).min_depth(1).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let relative = path.strip_prefix(&root).unwrap_or(path);
        let name = relative.to_string_lossy().to_lowercase();
        
        if IGNORED_DIRS.iter().any(|d| name.starts_with(&format!("{}/", d)) || name.starts_with(&format!("{}\\", d))) {
            continue;
        }
        
        if name.contains(&query_lower) {
            results.push(relative.to_string_lossy().to_string());
        }
        
        if results.len() >= 20 {
            break;
        }
    }

    Ok(results)
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    let file_path = project_root().join(&path);
    if !file_path.exists() {
        return Err(format!("El archivo &apos;{}&apos; no existe.", path));
    }
    fs::read_to_string(&file_path).map_err(|e| format!("Error leyendo {}: {}", path, e))
}

#[tauri::command]
fn read_file_with_line_numbers(path: String, start_line: Option<usize>, end_line: Option<usize>) -> Result<String, String> {
    let file_path = project_root().join(&path);
    if !file_path.exists() {
        return Err(format!("El archivo &apos;{}&apos; no existe.", path));
    }
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Error leyendo {}: {}", path, e))?;
    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();
    if total == 0 {
        return Ok(String::new());
    }
    let start = start_line.unwrap_or(1);
    let end = end_line.unwrap_or(total);
    if start == 0 || start > total {
        return Err(format!("L&iacute;nea inicial {} fuera de rango (1-{}).", start, total));
    }
    if end < start || end > total {
        return Err(format!("L&iacute;nea final {} fuera de rango ({} - {}).", end, start, total));
    }
    let selected: Vec<&str> = lines[start-1..end].to_vec();
    Ok(selected.join("\n"))
}

#[tauri::command]
fn replace_in_file(path: String, old_str: String, new_str: String, all: bool) -> Result<ReplaceResult, String> {
    let file_path = project_root().join(&path);
    if !file_path.exists() {
        return Err(format!("El archivo \"{}\" no existe.", path));
    }
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Error leyendo {}: {}", path, e))?;
    if !content.contains(&old_str) {
        return Err(format!("No se encontr&oacute; el texto a reemplazar en \"{}\": {}.", path, old_str));
    }
    let replaced = if all {
        content.matches(&old_str).count()
    } else {
        1
    };
    let new_content = if all {
        content.replace(&old_str, &new_str)
    } else {
        content.replacen(&old_str, &new_str, 1)
    };
    fs::write(&file_path, &new_content).map_err(|e| format!("Error escribiendo {}: {}", path, e))?;
    Ok(ReplaceResult { replaced })
}

#[tauri::command]
fn execute_bash_command(command: &str) -> Result<ExecutionResult, String> {
    let full_command = format!("chcp 65001 >nul & {}", command);
    let output = Command::new("cmd")
        .arg("/C")
        .arg(&full_command)
        .current_dir(project_root())
        .output()
        .map_err(|e| e.to_string())?;

    Ok(ExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<ExecutionResult, String> {
    let file_path = project_root().join(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    Ok(ExecutionResult {
        stdout: format!("Archivo &apos;{}&apos; escrito exitosamente.", path),
        stderr: String::new(),
        exit_code: 0,
    })
}

fn build_tree(dir: &Path, prefix: &str, output: &mut String) -> std::io::Result<()> {
    if dir.is_dir() {
        let mut entries: Vec<_> = std::fs::read_dir(dir)?
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_lowercase();
                !IGNORED_DIRS.contains(&name.as_str())
            })
            .collect();
        entries.sort_by_key(|e| e.file_name());
        let count = entries.len();
        for (i, entry) in entries.iter().enumerate() {
            let is_last = i == count - 1;
            let connector = if is_last { "└── " } else { "├── " };
            let child_prefix = if is_last { "    " } else { "│   " };
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                let _ = writeln!(output, "{}{}{}/", prefix, connector, name);
                build_tree(&path, &format!("{}{}", prefix, child_prefix), output)?;
            } else {
                let _ = writeln!(output, "{}{}{}", prefix, connector, name);
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn list_directory(path: String) -> Result<ExecutionResult, String> {
    let dir_path = project_root().join(&path);
    if !dir_path.exists() {
        return Err(format!("La ruta &apos;{}&apos; no existe.", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("&apos;{}&apos; no es un directorio.", path));
    }
    let mut output = String::new();
    let root_name = dir_path.file_name().unwrap_or_default().to_string_lossy();
    writeln!(&mut output, "{}/", root_name).map_err(|e| e.to_string())?;
    build_tree(&dir_path, "", &mut output).map_err(|e| e.to_string())?;
    Ok(ExecutionResult {
        stdout: output,
        stderr: String::new(),
        exit_code: 0,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            execute_bash_command,
            write_file,
            list_directory,
            get_project_dir,
            set_project_dir,
            search_files,
            read_file_content,
            read_file_with_line_numbers,
            replace_in_file,
            git_commands::snapshot_create,
            git_commands::snapshot_diff,
            git_commands::snapshot_restore,
            grep_in_files::grep_in_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
