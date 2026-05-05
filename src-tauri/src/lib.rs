pub mod git_commands;
pub mod grep_in_files;

#[cfg(test)]
mod grep_in_files_test;

#[cfg(test)]
mod replace_in_file_tests;

#[cfg(test)]
mod patch_file_tests;

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

#[derive(Serialize, Debug)]
pub struct ReplaceResult {
    pub replaced: usize,
}

#[derive(Serialize, Debug)]
pub struct PatchResult {
    pub hunks_applied: usize,
    pub lines_added: usize,
    pub lines_removed: usize,
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
    if!new_path.is_dir() {
        return Err(format!("La ruta '{}' no es un directorio válido.", path));
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
    if!file_path.exists() {
        return Err(format!("El archivo '{}' no existe.", path));
    }
    fs::read_to_string(&file_path).map_err(|e| format!("Error leyendo {}: {}", path, e))
}

#[tauri::command]
fn read_file_with_line_numbers(path: String, start_line: Option<usize>, end_line: Option<usize>) -> Result<String, String> {
    let file_path = project_root().join(&path);
    if!file_path.exists() {
        return Err(format!("El archivo '{}' no existe.", path));
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
        return Err(format!("Línea inicial {} fuera de rango (1-{}).", start, total));
    }
    if end < start || end > total {
        return Err(format!("Línea final {} fuera de rango ({} - {}).", end, start, total));
    }
    let selected: Vec<&str> = lines[start-1..end].to_vec();
    Ok(selected.join("\n"))
}

#[tauri::command]
fn replace_in_file(path: String, old_str: String, new_str: String, all: bool) -> Result<ReplaceResult, String> {
    let search_text = old_str;
    let replacement_text = new_str;
    let replace_all_occurrences = all;

    let target_path = project_root().join(&path);
    if!target_path.exists() {
        return Err(format!("El archivo \"{}\" no existe.", path));
    }

    let original_content = fs::read_to_string(&target_path)
      .map_err(|io_error| format!("Error leyendo {}: {}", path, io_error))?;

    // Detect whether the file uses CRLF (Windows) line endings
    let has_crlf = original_content.contains("\r\n");

    // Normalize everything to LF for matching and replacement
    let normalized_content = original_content.replace("\r\n", "\n");
    let normalized_search = search_text.replace("\r\n", "\n");
    let normalized_replacement = replacement_text.replace("\r\n", "\n");

    if!normalized_content.contains(&normalized_search) {
        return Err(format!(
            "No se encontró el texto a reemplazar en \"{}\": {}",
            path, search_text
        ));
    }

    let total_replacements = if replace_all_occurrences {
        normalized_content.matches(&normalized_search).count()
    } else {
        1
    };

    let updated_content = if replace_all_occurrences {
        normalized_content.replace(&normalized_search, &normalized_replacement)
    } else {
        normalized_content.replacen(&normalized_search, &normalized_replacement, 1)
    };

    // Restore the original line ending style
    let final_content = if has_crlf {
        updated_content.replace("\n", "\r\n")
    } else {
        updated_content
    };

    fs::write(&target_path, &final_content)
      .map_err(|io_error| format!("Error escribiendo {}: {}", path, io_error))?;

    Ok(ReplaceResult { replaced: total_replacements })
}

// ── Patch file (unified diff) ─────────────────────────────────────────

struct DiffLine {
    kind: char, // ' ' context, '+' add, '-' remove
    content: String,
}

struct DiffHunk {
    old_start: usize,
    old_count: usize,
    new_start: usize,
    new_count: usize,
    lines: Vec<DiffLine>,
}

fn parse_hunk_header(line: &str) -> Result<(usize, usize, usize, usize), String> {
    let first_at = line.find("@@").ok_or_else(|| "Hunk header malformado: falta @@".to_string())?;
    let second_at = line[first_at + 2..].find("@@").map(|i| i + first_at + 2).ok_or_else(|| "Hunk header malformado: falta @@ de cierre".to_string())?;
    let inner = line[first_at + 2..second_at].trim();

    let mut parts = inner.splitn(2, ' ');
    let old_part = parts.next().ok_or_else(|| "Hunk header malformado".to_string())?.trim_start_matches('-');
    let new_part = parts.next().ok_or_else(|| "Hunk header malformado".to_string())?.trim_start_matches('+');

    let old_nums: Vec<&str> = old_part.split(',').collect();
    let new_nums: Vec<&str> = new_part.split(',').collect();

    let old_start = old_nums.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let old_count = old_nums.get(1).and_then(|s| s.parse().ok()).unwrap_or(1);
    let new_start = new_nums.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let new_count = new_nums.get(1).and_then(|s| s.parse().ok()).unwrap_or(1);

    Ok((old_start, old_count, new_start, new_count))
}

fn parse_unified_diff(text: &str) -> Result<Vec<DiffHunk>, String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut hunks = Vec::new();
    let mut i = 0;

    // Saltar headers (--- a/..., +++ b/...) hasta el primer @@
    while i < lines.len() && !lines[i].starts_with("@@") {
        i += 1;
    }

