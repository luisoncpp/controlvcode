#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use crate::grep_in_files::{
        search_files_with_regex,
        glob_to_regex,
        is_binary_extension,
        is_ignored_path,
    };

    // ── Helpers de test ──────────────────────────────────────────

    fn setup_fixture() -> (tempfile::TempDir, PathBuf) {
        let tmp = tempfile::tempdir().expect("Failed to create temp dir");
        let root = tmp.path().to_path_buf();

        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("test")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();

        fs::write(root.join("src/main.rs"), "console.log('hello');\nlet x = 1;\n").unwrap();
        fs::write(root.join("src/lib.rs"), "// TODO: fix this\nfn foo() {}\n").unwrap();
        fs::write(root.join("src/image.png"), b"PNG...").unwrap();
        fs::write(root.join("test/app.test.ts"), "describe('test', () => {\n  console.log('test');\n});\n").unwrap();
        fs::write(root.join(".git/config"), "[core]\nignore = true\n").unwrap();

        (tmp, root)
    }

    // ── Tests unitarios de helpers ──────────────────────────────

    #[test]
    fn test_glob_to_regex_exact() {
        let re = glob_to_regex("*.rs");
        assert!(re.is_match("main.rs"));
        assert!(re.is_match("lib.rs"));
        assert!(!re.is_match("main.ts"));
    }

    #[test]
    fn test_glob_to_regex_question() {
        let re = glob_to_regex("file_?.txt");
        assert!(re.is_match("file_1.txt"));
        assert!(re.is_match("file_a.txt"));
        assert!(!re.is_match("file_12.txt"));
    }

    #[test]
    fn test_is_binary_extension() {
        assert!(is_binary_extension("png"));
        assert!(is_binary_extension("exe"));
        assert!(is_binary_extension("wasm"));
        assert!(!is_binary_extension("rs"));
        assert!(!is_binary_extension("ts"));
        assert!(!is_binary_extension("txt"));
    }

    #[test]
    fn test_is_ignored_path() {
        assert!(is_ignored_path("node_modules/foo"));
        assert!(is_ignored_path(".git/config"));
        assert!(is_ignored_path("target/debug/build"));
        assert!(!is_ignored_path("src/main.rs"));
        assert!(!is_ignored_path("lib.rs"));
    }

    // ── Tests de búsqueda ──────────────────────────────────────

    #[test]
    fn test_search_in_file() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root.join("src/main.rs"),
            "console",
            None,
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "src/main.rs");
        assert_eq!(results[0].line, 1);
        assert_eq!(results[0].content, "console.log('hello');");
    }

    #[test]
    fn test_search_in_directory_recursive() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root.join("src"),
            "console",
            None,
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "src/main.rs");
    }

    #[test]
    fn test_search_ignores_binaries() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root.join("src"),
            "PNG",
            None,
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_respects_ignored_dirs() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root,
            "ignore",
            None,
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_case_insensitive() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root.join("src/lib.rs"),
            "todo",
            None,
            true,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "// TODO: fix this");
    }

    #[test]
    fn test_search_with_glob_filter() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root,
            "console",
            Some("*.ts"),
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "test/app.test.ts");
    }

    #[test]
    fn test_search_with_glob_and_case_insensitive() {
        let (_tmp, root) = setup_fixture();
        let results = search_files_with_regex(
            &root,
            &root,
            "console",
            Some("*.rs"),
            false,
        )
        .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "src/main.rs");
    }

    #[test]
    fn test_search_nonexistent_path_errors() {
        let (_tmp, root) = setup_fixture();
        let err = search_files_with_regex(
            &root,
            &root.join("nonexistent"),
            "foo",
            None,
            false,
        )
        .unwrap_err();
        assert!(err.contains("no existe"));
    }
}
