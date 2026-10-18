//! Chunked line scan for native read tools.
//!
//! A giant line is never held in full. Skipped offset lines count
//! newlines only. Invalid UTF-8 is decoded lossily.

use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::Instant;

pub const CHUNK: usize = 8_192;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Control {
    Continue,
    Stop,
}

/// Call `visit` for each line from `skip_until` (1-based) onward.
/// The current line buffer never exceeds `max_line_bytes`.
pub fn for_each_line(
    path: &Path,
    max_line_bytes: usize,
    skip_until: usize,
    mut visit: impl FnMut(usize, &str) -> Control,
) -> std::io::Result<Control> {
    for_each_line_ex(path, max_line_bytes, skip_until, None, |number, text, _| {
        visit(number, text)
    })
}

/// Like [`for_each_line`], with a per-chunk deadline and a flag
/// when the current line was clipped to `max_line_bytes`.
pub fn for_each_line_ex(
    path: &Path,
    max_line_bytes: usize,
    skip_until: usize,
    deadline: Option<Instant>,
    mut visit: impl FnMut(usize, &str, bool) -> Control,
) -> std::io::Result<Control> {
    let mut file = File::open(path)?;
    let mut chunk = [0u8; CHUNK];
    let cap = max_line_bytes.max(1);
    let mut line = Vec::new();
    let mut line_no = 1usize;
    let mut overflow = false;
    loop {
        let n = file.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        if deadline.is_some_and(|limit| Instant::now() >= limit) {
            return Ok(Control::Stop);
        }
        for &byte in &chunk[..n] {
            if byte == b'\n' {
                if line_no >= skip_until {
                    trim_cr(&mut line);
                    let text = String::from_utf8_lossy(&line);
                    if visit(line_no, text.as_ref(), overflow) == Control::Stop {
                        return Ok(Control::Stop);
                    }
                }
                line.clear();
                overflow = false;
                line_no += 1;
                continue;
            }
            if line_no < skip_until || overflow {
                continue;
            }
            if line.len() >= cap {
                overflow = true;
                continue;
            }
            line.push(byte);
        }
    }
    if line_no >= skip_until && (!line.is_empty() || overflow) {
        trim_cr(&mut line);
        let text = String::from_utf8_lossy(&line);
        if visit(line_no, text.as_ref(), overflow) == Control::Stop {
            return Ok(Control::Stop);
        }
    }
    Ok(Control::Continue)
}

fn trim_cr(line: &mut Vec<u8>) {
    if line.last() == Some(&b'\r') {
        line.pop();
    }
}

pub fn clip_chars(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let mut clipped: String = text.chars().take(max_chars).collect();
    clipped.push('…');
    clipped
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn skip_until_does_not_need_the_first_giant_line() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("huge.txt");
        let mut body = vec![b'x'; 200_000];
        body.push(b'\n');
        body.extend_from_slice(b"tail");
        fs::write(&path, &body).unwrap();
        let mut seen = Vec::new();
        for_each_line(&path, 64, 2, |number, text| {
            seen.push((number, text.to_string()));
            Control::Continue
        })
        .unwrap();
        assert_eq!(seen, vec![(2, "tail".to_string())]);
    }

    #[test]
    fn a_giant_line_is_clipped_to_the_byte_cap() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("one.txt");
        fs::write(&path, vec![b'a'; 50_000]).unwrap();
        let mut seen = Vec::new();
        for_each_line(&path, 16, 1, |_, text| {
            seen.push(text.to_string());
            Control::Continue
        })
        .unwrap();
        assert_eq!(seen, vec!["a".repeat(16)]);
    }

    #[test]
    fn a_clipped_line_reports_truncated() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("one.txt");
        fs::write(&path, vec![b'a'; 50]).unwrap();
        let mut flags = Vec::new();
        for_each_line_ex(&path, 8, 1, None, |_, _, truncated| {
            flags.push(truncated);
            Control::Continue
        })
        .unwrap();
        assert_eq!(flags, vec![true]);
    }

    #[test]
    fn deadline_is_checked_after_each_chunk() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("huge.txt");
        fs::write(&path, vec![b'x'; CHUNK * 4]).unwrap();
        let mut visits = 0usize;
        let control = for_each_line_ex(&path, CHUNK * 8, 1, Some(Instant::now()), |_, _, _| {
            visits += 1;
            Control::Continue
        })
        .unwrap();
        assert_eq!(control, Control::Stop);
        assert_eq!(visits, 0);
    }
}
