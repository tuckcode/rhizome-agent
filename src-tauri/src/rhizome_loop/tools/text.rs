//! Shared text-file reads for mutate tools. Caps size before the
//! whole body is held, and hashes original bytes for stale-preview
//! checks.

use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};

pub const MAX_BYTES: usize = 2_097_152;
pub const ABSENT_HASH: &str = "absent";
pub const CHANGED_SINCE_APPROVAL: &str = "file changed since approval was requested";

pub fn read_bytes_limited(path: &Path, max_bytes: usize) -> Result<Vec<u8>, String> {
    let meta = fs::metadata(path).map_err(|error| format!("Failed to read file: {error}"))?;
    if meta.len() > max_bytes as u64 {
        return Err(format!(
            "File is too large to read ({} bytes; limit is {max_bytes}).",
            meta.len()
        ));
    }
    let file = File::open(path).map_err(|error| format!("Failed to read file: {error}"))?;
    let mut bytes = Vec::new();
    let n = file
        .take((max_bytes as u64).saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Failed to read file: {error}"))?;
    if n > max_bytes {
        return Err(format!(
            "File is too large to read ({n} bytes; limit is {max_bytes})."
        ));
    }
    Ok(bytes)
}

pub fn utf8_text(bytes: &[u8], path: &Path) -> Result<String, String> {
    if bytes.contains(&0) {
        return Err(format!(
            "File is binary and cannot be edited as text: {}",
            path.display()
        ));
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| {
        format!(
            "File is binary and cannot be edited as text: {}",
            path.display()
        )
    })
}

pub fn read_text_limited(path: &Path, max_bytes: usize) -> Result<String, String> {
    let bytes = read_bytes_limited(path, max_bytes)?;
    utf8_text(&bytes, path)
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// CRLF becomes LF. A lone CR stays a lone CR — it is not a newline.
pub fn to_lf(text: &str) -> String {
    text.replace("\r\n", "\n")
}

pub fn dominant_eol(text: &str) -> &'static str {
    let mut crlf = 0usize;
    let mut lf = 0usize;
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\r' && bytes.get(i + 1) == Some(&b'\n') {
            crlf += 1;
            i += 2;
        } else if bytes[i] == b'\n' {
            lf += 1;
            i += 1;
        } else {
            i += 1;
        }
    }
    if crlf > lf {
        "\r\n"
    } else {
        "\n"
    }
}

/// Turn each `\n` in `text` into `eol`. Existing `\r\n` and lone `\r`
/// stay as they are.
pub fn normalize_insert(text: &str, eol: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\r' && bytes.get(i + 1) == Some(&b'\n') {
            out.push_str("\r\n");
            i += 2;
        } else if bytes[i] == b'\r' {
            out.push('\r');
            i += 1;
        } else if bytes[i] == b'\n' {
            out.push_str(eol);
            i += 1;
        } else {
            let ch = text[i..].chars().next().expect("utf-8");
            out.push(ch);
            i += ch.len_utf8();
        }
    }
    out
}

pub fn endings_changed(before: &str, after: &str) -> bool {
    ending_mix(before) != ending_mix(after)
}

pub fn ending_label(text: &str) -> &'static str {
    match ending_mix(text) {
        (false, true, false) => "CRLF",
        (true, false, false) => "LF",
        (false, false, true) => "CR",
        (false, false, false) => "none",
        _ => "mixed",
    }
}

fn ending_mix(text: &str) -> (bool, bool, bool) {
    let mut lf = false;
    let mut crlf = false;
    let mut cr = false;
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\r' && bytes.get(i + 1) == Some(&b'\n') {
            crlf = true;
            i += 2;
        } else if bytes[i] == b'\n' {
            lf = true;
            i += 1;
        } else if bytes[i] == b'\r' {
            cr = true;
            i += 1;
        } else {
            i += 1;
        }
    }
    (lf, crlf, cr)
}

/// Escape `needle` so `\n` (and `\r\n`) match either ending in `haystack`,
/// while a lone `\r` stays a literal CR.
pub fn flexible_needle_regex(needle: &str) -> Result<regex::Regex, String> {
    let mut pat = String::from("(?s:");
    let mut chars = needle.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\r' && chars.peek() == Some(&'\n') {
            chars.next();
            pat.push_str("\\r?\\n");
        } else if ch == '\n' {
            pat.push_str("\\r?\\n");
        } else if ch == '\r' {
            pat.push_str("\\r");
        } else {
            pat.push_str(&regex::escape(&ch.to_string()));
        }
    }
    pat.push(')');
    regex::Regex::new(&pat).map_err(|error| format!("Invalid search string: {error}"))
}

pub fn replace_preserving_endings(
    haystack: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
) -> Result<(String, usize), String> {
    let re = flexible_needle_regex(old_string)?;
    let matches = re.find_iter(haystack).count();
    if matches == 0 {
        return Ok((haystack.to_string(), 0));
    }
    let insert = normalize_insert(new_string, dominant_eol(haystack));
    let after = if replace_all {
        re.replace_all(haystack, regex::NoExpand(&insert))
            .into_owned()
    } else {
        re.replace(haystack, regex::NoExpand(&insert)).into_owned()
    };
    Ok((after, matches))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn read_text_limited_returns_utf8_under_the_cap() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "hello\n").unwrap();
        assert_eq!(read_text_limited(&path, 16).unwrap(), "hello\n");
        assert!(read_text_limited(&path, 3)
            .unwrap_err()
            .contains("too large"));
    }

    #[test]
    fn to_lf_leaves_a_lone_cr_alone() {
        assert_eq!(to_lf("a\rb\r\nc\n"), "a\rb\nc\n");
    }

    #[test]
    fn normalize_insert_maps_lf_to_the_dominant_ending() {
        assert_eq!(normalize_insert("a\nb\r", "\r\n"), "a\r\nb\r");
    }

    #[test]
    fn replace_preserving_endings_keeps_mixed_neighbours() {
        let (after, n) = replace_preserving_endings("a\nb\r\nc\n", "b", "B", false).unwrap();
        assert_eq!(n, 1);
        assert_eq!(after, "a\nB\r\nc\n");
    }
}
