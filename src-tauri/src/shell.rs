
use serde::Serialize;

use crate::process_utils::new_command;
use crate::project::project_root;

#[derive(Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

#[tauri::command]
pub fn execute_bash_command(command: &str) -> Result<ExecutionResult, String> {
    let output = new_command("cmd")
        .arg("/C")
        .arg(command)
        .current_dir(project_root())
        .output()
        .map_err(|e| e.to_string())?;

    Ok(ExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
