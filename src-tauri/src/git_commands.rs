use std::process::Command;
use serde::Serialize;

use crate::project_root;

#[derive(Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

#[tauri::command]
pub fn snapshot_create() -> Result<String, String> {
    let output = Command::new("git")
        .args(["stash", "create"])
        .current_dir(project_root())
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let hash = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(hash)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn snapshot_diff(hash: String) -> Result<ExecutionResult, String> {
    // Si el hash está vacío, no debería llamarse; pero si ocurre, comparamos contra HEAD
    let target = if hash.is_empty() { "HEAD".to_string() } else { hash };
    let output = Command::new("git")
        .args(["diff", &target])
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
pub fn snapshot_restore(hash: String, clean_untracked: bool) -> Result<ExecutionResult, String> {
    if hash.is_empty() {
        return Err("No se puede revertir porque el snapshot está vacío (no había cambios)".into());
    }
    let restore = Command::new("git")
        .args(["restore", "--source", &hash, "--", "."])
        .current_dir(project_root())
        .output()
        .map_err(|e| e.to_string())?;

    let mut combined_stdout = String::from_utf8_lossy(&restore.stdout).to_string();
    let mut combined_stderr = String::from_utf8_lossy(&restore.stderr).to_string();
    let mut exit_code = restore.status.code().unwrap_or(-1);

    if clean_untracked && exit_code == 0 {
        let clean = Command::new("git")
            .args(["clean", "-fd"])
            .current_dir(project_root())
            .output()
            .map_err(|e| e.to_string())?;
        combined_stdout.push_str(&String::from_utf8_lossy(&clean.stdout));
        combined_stderr.push_str(&String::from_utf8_lossy(&clean.stderr));
        if exit_code == 0 {
            exit_code = clean.status.code().unwrap_or(-1);
        }
    }

    Ok(ExecutionResult {
        stdout: combined_stdout,
        stderr: combined_stderr,
        exit_code,
    })
}