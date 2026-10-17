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
    "description": "Find files whose paths match a glob under the user's vault roots or current workspace. Honours .gitignore. Secret paths (.env* except .env.example, .git/, *.pem/*.key/*.p12/*.pfx, and known private-key basenames) are omitted. Results are sorted relative paths, one per line, and stop at 200 matches with a truncation note. A pattern without a slash also matches at any depth (`*.md` matches `notes/a.md`). Paths outside the allowed roots are refused.",
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
    let mut truncated = walk::Truncation::None;
    for start in starts {
        truncated = collect_matches(
            &start,
            &roots,
            &glob_set,
            cap,
            walk::WALK_BUDGET,
            &mut matches,
        );
        if truncated != walk::Truncation::None {
            break;
        }
    }
    matches.sort();
    matches.dedup();
    if let Some(note) = truncated.note(cap) {
        matches.push(note);
    }
    Ok(matches.join("\n"))
}

fn collect_matches(
    start: &Path,
    roots: &Roots,
    glob_set: &globset::GlobSet,
    cap: usize,
    walk_budget: usize,
    matches: &mut Vec<String>,
) -> walk::Truncation {
    let mut walked = 0usize;
    for entry in walk::gitignore_walk(start).flatten() {
        walked += 1;
        if walked > walk_budget {
            return walk::Truncation::WalkCap;
        }
        if !walk::is_file_entry(&entry) {
            continue;
        }
        let path = entry.path();
        if sandbox::is_blocked_secret(path) {
            continue;
        }
        if !roots.all.iter().any(|root| sandbox::is_within(path, root)) {
            continue;
        }
        let relative = sandbox::relative_to_root(path, roots);
        if glob_set.is_match(&relative) {
            matches.push(relative);
            if matches.len() >= cap {
                return walk::Truncation::ResultCap;
            }
        }
    }
    walk::Truncation::None
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

    #[cfg(unix)]
    #[test]
    fn symlink_dir_inside_a_walk_is_not_followed() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.md"), "s\n").unwrap();
        std::os::unix::fs::symlink(outside.path(), Path::new(&root).join("out")).unwrap();
        fs::write(Path::new(&root).join("open.md"), "o\n").unwrap();
        let out = run(&json!({ "pattern": "*.md" }).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("open.md"), "{out}");
        assert!(!out.contains("secret.md"), "{out}");
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

    fn plant(root: &Path, rel: &str) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, "s\n").unwrap();
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
        plant(root_path, "server.key");
        plant(root_path, "client.p12");
        plant(root_path, "cert.pfx");
        plant(root_path, ".env.example");
        plant(root_path, "id_rsa.pub");
        plant(root_path, "id_card.md");
        fs::write(root_path.join("open.md"), "o\n").unwrap();
        let out = run(&json!({ "pattern": "*" }).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("open.md"), "{out}");
        assert!(out.contains(".env.example"), "{out}");
        assert!(out.contains("id_rsa.pub"), "{out}");
        assert!(out.contains("id_card.md"), "{out}");
        assert!(!out.contains(sandbox::BLOCKED_SECRET), "{out}");
        assert!(!out.contains(".env.local"), "{out}");
        assert!(!out.contains(".env\n"), "{out}");
        assert!(!out.contains("config"), "{out}");
        assert!(!out.contains("key.pem"), "{out}");
        assert!(
            !out.contains("id_rsa\n") && !out.lines().any(|line| line == "id_rsa"),
            "{out}"
        );
        assert!(!out.contains("server.key"), "{out}");
        assert!(!out.contains("client.p12"), "{out}");
        assert!(!out.contains("cert.pfx"), "{out}");
    }

    #[test]
    fn walk_cap_note_names_the_walk_budget() {
        let (_dir, root) = vault();
        let roots = sandbox::allowed_roots(Some(&root), &[]).unwrap();
        let glob_set = walk::compile_globs("*").unwrap();
        fs::write(Path::new(&root).join("a.md"), "a\n").unwrap();
        fs::write(Path::new(&root).join("b.md"), "b\n").unwrap();
        let mut matches = Vec::new();
        let truncated = collect_matches(Path::new(&root), &roots, &glob_set, 200, 1, &mut matches);
        assert_eq!(truncated, walk::Truncation::WalkCap);
        assert_eq!(
            truncated.note(200).as_deref(),
            Some("[truncated: walk cap is 10000 entries]")
        );
    }

    #[test]
    fn override_off_includes_secret_names() {
        let (_dir, root) = vault();
        plant(Path::new(&root), "id_rsa");
        fs::write(Path::new(&root).join("open.md"), "o\n").unwrap();
        let _guard = sandbox::override_secret_block(false);
        let out = run(&json!({ "pattern": "*" }).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("id_rsa"), "{out}");
        assert!(out.contains("open.md"), "{out}");
    }
}
