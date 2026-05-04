use super::*;
use std::fs;
use tempfile::TempDir;

fn with_temp_project<F: FnOnce()>(test: F) {
    let temp = TempDir::new().unwrap();
    let prev = PROJECT_DIR.lock().unwrap().replace(temp.path().to_path_buf());
    test();
    *PROJECT_DIR.lock().unwrap() = prev;
}

#[test]
fn replaces_first_occurrence_only() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "hola hola hola").unwrap();
        let r = replace_in_file("test.txt".into(), "hola".into(), "adios".into(), false).unwrap();
        assert_eq!(fs::read_to_string(project_root().join("test.txt")).unwrap(), "adios hola hola");
        assert_eq!(r.replaced, 1);
    });
}

#[test]
fn replaces_all_occurrences() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "hola hola hola").unwrap();
        let r = replace_in_file("test.txt".into(), "hola".into(), "adios".into(), true).unwrap();
        assert_eq!(fs::read_to_string(project_root().join("test.txt")).unwrap(), "adios adios adios");
        assert_eq!(r.replaced, 3);
    });
}

#[test]
fn returns_error_when_file_not_found() {
    with_temp_project(|| {
        let e = replace_in_file("no_existe.txt".into(), "a".into(), "b".into(), false).unwrap_err();
        assert!(e.contains("no existe"));
    });
}

#[test]
fn returns_error_when_text_not_found() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "hola mundo").unwrap();
        let e = replace_in_file("test.txt".into(), "adios".into(), "bye".into(), false).unwrap_err();
        assert!(e.contains("No se encontró el texto"));
    });
}

#[test]
fn handles_special_chars() {
    with_temp_project(|| {
        fs::write(project_root().join("test.html"), "<div>viejo</div>\n<div>viejo</div>").unwrap();
        replace_in_file("test.html".into(), "<div>viejo</div>".into(), "<div>nuevo & mejor</div>".into(), true).unwrap();
        assert_eq!(fs::read_to_string(project_root().join("test.html")).unwrap(), "<div>nuevo & mejor</div>\n<div>nuevo & mejor</div>");
    });
}