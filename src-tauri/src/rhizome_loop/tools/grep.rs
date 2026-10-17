//! Search file contents inside the allowed roots.

use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};

use regex::Regex;

use super::args;
use super::sandbox::{self, Roots};
use super::walk;

pub const MAX_MATCHES: usize = 100;
const BINARY_PROBE: usize = 8_192;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "grep",
    "description": "Search text files inside the user's vault roots or current workspace. Uses a regex unless literal is true. Optional path limits the search; optional glob filters file names. Honours .gitignore. Each match is `path:line:text`. Results stop at 100 matches with a truncation note. Paths outside the allowed roots are refused.",
    "parameters": {
      "type": "object",
      "properties": {
        "pattern": {
          "type": "string",
          "description": "Regex to search for, or a literal string when literal is true."
        },
        "path": {
          "type": "string",
          "description": "File or directory to search, relative to the current workspace or absolute inside a mounted vault root. Defaults to every allowed root."
        },
        "glob": {
          "type": "string",
          "description": "Optional glob filter such as `*.md` or `notes/**/*.md`."
        },
        "literal": {
          "type": "boolean",
          "description": "When true, treat pattern as a literal string instead of a regex. Defaults to false."
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
    let args = args::parse_object(raw_args, "grep")?;
    let pattern = args::required_str(&args, "pattern", "grep")?;
    let literal = args::optional_bool(&args, "literal", "grep")?.unwrap_or(false);
    let glob = args::optional_str(&args, "glob");
    let search_path = args::optional_str(&args, "path");
    let regex = compile_pattern(pattern, literal)?;
    let glob_set = glob.map(walk::compile_globs).transpose()?;
    let roots = sandbox::allowed_roots(vault_path, vault_paths)?;
    let starts = search_starts(search_path, vault_path, vault_paths, &roots)?;
    let mut lines = Vec::new();
    let mut truncated = false;
    for start in starts {
        if grep_start(&start, &roots, &regex, glob_set.as_ref(), cap, &mut lines) {
            truncated = true;
            break;
        }
    }
    if truncated {
        lines.push(format!("[truncated: result cap is {cap}]"));
    }
    Ok(lines.join("\n"))
}

fn compile_pattern(pattern: &str, literal: bool) -> Result<Regex, String> {
    let source = if literal {
        regex::escape(pattern)
    } else {
        pattern.to_string()
    };
    Regex::new(&source).map_err(|error| format!("Invalid regex: {error}"))
}

fn search_starts(
    search_path: Option<&str>,
    vault_path: Option<&str>,
    vault_paths: &[String],
    roots: &Roots,
) -> Result<Vec<PathBuf>, String> {
    match search_path {
        Some(requested) => Ok(vec![sandbox::resolve(requested, vault_path, vault_paths)?]),
        None => Ok(roots.all.clone()),
    }
}

/// Returns true when the match cap is hit.
fn grep_start(
    start: &Path,
    roots: &Roots,
    regex: &Regex,
    glob_set: Option<&globset::GlobSet>,
    cap: usize,
    lines: &mut Vec<String>,
) -> bool {
    if start.is_file() {
        return grep_file(start, roots, regex, glob_set, cap, lines);
    }
    if !start.is_dir() {
        return false;
    }
    for entry in walk::gitignore_walk(start).flatten() {
        if !walk::is_file_entry(&entry) {
            continue;
        }
        let path = entry.path();
        if !roots.all.iter().any(|root| sandbox::is_within(path, root)) {
            continue;
        }
        if grep_file(path, roots, regex, glob_set, cap, lines) {
            return true;
        }
    }
    false
}

fn grep_file(
    path: &Path,
    roots: &Roots,
    regex: &Regex,
    glob_set: Option<&globset::GlobSet>,
    cap: usize,
    lines: &mut Vec<String>,
) -> bool {
    let relative = sandbox::relative_to_root(path, roots);
    if let Some(glob_set) = glob_set {
        if !glob_set.is_match(&relative) {
            return false;
        }
    }
    if file_is_binary(path) {
        return false;
    }
    let Ok(file) = File::open(path) else {
        return false;
    };
    let reader = BufReader::new(file);
    for (index, line) in reader.lines().enumerate() {
        let Ok(text) = line else {
            return false;
        };
        if regex.is_match(&text) {
            lines.push(format!("{relative}:{}:{text}", index + 1));
            if lines.len() >= cap {
                return true;
            }
        }
    }
    false
}

fn file_is_binary(path: &Path) -> bool {
    let Ok(mut file) = File::open(path) else {
        return true;
    };
    let mut buf = [0u8; BINARY_PROBE];
    let Ok(read) = file.read(&mut buf) else {
        return true;
    };
    buf[..read].contains(&0)
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
    fn regex_search_returns_path_line_text() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join("a.md"), "alpha\nbeta\n").unwrap();
        fs::write(root_path.join("b.md"), "alphabet\n").unwrap();
        let out = run(&json!({ "pattern": "alp" }).to_string(), Some(&root), &[]).unwrap();
        assert!(out.contains("a.md:1:alpha"), "{out}");
        assert!(out.contains("b.md:1:alphabet"), "{out}");
        assert!(!out.contains("beta"), "{out}");
    }

    #[test]
    fn literal_pattern_does_not_act_as_regex() {
        let (_dir, root) = vault();
        fs::write(Path::new(&root).join("a.md"), "a.b\naxb\n").unwrap();
        let regex = run(&json!({ "pattern": "a.b" }).to_string(), Some(&root), &[]).unwrap();
        assert!(regex.contains("a.md:1:a.b"), "{regex}");
        assert!(regex.contains("a.md:2:axb"), "{regex}");
        let literal = run(
            &json!({ "pattern": "a.b", "literal": true }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(literal.contains("a.md:1:a.b"), "{literal}");
        assert!(!literal.contains("axb"), "{literal}");
    }

    #[test]
    fn glob_filter_limits_files() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join("keep.md"), "needle\n").unwrap();
        fs::write(root_path.join("skip.txt"), "needle\n").unwrap();
        let out = run(
            &json!({ "pattern": "needle", "glob": "*.md" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("keep.md:1:needle"), "{out}");
        assert!(!out.contains("skip.txt"), "{out}");
    }

    #[test]
    fn gitignore_hides_ignored_files() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join(".gitignore"), "secret.md\n").unwrap();
        fs::write(root_path.join("open.md"), "needle\n").unwrap();
        fs::write(root_path.join("secret.md"), "needle\n").unwrap();
        let out = run(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("open.md:1:needle"), "{out}");
        assert!(!out.contains("secret.md"), "{out}");
    }

    #[test]
    fn cap_appends_a_truncation_note() {
        let (_dir, root) = vault();
        fs::write(Path::new(&root).join("a.md"), "x\nx\nx\n").unwrap();
        let out =
            run_with_cap(&json!({ "pattern": "x" }).to_string(), Some(&root), &[], 2).unwrap();
        assert!(out.contains("[truncated: result cap is 2]"), "{out}");
        assert_eq!(out.lines().filter(|line| line.contains(":x")).count(), 2);
    }

    #[test]
    fn path_outside_roots_is_refused() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("a.md"), "x\n").unwrap();
        let error = run(
            &json!({
                "pattern": "x",
                "path": outside.path().join("a.md").to_string_lossy()
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::OUTSIDE_ROOTS), "{error}");
    }
}
