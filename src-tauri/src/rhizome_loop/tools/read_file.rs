//! Read a text file inside the allowed roots.

use std::fs::File;
use std::io::Read;
use std::path::Path;

use super::args;
use super::sandbox;
use super::scan::{self, Control};

pub const MAX_BYTES: usize = 100_000;
const BINARY_PROBE: usize = 8_192;
const BINARY_MESSAGE: &str = "File is binary and cannot be read as text.";

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "read_file",
    "description": "Read a text file inside the user's vault roots or current workspace. Paths are canonicalized; anything outside those roots is refused. Secret files (.env*, anything under .git/, *.pem, id_*) return a blocked error. Optional offset (1-based line) and limit select a line window. Offset skips earlier lines without loading them. Output longer than 100000 bytes is truncated with a note. Non-UTF-8 text is decoded lossily. Files with a NUL byte are refused as binary.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Relative path from the current workspace, or an absolute path inside a mounted vault root."
        },
        "offset": {
          "type": "integer",
          "minimum": 1,
          "description": "1-based line number to start reading. Defaults to 1."
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "description": "Maximum number of lines to return from offset."
        }
      },
      "required": ["path"],
      "additionalProperties": false
    }
  }
}"#;

pub fn run(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    run_with_cap(raw_args, vault_path, vault_paths, MAX_BYTES)
}

fn run_with_cap(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    max_bytes: usize,
) -> Result<String, String> {
    let args = args::parse_object(raw_args, "read_file")?;
    let requested = args::required_str(&args, "path", "read_file")?;
    let offset = args::optional_usize(&args, "offset", "read_file")?;
    let limit = args::optional_usize(&args, "limit", "read_file")?;
    if matches!(offset, Some(0)) {
        return Err("read_file offset must be 1 or greater.".into());
    }
    if matches!(limit, Some(0)) {
        return Err("read_file limit must be 1 or greater.".into());
    }
    let path = sandbox::resolve_file(requested, vault_path, vault_paths)?;
    if is_binary(&path)? {
        return Err(format!("{BINARY_MESSAGE} Requested path: {requested}"));
    }
    read_window(&path, offset.unwrap_or(1), limit, max_bytes)
}

fn is_binary(path: &Path) -> Result<bool, String> {
    let mut file = File::open(path).map_err(|error| format!("Failed to read file: {error}"))?;
    let mut buf = [0u8; BINARY_PROBE];
    let read = file
        .read(&mut buf)
        .map_err(|error| format!("Failed to read file: {error}"))?;
    Ok(buf[..read].contains(&0))
}

fn read_window(
    path: &Path,
    offset: usize,
    limit: Option<usize>,
    max_bytes: usize,
) -> Result<String, String> {
    let file_len = std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0);
    let mut out = String::new();
    let mut truncated = false;
    let mut seen = 0usize;
    let control = scan::for_each_line(path, max_bytes.max(1), offset, |_, text| {
        if let Some(limit) = limit {
            if seen >= limit {
                return Control::Stop;
            }
        }
        seen += 1;
        let add = if out.is_empty() {
            text.to_string()
        } else {
            format!("\n{text}")
        };
        if out.len() + add.len() > max_bytes {
            let remain = max_bytes.saturating_sub(out.len());
            out.push_str(&clip_to_bytes(&add, remain));
            truncated = true;
            return Control::Stop;
        }
        out.push_str(&add);
        if text.len() >= max_bytes && file_len as usize > max_bytes {
            truncated = true;
            return Control::Stop;
        }
        Control::Continue
    })
    .map_err(|error| format!("Failed to read file: {error}"))?;
    if control == Control::Stop && out.len() >= max_bytes {
        truncated = true;
    }
    if truncated {
        out.push_str(&format!(
            "\n[truncated: showing first {max_bytes} bytes of {file_len}]"
        ));
    }
    Ok(out)
}

