
pub mod git_commands;
pub mod grep_in_files;
pub mod process_utils;
pub mod project;
pub mod file_ops;
pub mod replace;
pub mod diff_parser;
pub mod patch;
pub mod tree;
pub mod shell;

// Re-exports: mantienen compatibilidad con tests y módulos existentes
// que usan crate::replace_in_file, crate::GrepMatch, etc.
pub use project::project_root;
pub use replace::{replace_in_file, ReplaceResult};
pub use patch::{patch_file, PatchResult};
pub use shell::ExecutionResult;
pub use project::IGNORED_DIRS;
pub(crate) use project::PROJECT_DIR;

#[derive(serde::Serialize)]
pub struct GrepMatch {
    pub file: String,
    pub line: usize,
    pub content: String,
}

#[cfg(test)]
mod grep_in_files_test;

#[cfg(test)]
mod replace_in_file_tests;

#[cfg(test)]
mod patch_file_tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            shell::execute_bash_command,
            file_ops::write_file,
            tree::list_directory,
            project::get_project_dir,
            project::set_project_dir,
            file_ops::search_files,
            file_ops::read_file_content,
            file_ops::read_file_with_line_numbers,
            replace::replace_in_file,
            patch::patch_file,
            git_commands::snapshot_create,
            git_commands::snapshot_diff,
            git_commands::snapshot_restore,
            grep_in_files::grep_in_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
