
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    ".vscode",
    "__pycache__",
    ".idea",
    "dist",
    "gen",
];

pub(crate) static PROJECT_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn project_root() -> PathBuf {
    if let Ok(guard) = PROJECT_DIR.lock() {
        if let Some(dir) = guard.as_ref() {
            return dir.clone();
        }
    }
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap_or(Path::new(".")).to_path_buf()
}

#[tauri::command]
pub fn get_project_dir() -> String {
    project_root().to_string_lossy().to_string()
}

#[tauri::command]
pub fn set_project_dir(path: String) -> Result<String, String> {
    let new_path = PathBuf::from(&path);
    if !new_path.is_dir() {
        return Err(format!("La ruta '{}' no es un directorio válido.", path));
    }
    if let Ok(mut guard) = PROJECT_DIR.lock() {
        *guard = Some(new_path.clone());
    }
    Ok(project_root().to_string_lossy().to_string())
}