fn clip_to_bytes(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    let mut end = max;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_string()
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
    fn reads_the_whole_text_file() {
        let (_dir, root) = vault();
        fs::write(std::path::Path::new(&root).join("note.md"), "one\ntwo\n").unwrap();
        let out = run(&json!({ "path": "note.md" }).to_string(), Some(&root), &[]).unwrap();
        assert_eq!(out, "one\ntwo");
    }

    #[test]
    fn offset_and_limit_select_a_line_window() {
        let (_dir, root) = vault();
        fs::write(std::path::Path::new(&root).join("lines.md"), "a\nb\nc\nd\n").unwrap();
        let out = run(
            &json!({ "path": "lines.md", "offset": 2, "limit": 2 }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert_eq!(out, "b\nc");
    }

    #[test]
    fn size_cap_appends_a_truncation_note() {
        let (_dir, root) = vault();
        fs::write(std::path::Path::new(&root).join("big.md"), "abcdefghij").unwrap();
        let out = run_with_cap(
            &json!({ "path": "big.md" }).to_string(),
            Some(&root),
            &[],
            4,
        )
        .unwrap();
        assert!(out.starts_with("abcd"), "{out}");
        assert!(out.contains("[truncated:"), "{out}");
        assert!(out.contains("10"), "{out}");
    }

    #[test]
    fn binary_files_are_refused() {
        let (_dir, root) = vault();
        fs::write(std::path::Path::new(&root).join("blob.bin"), [0u8, 1, 2, 3]).unwrap();
        let error = run(&json!({ "path": "blob.bin" }).to_string(), Some(&root), &[]).unwrap_err();
        assert!(error.contains(BINARY_MESSAGE), "{error}");
    }

    #[test]
    fn non_utf8_text_is_decoded_lossily() {
        let (_dir, root) = vault();
        fs::write(
            std::path::Path::new(&root).join("latin.txt"),
            [b'c', b'a', 0xff, b'f', b'e'],
        )
        .unwrap();
        let out = run(
            &json!({ "path": "latin.txt" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(!out.contains(BINARY_MESSAGE), "{out}");
        assert!(out.contains("ca"), "{out}");
        assert!(out.contains("fe"), "{out}");
        assert!(out.contains('\u{FFFD}'), "{out}");
    }

    #[test]
    fn giant_single_line_is_read_in_chunks_and_capped() {
        let (_dir, root) = vault();
        let body = "needle".to_string() + &"x".repeat(200_000);
        fs::write(std::path::Path::new(&root).join("huge.md"), &body).unwrap();
        let out = run_with_cap(
            &json!({ "path": "huge.md" }).to_string(),
            Some(&root),
            &[],
            32,
        )
        .unwrap();
        assert!(out.starts_with("needle"), "{out}");
        assert!(out.contains("[truncated:"), "{out}");
        let shown = out.lines().next().unwrap();
        assert!(shown.len() <= 32, "{shown}");
        assert!(!out.contains(&"x".repeat(1_000)), "{out}");
    }

    #[test]
    fn offset_skips_a_giant_first_line_without_returning_it() {
        let (_dir, root) = vault();
        let mut body = "x".repeat(200_000);
        body.push('\n');
        body.push_str("tail");
        fs::write(std::path::Path::new(&root).join("huge.md"), &body).unwrap();
        let out = run(
            &json!({ "path": "huge.md", "offset": 2 }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert_eq!(out, "tail");
    }

    #[test]
    fn parent_traversal_is_refused() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        fs::write(parent.path().join("secret.md"), "no\n").unwrap();
        let root = vault.canonicalize().unwrap();
        let error = run(
            &json!({ "path": "../secret.md" }).to_string(),
            Some(root.to_str().unwrap()),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::OUTSIDE_ROOTS), "{error}");
    }

    fn plant(root: &std::path::Path, rel: &str) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, "secret-value\n").unwrap();
    }

    #[test]
    fn each_secret_pattern_returns_blocked_error() {
        let (_dir, root) = vault();
        let root_path = std::path::Path::new(&root);
        plant(root_path, ".env");
        plant(root_path, ".env.local");
        plant(root_path, "nested/.git/config");
        plant(root_path, "key.pem");
        plant(root_path, "id_rsa");
        fs::write(root_path.join("open.md"), "ok\n").unwrap();
        for requested in [
            ".env",
            ".env.local",
            "nested/.git/config",
            "key.pem",
            "id_rsa",
        ] {
            let error =
                run(&json!({ "path": requested }).to_string(), Some(&root), &[]).unwrap_err();
            assert!(
                error.contains(sandbox::BLOCKED_SECRET),
                "expected blocked secret for {requested}: {error}"
            );
            assert!(!error.contains("secret-value"), "{error}");
        }
        let open = run(&json!({ "path": "open.md" }).to_string(), Some(&root), &[]).unwrap();
        assert_eq!(open, "ok");
    }
}
