
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
fn applies_single_hunk() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "line1\nline2\nline3\n").unwrap();
        let diff = "\
@@ -1,3 +1,3 @@
 line1
-line2
+LINE2
 line3
";
        let r = patch_file("test.txt".into(), diff.into()).unwrap();
        assert_eq!(r.hunks_applied, 1);
        assert_eq!(r.lines_added, 1);
        assert_eq!(r.lines_removed, 1);
        assert_eq!(fs::read_to_string(project_root().join("test.txt")).unwrap(), "line1\nLINE2\nline3\n");
    });
}

#[test]
fn applies_multiple_hunks() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "aaa\nbbb\nccc\nddd\neee\n").unwrap();
        let diff = "\
@@ -1,3 +1,3 @@
 aaa
-bbb
+BBB
 ccc
@@ -3,3 +3,3 @@
 ccc
-ddd
+DDD
 eee
";
        let r = patch_file("test.txt".into(), diff.into()).unwrap();
        assert_eq!(r.hunks_applied, 2);
        assert_eq!(fs::read_to_string(project_root().join("test.txt")).unwrap(), "aaa\nBBB\nccc\nDDD\neee\n");
    });
}

#[test]
fn adds_new_lines() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "line1\nline3\n").unwrap();
        let diff = "\
@@ -1,2 +1,3 @@
 line1
+line2
 line3
";
        let r = patch_file("test.txt".into(), diff.into()).unwrap();
        assert_eq!(r.lines_added, 1);
        assert_eq!(r.lines_removed, 0);
        assert_eq!(fs::read_to_string(project_root().join("test.txt")).unwrap(), "line1\nline2\nline3\n");
    });
}

#[test]
fn removes_lines() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "line1\nline2\nline3\n").unwrap();
        let diff = "\
@@ -1,3 +1,2 @@
 line1
-line2
 line3
";
        let r = patch_file("test.txt".into(), diff.into()).unwrap();
        assert_eq!(r.lines_added, 0);
        assert_eq!(r.lines_removed, 1);
        assert_eq!(fs::read_to_string(project_root().join("test.txt")).unwrap(), "line1\nline3\n");
    });
}

#[test]
fn errors_on_missing_file() {
    with_temp_project(|| {
        let e = patch_file("no_existe.txt".into(), "@@ -1 +1 @@\n-a\n+b\n".into()).unwrap_err();
        assert!(e.contains("no existe"));
    });
}

#[test]
fn errors_on_context_mismatch() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "aaa\nbbb\nccc\n").unwrap();
        let diff = "\
@@ -1,3 +1,3 @@
 xxx
-bbb
+BBB
 ccc
";
        let e = patch_file("test.txt".into(), diff.into()).unwrap_err();
        assert!(e.contains("contexto no encontrado"));
    });
}

#[test]
fn errors_on_no_hunks() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "hello\n").unwrap();
        let e = patch_file("test.txt".into(), "no hay hunks aqui".into()).unwrap_err();
        assert!(e.contains("No se encontraron hunks"));
    });
}

#[test]
fn handles_headers_then_hunks() {
    with_temp_project(|| {
        fs::write(project_root().join("test.txt"), "aaa\nbbb\n").unwrap();
        let diff = "\
--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,2 @@
 aaa
-bbb
+BBB
";
        let r = patch_file("test.txt".into(), diff.into()).unwrap();
        assert_eq!(r.hunks_applied, 1);
        assert_eq!(fs::read_to_string(project_root().join("test.txt")).unwrap(), "aaa\nBBB\n");
    });
}
