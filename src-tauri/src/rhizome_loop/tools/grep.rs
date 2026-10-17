//! Search file contents inside the allowed roots.

use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use regex::{Regex, RegexBuilder};

use super::args;
use super::sandbox::{self, Roots};
use super::scan::{self, Control};
use super::walk;

pub const MAX_MATCHES: usize = 100;
pub const MAX_MATCH_CHARS: usize = 500;
pub const MAX_OUTPUT_BYTES: usize = 100_000;
pub const MAX_FILES: usize = 2_000;
pub const MAX_DURATION: Duration = Duration::from_secs(2);
const REGEX_SIZE_LIMIT: usize = 1_048_576;
const BINARY_PROBE: usize = 8_192;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "grep",
    "description": "Search text files inside the user's vault roots or current workspace. Uses a regex unless literal is true. Optional path limits the search; optional glob filters file names. Honours .gitignore. Secret paths (.env*, .git/, *.pem, id_*) are omitted. Each match is `path:line:text`. Matching text is clipped to 500 characters. Results stop at 100 matches, 100000 output bytes, 2000 files, or 2 seconds, with a truncation note. Paths outside the allowed roots are refused.",
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

struct Limits {
    matches: usize,
    output_bytes: usize,
    files: usize,
    duration: Duration,
}

impl Limits {
    fn production() -> Self {
        Self {
            matches: MAX_MATCHES,
            output_bytes: MAX_OUTPUT_BYTES,
            files: MAX_FILES,
            duration: MAX_DURATION,
        }
    }
}

struct Budget<'a> {
    limits: &'a Limits,
    started: Instant,
    files: usize,
    output_bytes: usize,
    note: Option<String>,
}

impl<'a> Budget<'a> {
    fn new(limits: &'a Limits) -> Self {
        Self {
            limits,
            started: Instant::now(),
            files: 0,
            output_bytes: 0,
            note: None,
        }
    }

    fn stopped(&self) -> bool {
        self.note.is_some()
    }

    fn time_up(&mut self) -> bool {
        if self.started.elapsed() >= self.limits.duration {
            self.note = Some(format!(
                "time budget is {}s",
                self.limits.duration.as_secs().max(1)
            ));
            true
        } else {
            false
        }
    }

    fn open_file(&mut self) -> bool {
        if self.stopped() || self.time_up() {
            return false;
        }
        if self.files >= self.limits.files {
            self.note = Some(format!("file scan cap is {}", self.limits.files));
            return false;
        }
        self.files += 1;
        true
    }
}

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
    run_with_limits(
        raw_args,
        vault_path,
        vault_paths,
        Limits {
            matches: cap,
            ..Limits::production()
        },
    )
}

fn run_with_limits(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    limits: Limits,
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
    let mut budget = Budget::new(&limits);
    for start in starts {
        if grep_start(
            &start,
            &roots,
            &regex,
            glob_set.as_ref(),
            &mut budget,
            &mut lines,
        ) {
            break;
        }
    }
    if let Some(reason) = budget.note {
        lines.push(format!("[truncated: {reason}]"));
    }
    Ok(lines.join("\n"))
}

