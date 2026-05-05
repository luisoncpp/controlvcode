
use std::fs;
use serde::Serialize;

use crate::project::project_root;
use crate::diff_parser::{self, DiffHunk};

#[derive(Serialize, Debug)]
pub struct PatchResult {
    pub hunks_applied: usize,
    pub lines_added: usize,
    pub lines_removed: usize,
}

#[tauri::command]
pub fn patch_file(path: String, diff_text: String) -> Result<PatchResult, String> {
    let target_path = project_root().join(&path);
    if !target_path.exists() {
        return Err(format!("El archivo \"{}\" no existe.", path));
    }

    let original = fs::read_to_string(&target_path)
        .map_err(|e| format!("Error leyendo {}: {}", path, e))?;
    let ends_with_newline = original.ends_with('\n');

    let hunks = diff_parser::parse_unified_diff(&diff_text)?;
    if hunks.is_empty() {
        return Err("No se encontraron hunks (@@) en el patch.".to_string());
    }

    let mut result_lines = lines_to_strings(&original);
    let stats = apply_all_hunks(&mut result_lines, &hunks)?;

    let mut new_content = result_lines.join("\n");
    if ends_with_newline {
        new_content.push('\n');
    }
    fs::write(&target_path, &new_content)
        .map_err(|e| format!("Error escribiendo {}: {}", path, e))?;

    Ok(stats)
}

struct PatchContext {
    offset: i32,
    stats: PatchResult,
}

impl PatchContext {
    fn new() -> Self {
        Self {
            offset: 0,
            stats: PatchResult { hunks_applied: 0, lines_added: 0, lines_removed: 0 },
        }
    }
}

fn apply_all_hunks(
    result_lines: &mut Vec<String>,
    hunks: &[DiffHunk],
) -> Result<PatchResult, String> {
    let mut ctx = PatchContext::new();
    for hunk in hunks {
        apply_hunk(result_lines, hunk, &mut ctx)?;
    }
    Ok(ctx.stats)
}

fn apply_hunk(
    result_lines: &mut Vec<String>,
    hunk: &DiffHunk,
    ctx: &mut PatchContext,
) -> Result<(), String> {
    let old_side: Vec<&str> = hunk.lines.iter()
        .filter(|l| l.kind == ' ' || l.kind == '-')
        .map(|l| l.content.as_str())
        .collect();

    let expected_pos = hunk.old_start.saturating_sub(1);
    let search_pos = (expected_pos as i32 + ctx.offset).max(0) as usize;

    let pos = diff_parser::find_lines(result_lines, &old_side, search_pos).ok_or_else(|| {
        format!(
            "Hunk @@ -{},{} +{},{} @@: contexto no encontrado cerca de la linea {}.",
            hunk.old_start, hunk.old_count, hunk.new_start, hunk.new_count, expected_pos + 1
        )
    })?;

    let new_side: Vec<String> = hunk.lines.iter()
        .filter(|l| l.kind == ' ' || l.kind == '+')
        .map(|l| l.content.clone())
        .collect();

    let added = hunk.lines.iter().filter(|l| l.kind == '+').count();
    let removed = hunk.lines.iter().filter(|l| l.kind == '-').count();

    let new_side_len = new_side.len();
    result_lines.splice(pos..pos + old_side.len(), new_side);
    ctx.offset += new_side_len as i32 - old_side.len() as i32;
    ctx.stats.lines_added += added;
    ctx.stats.lines_removed += removed;
    ctx.stats.hunks_applied += 1;

    Ok(())
}

fn lines_to_strings(content: &str) -> Vec<String> {
    content.lines().map(|s| s.to_string()).collect()
}
