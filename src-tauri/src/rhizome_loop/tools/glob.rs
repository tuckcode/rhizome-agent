//! Match file paths inside the allowed roots.

use std::path::Path;

use super::args;
use super::sandbox::{self, Roots};
use super::walk;

pub const MAX_MATCHES: usize = 200;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "glob",
    "description": "Find files whose paths match a glob under the user's vault roots or current workspace. Honours .gitignore. Results are sorted relative paths, one per line, and stop at 200 matches with a truncation note. A pattern without a slash also matches at any depth (`*.md` matches `notes/a.md`). Paths outside the allowed roots are refused.",
    "parameters": {
      "type": "object",
      "properties": {
        "pattern": {
          "type": "string",
          "description": "Glob to match, such as `*.md` or `notes/**/*.md`."
        },
        "path": {
          "type": "string",
          "description": "Directory to search, relative to the current workspace or absolute inside a mounted vault root. Defaults to every allowed root."
        }
      },
      "required": ["pattern"],
      "additionalProperties": false
    }
  }
}"#;

pub fn run(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    run_with_cap(raw_args, vault_path, vault_paths, MAX_MATCHES)
}

fn run_with_cap(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    cap: usize,
) -> Result<String, String> {
    let args = args::parse_object(raw_args, "glob")?;
    let pattern = args::required_str(&args, "pattern", "glob")?;
    let search_path = args::optional_str(&args, "path");
    let glob_set = walk::compile_globs(pattern)?;
    let roots = sandbox::allowed_roots(vault_path, vault_paths)?;
    let starts = match search_path {
        Some(requested) => vec![sandbox::resolve_dir(requested, vault_path, vault_paths)?],
        None => roots.all.clone(),
    };
    let mut matches = Vec::new();
    for start in starts {
        collect_matches(&start, &roots, &glob_set, &mut matches);
    }
    matches.sort();
    matches.dedup();
    let truncated = matches.len() > cap;
    if truncated {
        matches.truncate(cap);
    }
    if truncated {
        matches.push(format!("[truncated: result cap is {cap}]"));
    }
    Ok(matches.join("\n"))
}

fn collect_matches(
    start: &Path,
    roots: &Roots,
    glob_set: &globset::GlobSet,
    matches: &mut Vec<String>,
) {
    for entry in walk::gitignore_walk(start).flatten() {
        if !walk::is_file_entry(&entry) {
            continue;
        }
        let path = entry.path();
        if !roots.all.iter().any(|root| sandbox::is_within(path, root)) {
            continue;
        }
        let relative = sandbox::relative_to_root(path, roots);
        if glob_set.is_match(&relative) {
            matches.push(relative);
        }
    }
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
    fn matches_are_sorted_and_nested_star_md_works() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::create_dir(root_path.join("notes")).unwrap();
        fs::write(root_path.join("z.md"), "z\n").unwrap();
        fs::write(root_path.join("a.md"), "a\n").unwrap();
        fs::write(root_path.join("notes").join("b.md"), "b\n").unwrap();
        fs::write(root_path.join("skip.txt"), "s\n").unwrap();
        let out = run(&json!({ "pattern": "*.md" }).to_string(), Some(&root), &[]).unwrap();
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines, vec!["a.md", "notes/b.md", "z.md"]);
    }

    #[test]
    fn gitignore_hides_ignored_files() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join(".gitignore"), "secret.md\n").unwrap();
        fs::write(root_path.join("open.md"), "o\n").unwrap();
        fs::write(root_path.join("secret.md"), "s\n").unwrap();
        let out = run(&json!({ "pattern": "*.md" }).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("open.md"), "{out}");
        assert!(!out.contains("secret.md"), "{out}");
    }

    #[test]
    fn cap_appends_a_truncation_note() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join("a.md"), "a\n").unwrap();
        fs::write(root_path.join("b.md"), "b\n").unwrap();
        fs::write(root_path.join("c.md"), "c\n").unwrap();
        let out = run_with_cap(
            &json!({ "pattern": "*.md" }).to_string(),
            Some(&root),
            &[],
            2,
        )
        .unwrap();
        assert!(out.contains("[truncated: result cap is 2]"), "{out}");
        assert_eq!(out.lines().filter(|line| line.ends_with(".md")).count(), 2);
    }

    #[test]
    fn path_outside_roots_is_refused() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        let error = run(
            &json!({
                "pattern": "*",
                "path": outside.path().to_string_lossy()
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::OUTSIDE_ROOTS), "{error}");
    }
}
