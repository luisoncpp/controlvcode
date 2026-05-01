use std::process::Command;
use serde::Serialize;

#[derive(Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    // Le indicamos a Rust que envíe esto como "exitCode" para que TypeScript lo entienda
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

#[tauri::command]
fn execute_bash_command(command: &str) -> Result<ExecutionResult, String> {
    // Truco: chcp 65001 >nul cambia la consola a UTF-8 silenciosamente antes de tu comando
    let full_command = format!("chcp 65001 >nul & {}", command);

    let output = Command::new("cmd")
        .arg("/C")
        .arg(&full_command)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(ExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_bash_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}