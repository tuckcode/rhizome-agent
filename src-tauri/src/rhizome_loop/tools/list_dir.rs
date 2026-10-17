//! List files and directories inside the allowed roots.

use std::path::Path;

use super::args;
use super::sandbox;
use super::walk;

pub const MAX_ENTRIES: usize = 200;
const MAX_DEPTH: usize = 32;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "list_dir",
    "description": "List files and directories inside the user's vault roots or current workspace. Each line is `file` or `dir` then a relative path. Honours .gitignore. Secret paths (.env*, .git/, *.pem, id_*) are omitted. Entries are sorted. Results stop at 200 entries with a truncation note. Optional depth defaults to 1 (direct children). Paths outside the allowed roots are refused.",
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
    let (mut entries, truncated) = collect_entries(&dir, depth, cap);
    entries.sort_by(|left, right| left.path.cmp(&right.path));
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

fn collect_entries(dir: &Path, depth: usize, cap: usize) -> (Vec<Listed>, bool) {
    let mut entries = Vec::new();
    let mut walked = 0usize;
    for entry in walk::gitignore_walk_depth(dir, depth).flatten() {
        walked += 1;
        if walked > walk::WALK_BUDGET {
            return (entries, true);
        }
        if entry.depth() == 0 || sandbox::is_secret(entry.path()) {
            continue;
        }
        let kind = if walk::is_dir_entry(&entry) {
            "dir"
        } else {
            "file"
        };
        entries.push(Listed {
            kind,
            path: relative_from(dir, entry.path()),
        });
        if entries.len() >= cap {
            return (entries, true);
        }
    }
    (entries, false)
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
    fn gitignore_hides_ignored_files() {
        let (_dir, root) = vault();
        let root_path = std::path::Path::new(&root);
        fs::write(root_path.join(".gitignore"), "secret.md\n").unwrap();
        fs::write(root_path.join("open.md"), "o\n").unwrap();
        fs::write(root_path.join("secret.md"), "s\n").unwrap();
        let out = run(&json!({}).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("file open.md"), "{out}");
        assert!(out.contains("file .gitignore"), "{out}");
        assert!(!out.contains("secret.md"), "{out}");
    }

    #[cfg(unix)]
    #[test]
    fn lists_a_symlink_without_following_it() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.md"), "no\n").unwrap();
        std::os::unix::fs::symlink(outside.path(), Path::new(&root).join("out")).unwrap();
        fs::write(Path::new(&root).join("inside.md"), "ok\n").unwrap();
        let out = run(&json!({ "depth": 2 }).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("file inside.md"), "{out}");
        assert!(out.contains("file out") || out.contains("dir out"), "{out}");
        assert!(!out.contains("secret.md"), "{out}");
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

    fn plant(root: &Path, rel: &str) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, "secret-value\n").unwrap();
    }

    #[test]
    fn walks_silently_omit_secret_paths() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, ".env");
        plant(root_path, ".env.local");
        plant(root_path, "nested/.git/config");
        plant(root_path, "key.pem");
        plant(root_path, "id_rsa");
        fs::write(root_path.join("open.md"), "ok\n").unwrap();
        let out = run(&json!({ "depth": 4 }).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("file open.md"), "{out}");
        assert!(!out.contains(sandbox::BLOCKED_SECRET), "{out}");
        assert!(!out.contains(".env"), "{out}");
        assert!(!out.contains("config"), "{out}");
        assert!(!out.contains("key.pem"), "{out}");
        assert!(!out.contains("id_rsa"), "{out}");
    }

    #[cfg(unix)]
    #[test]
    fn walks_omit_a_symlink_to_env_local() {
        let (_dir, root) = vault();
        plant(Path::new(&root), ".env.local");
        std::os::unix::fs::symlink(
            Path::new(&root).join(".env.local"),
            Path::new(&root).join("notes.md"),
        )
        .unwrap();
        fs::write(Path::new(&root).join("open.md"), "ok\n").unwrap();
        let out = run(&json!({}).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("file open.md"), "{out}");
        assert!(!out.contains("notes.md"), "{out}");
        assert!(!out.contains(".env.local"), "{out}");
    }
}