fn compile_pattern(pattern: &str, literal: bool) -> Result<Regex, String> {
    let source = if literal {
        regex::escape(pattern)
    } else {
        pattern.to_string()
    };
    RegexBuilder::new(&source)
        .size_limit(REGEX_SIZE_LIMIT)
        .dfa_size_limit(REGEX_SIZE_LIMIT)
        .build()
        .map_err(|error| format!("Invalid regex: {error}"))
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

/// Returns true when a budget stop is hit.
fn grep_start(
    start: &Path,
    roots: &Roots,
    regex: &Regex,
    glob_set: Option<&globset::GlobSet>,
    budget: &mut Budget<'_>,
    lines: &mut Vec<String>,
) -> bool {
    if start.is_file() {
        if sandbox::is_secret(start) {
            return false;
        }
        return grep_file(start, roots, regex, glob_set, budget, lines);
    }
    if !start.is_dir() {
        return false;
    }
    let mut walked = 0usize;
    for entry in walk::gitignore_walk(start).flatten() {
        walked += 1;
        if walked > walk::WALK_BUDGET {
            budget.note = Some(format!("walk cap is {} entries", walk::WALK_BUDGET));
            return true;
        }
        if budget.stopped() || budget.time_up() {
            return true;
        }
        if !walk::is_file_entry(&entry) {
            continue;
        }
        let path = entry.path();
        if sandbox::is_secret(path) {
            continue;
        }
        if !roots.all.iter().any(|root| sandbox::is_within(path, root)) {
            continue;
        }
        if grep_file(path, roots, regex, glob_set, budget, lines) {
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
    budget: &mut Budget<'_>,
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
    if !budget.open_file() {
        return true;
    }
    let max_line_bytes = MAX_MATCH_CHARS * 4;
    let scanned = scan::for_each_line(path, max_line_bytes, 1, |number, text| {
        if regex.is_match(text) {
            let clipped = scan::clip_chars(text, MAX_MATCH_CHARS);
            let line = format!("{relative}:{number}:{clipped}");
            if budget.output_bytes + line.len() > budget.limits.output_bytes {
                budget.note = Some(format!(
                    "output cap is {} bytes",
                    budget.limits.output_bytes
                ));
                return Control::Stop;
            }
            budget.output_bytes += line.len() + 1;
            lines.push(line);
            if lines.len() >= budget.limits.matches {
                budget.note = Some(format!("result cap is {}", budget.limits.matches));
                return Control::Stop;
            }
        }
        if budget.time_up() {
            return Control::Stop;
        }
        Control::Continue
    });
    budget.stopped() || matches!(scanned, Ok(Control::Stop))
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
        assert!(out.contains("[truncated:"), "{out}");
        assert_eq!(out.lines().filter(|line| line.contains(":x")).count(), 2);
    }

    #[test]
    fn matching_line_is_clipped_to_500_chars() {
        let (_dir, root) = vault();
        let body = "needle".to_string() + &"x".repeat(2_000);
        fs::write(Path::new(&root).join("long.md"), &body).unwrap();
        let out = run(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        let text = out.lines().next().unwrap().splitn(3, ':').nth(2).unwrap();
        assert!(text.starts_with("needle"), "{text}");
        assert!(text.ends_with('…'), "{text}");
        assert_eq!(text.chars().count(), MAX_MATCH_CHARS + 1);
        assert!(!text.contains(&"x".repeat(600)), "{text}");
    }

    #[test]
    fn giant_single_line_is_scanned_in_chunks() {
        let (_dir, root) = vault();
        let body = "needle".to_string() + &"y".repeat(200_000);
        fs::write(Path::new(&root).join("huge.md"), &body).unwrap();
        let out = run(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("huge.md:1:needle"), "{out}");
        let text = out.lines().next().unwrap().splitn(3, ':').nth(2).unwrap();
        assert!(text.len() < 3_000, "{}", text.len());
    }

    #[test]
    fn output_byte_cap_stops_and_notes() {
        let (_dir, root) = vault();
        fs::write(Path::new(&root).join("a.md"), "needle\nneedle\nneedle\n").unwrap();
        let out = run_with_limits(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
            Limits {
                matches: 100,
                output_bytes: 20,
                files: MAX_FILES,
                duration: MAX_DURATION,
            },
        )
        .unwrap();
        assert!(out.contains("[truncated: output cap is 20 bytes]"), "{out}");
        assert!(
            out.lines()
                .filter(|line| line.contains("needle") && !line.starts_with('['))
                .count()
                <= 2,
            "{out}"
        );
    }

    #[test]
    fn file_scan_cap_notes() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join("a.md"), "needle\n").unwrap();
        fs::write(root_path.join("b.md"), "needle\n").unwrap();
        let out = run_with_limits(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
            Limits {
                matches: 100,
                output_bytes: MAX_OUTPUT_BYTES,
                files: 1,
                duration: MAX_DURATION,
            },
        )
        .unwrap();
        assert!(out.contains("[truncated: file scan cap is 1]"), "{out}");
        assert!(out.contains("needle"), "{out}");
    }

    #[test]
    fn non_utf8_does_not_skip_the_rest_of_the_file() {
        let (_dir, root) = vault();
        let mut body = Vec::from("needle-one\n");
        body.push(0xff);
        body.extend_from_slice(b"\nneedle-two\n");
        fs::write(Path::new(&root).join("mix.md"), &body).unwrap();
        let out = run(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("needle-one"), "{out}");
        assert!(out.contains("needle-two"), "{out}");
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

    #[cfg(unix)]
    #[test]
    fn symlink_dir_inside_a_walk_is_not_followed() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.md"), "needle\n").unwrap();
        let link = Path::new(&root).join("out");
        std::os::unix::fs::symlink(outside.path(), &link).unwrap();
        fs::write(Path::new(&root).join("open.md"), "needle\n").unwrap();
        let out = run(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("open.md:1:needle"), "{out}");
        assert!(!out.contains("secret.md"), "{out}");
    }

    fn plant(root: &Path, rel: &str) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, "needle\n").unwrap();
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
        fs::write(root_path.join("open.md"), "needle\n").unwrap();
        let out = run(
            &json!({ "pattern": "needle" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("open.md:1:needle"), "{out}");
        assert!(!out.contains(sandbox::BLOCKED_SECRET), "{out}");
        assert!(!out.contains(".env"), "{out}");
        assert!(!out.contains("config"), "{out}");
        assert!(!out.contains("key.pem"), "{out}");
        assert!(!out.contains("id_rsa"), "{out}");
    }

    #[test]
    fn direct_secret_path_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), ".env.local");
        let error = run(
            &json!({ "pattern": "needle", "path": ".env.local" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::BLOCKED_SECRET), "{error}");
    }
}
