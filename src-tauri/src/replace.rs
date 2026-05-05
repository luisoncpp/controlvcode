
use std::fs;
use serde::Serialize;

use crate::project::project_root;

#[derive(Serialize, Debug)]
pub struct ReplaceResult {
    pub replaced: usize,
}

struct NormalizedTexts {
    content: String,
    search: String,
    replacement: String,
    has_crlf: bool,
}

// 4 params: contrato Tauri — no agrupar para no romper invoke() del frontend
#[tauri::command]
pub fn replace_in_file(
    path: String,
    old_str: String,
    new_str: String,
    all: bool,
) -> Result<ReplaceResult, String> {
    let target_path = project_root().join(&path);
    if !target_path.exists() {
        return Err(format!("El archivo \"{}\" no existe.", path));
    }

    let original = fs::read_to_string(&target_path)
        .map_err(|e| format!("Error leyendo {}: {}", path, e))?;

    let normalized = normalize_line_endings(&original, &old_str, &new_str);
    if !normalized.content.contains(&normalized.search) {
        return Err(format!("No se encontró el texto a reemplazar en \"{}\": {}", path, old_str));
    }

    let (updated, count) = perform_replace(&normalized, all);

    let final_content = restore_line_endings(&updated, normalized.has_crlf);
    fs::write(&target_path, &final_content)
        .map_err(|e| format!("Error escribiendo {}: {}", path, e))?;

    Ok(ReplaceResult { replaced: count })
}

fn normalize_line_endings(content: &str, search: &str, replacement: &str) -> NormalizedTexts {
    let has_crlf = content.contains("\r\n");
    NormalizedTexts {
        content: content.replace("\r\n", "\n"),
        search: search.replace("\r\n", "\n"),
        replacement: replacement.replace("\r\n", "\n"),
        has_crlf,
    }
}

fn perform_replace(normalized: &NormalizedTexts, replace_all: bool) -> (String, usize) {
    let count = if replace_all {
        normalized.content.matches(&normalized.search).count()
    } else {
        1
    };

    let updated = if replace_all {
        normalized.content.replace(&normalized.search, &normalized.replacement)
    } else {
        normalized.content.replacen(&normalized.search, &normalized.replacement, 1)
    };

    (updated, count)
}

fn restore_line_endings(content: &str, has_crlf: bool) -> String {
    if has_crlf {
        content.replace("\n", "\r\n")
    } else {
        content.to_string()
    }
}
