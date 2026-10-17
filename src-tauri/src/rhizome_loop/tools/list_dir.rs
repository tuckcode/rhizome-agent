//! List files and directories inside the allowed roots.

use std::path::Path;

use walkdir::WalkDir;

use super::args;
use super::sandbox;

pub const MAX_ENTRIES: usize = 200;
const MAX_DEPTH: usize = 32;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "list_dir",
    "description": "List files and directories inside the user's vault roots or current workspace. Each line is `file` or `dir` then a relative path. Entries are sorted. Results stop at 200 entries with a truncation note. Optional depth defaults to 1 (direct children). Paths outside the allowed roots are refused.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Directory to list, relative to the current workspace or absolute inside a mounted vault root. Defaults to the current workspace root."
        },
        "depth": {
          "type": "integer",
          "minimum": 1,
          "description": "How many directory levels to include. 1 is direct children. Defaults to 1. Capped at 32."
        }
      },
      "additionalProperties": false
    }
  }
}"#;

pub fn run(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    run_with_cap(raw_args, vault_path, vault_paths, MAX_ENTRIES)
}

fn run_with_cap(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    cap: usize,
) -> Result<String, String> {
    let args = args::parse_object(raw_args, "list_dir")?;
    let requested = args::optional_str(&args, "path").unwrap_or(".");
    let depth = args::optional_usize(&args, "depth", "list_dir")?.unwrap_or(1);
    if depth == 0 {
        return Err("list_dir depth must be 1 or greater.".into());
    }
    let depth = depth.min(MAX_DEPTH);
    let dir = sandbox::resolve_dir(requested, vault_path, vault_paths)?;
    let mut entries = collect_entries(&dir, depth);
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    let truncated = entries.len() > cap;
    if truncated {
        entries.truncate(cap);
    }
    let mut lines: Vec<String> = entries
        .into_iter()
        .map(|entry| format!("{} {}", entry.kind, entry.path))
        .collect();
    if truncated {
        lines.push(format!("[truncated: result cap is {cap}]"));
    }
    Ok(lines.join("\n"))
}

struct Listed {
    kind: &'static str,
    path: String,
}

fn collect_entries(dir: &Path, depth: usize) -> Vec<Listed> {
    WalkDir::new(dir)
        .follow_links(false)
        .max_depth(depth)
        .into_iter()
        .filter_entry(|entry| entry.depth() == 0 || entry.file_name() != ".git")
        .filter_map(Result::ok)
        .filter(|entry| entry.depth() > 0)
        .map(|entry| {
            let kind = if entry.file_type().is_dir() {
                "dir"
            } else {
                "file"
            };
            let relative = relative_from(dir, entry.path());
            Listed {
                kind,
                path: relative,
            }
        })
        .collect()
}

fn relative_from(dir: &Path, path: &Path) -> String {
    path.strip_prefix(dir)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    fn vault() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().canonicalize().unwrap();
        (dir, path.to_string_lossy().into_owned())
    }

    #[test]
    fn lists_direct_children_sorted_with_types() {
        let (_dir, root) = vault();
        let root_path = std::path::Path::new(&root);
        fs::create_dir(root_path.join("notes")).unwrap();
        fs::write(root_path.join("a.md"), "a\n").unwrap();
        fs::write(root_path.join("z.md"), "z\n").unwrap();
        let out = run(&json!({}).to_string(), Some(&root), &[]).unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines, vec!["file a.md", "dir notes", "file z.md"]);
    }

    #[test]
    fn depth_includes_nested_entries() {
        let (_dir, root) = vault();
        let root_path = std::path::Path::new(&root);
        fs::create_dir(root_path.join("notes")).unwrap();
        fs::write(root_path.join("notes").join("inner.md"), "i\n").unwrap();
        let shallow = run(
            &json!({ "path": ".", "depth": 1 }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(!shallow.contains("notes/inner.md"), "{shallow}");
        let deep = run(
            &json!({ "path": ".", "depth": 2 }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(deep.contains("dir notes"), "{deep}");
        assert!(deep.contains("file notes/inner.md"), "{deep}");
    }

    #[test]
    fn cap_appends_a_truncation_note() {
        let (_dir, root) = vault();
        let root_path = std::path::Path::new(&root);
        fs::write(root_path.join("a.md"), "a\n").unwrap();
        fs::write(root_path.join("b.md"), "b\n").unwrap();
        fs::write(root_path.join("c.md"), "c\n").unwrap();
        let out = run_with_cap(&json!({}).to_string(), Some(&root), &[], 2).unwrap();
        assert!(out.contains("[truncated: result cap is 2]"), "{out}");
        assert_eq!(
            out.lines().filter(|line| line.starts_with("file ")).count(),
            2
        );
    }

    #[test]
    fn absolute_path_outside_is_refused() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        let error = run(
            &json!({ "path": outside.path().to_string_lossy() }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::OUTSIDE_ROOTS), "{error}");
    }
}
