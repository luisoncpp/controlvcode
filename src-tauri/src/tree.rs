
use std::fs;
use std::fmt::Write;
use std::path::Path;

use crate::project::{project_root, IGNORED_DIRS};
use crate::shell::ExecutionResult;

struct TreeIndent<'a> {
    prefix: &'a str,
    connector: &'a str,
    child_prefix: &'a str,
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<ExecutionResult, String> {
    let dir_path = project_root().join(&path);
    if !dir_path.exists() {
        return Err(format!("La ruta '{}' no existe.", path));
    }
    if !dir_path.is_dir() {
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

fn build_tree(dir: &Path, prefix: &str, output: &mut String) -> std::io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }

    let mut entries = collect_filtered_entries(dir)?;
    entries.sort_by_key(|e| e.file_name());

    let count = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        let is_last = i == count - 1;
        let indent = TreeIndent {
            prefix,
            connector: if is_last { "└── " } else { "├── " },
            child_prefix: if is_last { " " } else { "│ " },
        };
        append_entry(entry, &indent, output)?;
    }

    Ok(())
}

fn collect_filtered_entries(dir: &Path) -> std::io::Result<Vec<fs::DirEntry>> {
    let entries: Vec<_> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            !IGNORED_DIRS.contains(&name.as_str())
        })
        .collect();
    Ok(entries)
}

fn append_entry(
    entry: &fs::DirEntry,
    indent: &TreeIndent,
    output: &mut String,
) -> std::io::Result<()> {
    let path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();

    if path.is_dir() {
        let _ = writeln!(output, "{}{}{}/", indent.prefix, indent.connector, name);
        build_tree(&path, &format!("{}{}", indent.prefix, indent.child_prefix), output)?;
    } else {
        let _ = writeln!(output, "{}{}{}", indent.prefix, indent.connector, name);
    }

    Ok(())
}
