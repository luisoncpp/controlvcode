
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
extern "system" {
    fn SetConsoleOutputCP(code_page: u32) -> i32;
}

fn main() {
    #[cfg(target_os = "windows")]
    unsafe {
        // Activa UTF-8 una sola vez para todo el proceso.
        // Los hijos de cmd.exe heredan la página de códigos del padre.
        SetConsoleOutputCP(65001);
    }
    controlvcode_lib::run()
}