    while i < lines.len() {
        if !lines[i].starts_with("@@") {
            i += 1;
            continue;
        }

        let (old_start, old_count, new_start, new_count) = parse_hunk_header(lines[i])?;
        i += 1;

        let mut hunk_lines = Vec::new();
        let mut old_read = 0usize;
        let mut new_read = 0usize;

        while i < lines.len() && !lines[i].starts_with("@@") {
            let line = lines[i];

            if line.starts_with('\\') {
                // "\ No newline at end of file" — ignorar
                i += 1;
                continue;
            }

            if line.is_empty() {
                // Linea vacia: si aun quedan lineas por leer, tratar como contexto vacio
                if old_read < old_count || new_read < new_count {
                    hunk_lines.push(DiffLine { kind: ' ', content: String::new() });
                    old_read += 1;
                    new_read += 1;
                    i += 1;
                    continue;
                }
                break;
            }

            let first = line.chars().next().unwrap();
            if first == ' ' || first == '+' || first == '-' {
                hunk_lines.push(DiffLine { kind: first, content: line[1..].to_string() });
                if first == ' ' || first == '-' { old_read += 1; }
                if first == ' ' || first == '+' { new_read += 1; }
                i += 1;
            } else {
                break;
            }
        }

        hunks.push(DiffHunk { old_start, old_count, new_start, new_count, lines: hunk_lines });
    }

    Ok(hunks)
}

fn find_lines(haystack: &[String], needle: &[&str], hint: usize) -> Option<usize> {
    if needle.is_empty() {
        return Some(hint.min(haystack.len()));
    }
    let n = needle.len();
    let search_start = hint.saturating_sub(3);
    let search_end = (hint + 3 + n).min(haystack.len() + 1);

    // Buscar cerca de la posicion esperada (±3 lineas de tolerancia)
    for pos in search_start..=search_end.saturating_sub(n) {
        if pos + n <= haystack.len() {
            let matches = haystack[pos..pos + n].iter()
                .zip(needle.iter())
                .all(|(h, ne)| h.as_str() == *ne);
            if matches { return Some(pos); }
        }
    }

    // Fallback: busqueda lineal en todo el archivo
    for pos in 0..=haystack.len().saturating_sub(n) {
        let matches = haystack[pos..pos + n].iter()
            .zip(needle.iter())
            .all(|(h, ne)| h.as_str() == *ne);
        if matches { return Some(pos); }
    }

    None
}

#[tauri::command]
fn patch_file(path: String, diff_text: String) -> Result<PatchResult, String> {
    let target_path = project_root().join(&path);
    if !target_path.exists() {
        return Err(format!("El archivo \"{}\" no existe.", path));
    }

    let original = fs::read_to_string(&target_path)
        .map_err(|e| format!("Error leyendo {}: {}", path, e))?;
    let original_lines: Vec<&str> = original.lines().collect();
    let ends_with_newline = original.ends_with('\n');

    let hunks = parse_unified_diff(&diff_text)?;
    if hunks.is_empty() {
        return Err("No se encontraron hunks (@@) en el patch.".to_string());
    }

    let mut result_lines: Vec<String> = original_lines.iter().map(|s| s.to_string()).collect();
    let mut offset: i32 = 0;
    let mut stats = PatchResult { hunks_applied: 0, lines_added: 0, lines_removed: 0 };

    for hunk in &hunks {
        // Lado "old" del hunk (contexto + lineas eliminadas)
        let old_side: Vec<&str> = hunk.lines.iter()
            .filter(|l| l.kind == ' ' || l.kind == '-')
            .map(|l| l.content.as_str())
            .collect();

        let expected_pos = hunk.old_start.saturating_sub(1);
        let search_pos = (expected_pos as i32 + offset).max(0) as usize;

        let pos = find_lines(&result_lines, &old_side, search_pos)
            .ok_or_else(|| format!(
                "Hunk @@ -{},{} +{},{} @@: contexto no encontrado cerca de la linea {}.",
                hunk.old_start, hunk.old_count, hunk.new_start, hunk.new_count, expected_pos + 1
            ))?;

        // Lado "new" del hunk (contexto + lineas agregadas)
        let new_side: Vec<String> = hunk.lines.iter()
            .filter(|l| l.kind == ' ' || l.kind == '+')
            .map(|l| l.content.clone())
            .collect();

        let added = hunk.lines.iter().filter(|l| l.kind == '+').count();
        let removed = hunk.lines.iter().filter(|l| l.kind == '-').count();

        let new_count = new_side.len();
        result_lines.splice(pos..pos + old_side.len(), new_side);
        // Reemplazar old_side por new_side en la posicion encontrada
        offset += new_count as i32 - old_side.len() as i32;
        stats.lines_added += added;
        stats.lines_removed += removed;
        stats.hunks_applied += 1;
    }

    let mut new_content = result_lines.join("\n");
    if ends_with_newline {
        new_content.push('\n');
    }

    fs::write(&target_path, &new_content)
        .map_err(|e| format!("Error escribiendo {}: {}", path, e))?;

    Ok(stats)
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
        stdout: format!("Archivo '{}' escrito exitosamente.", path),
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
            let child_prefix = if is_last { " " } else { "│ " };
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
    if!dir_path.exists() {
        return Err(format!("La ruta '{}' no existe.", path));
    }
    if!dir_path.is_dir() {
        return Err(format!("'{}' no es un directorio.", path));
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
            patch_file,
            git_commands::snapshot_create,
            git_commands::snapshot_diff,
            git_commands::snapshot_restore,
            grep_in_files::grep_in_files
        ])
      .run(tauri::generate_context!())
      .expect("error while running tauri application");
}
