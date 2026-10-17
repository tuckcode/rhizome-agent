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

pub fn hash_existing(path: &Path, max_bytes: usize) -> Result<String, String> {
    if !path.is_file() {
        return Ok(ABSENT_HASH.to_string());
    }
    let bytes = read_bytes_limited(path, max_bytes)?;
    Ok(hash_bytes(&bytes))
}

pub fn uses_crlf(text: &str) -> bool {
    text.contains("\r\n")
}

pub fn to_lf(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

pub fn apply_eol(text: &str, crlf: bool) -> String {
    let lf = to_lf(text);
    if crlf {
        lf.replace('\n', "\r\n")
    } else {
        lf
    }
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
}
