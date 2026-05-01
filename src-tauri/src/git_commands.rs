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
pub fn snapshot_restore(hash: String) -> Result<ExecutionResult, String> {
    // Solo restauramos archivos rastreados. Sin git clean para no borrar trabajo previo.
    if hash.is_empty() {
        return Err("No se puede revertir porque el snapshot está vacío (no había cambios)".into());
    }
    let output = Command::new("git")
        .args(["restore", "--source", &hash, "--", "."])
        .current_dir(project_root())
        .output()
        .map_err(|e| e.to_string())?;

    Ok(ExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}