//! In-place `Status` write for one note's frontmatter.
//!
//! The write changes the bytes of the `Status` line and nothing else.
//! It keeps a BOM, CRLF line endings, the key's case, the quote style,
//! and a trailing comment. Only top-level keys match, so a `Status:`
//! inside a block scalar or a multi-line quoted value stays as it is.
//! A note with no frontmatter gets a new block. A note with
//! frontmatter but no `Status` key gets one line before the close.

const BOM: char = '\u{FEFF}';
const FENCE: &str = "---";
/// Longest status value a move accepts, in characters.
pub const MAX_STATUS_CHARS: usize = 120;

/// Result of one status write: the new note text and the old value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusEdit {
    pub content: String,
    pub from: Option<String>,
}

/// Set the top-level `Status` key of `content` to `status`.
pub fn set_status(content: &str, status: &str) -> Result<StatusEdit, String> {
    let status = validate_status(status)?;
    let (bom, body) = match content.strip_prefix(BOM) {
        Some(rest) => (true, rest),
        None => (false, content),
    };
    let lines = split_lines(body);
    let edited = match frontmatter_end(&lines)? {
        Some(close) => edit_frontmatter(&lines, close, status),
        None => prepend_block(body, status),
    };
    let mut out = String::with_capacity(content.len() + status.len() + 16);
    if bom {
        out.push(BOM);
    }
    out.push_str(&edited.content);
    Ok(StatusEdit {
        content: out,
        from: edited.from,
    })
}

/// The note's top-level `Status` value, if it has one.
pub fn read_status(content: &str) -> Option<String> {
    let body = content.strip_prefix(BOM).unwrap_or(content);
    let lines = split_lines(body);
    let close = frontmatter_end(&lines).ok()??;
    let span = status_spans(&lines[1..close]).into_iter().next()?;
    let (start, end) = (span.start + 1, span.end + 1);
    let key = parse_key_line(lines[start].text)?;
    read_value(&lines[start..=end], &key)
}

fn validate_status(status: &str) -> Result<&str, String> {
    let trimmed = status.trim();
    if trimmed.is_empty() {
        return Err("Status must not be empty.".into());
    }
    if trimmed.chars().any(char::is_control) {
        return Err("Status must be one line with no control characters.".into());
    }
    if trimmed.chars().count() > MAX_STATUS_CHARS {
        return Err(format!(
            "Status must be {MAX_STATUS_CHARS} characters or fewer."
        ));
    }
    Ok(trimmed)
}

/// One line and its own ending (`""`, `"\n"` or `"\r\n"`).
#[derive(Debug, Clone, Copy)]
struct Line<'a> {
    text: &'a str,
    eol: &'a str,
}

fn split_lines(body: &str) -> Vec<Line<'_>> {
    let mut lines = Vec::new();
    let mut rest = body;
    while !rest.is_empty() {
        let (line, tail) = match rest.find('\n') {
            Some(index) => rest.split_at(index + 1),
            None => (rest, ""),
        };
        let (text, eol) = if let Some(text) = line.strip_suffix("\r\n") {
            (text, "\r\n")
        } else if let Some(text) = line.strip_suffix('\n') {
            (text, "\n")
        } else {
            (line, "")
        };
        lines.push(Line { text, eol });
        rest = tail;
    }
    lines
}

/// Index of the closing fence, or `None` when the note has no frontmatter.
fn frontmatter_end(lines: &[Line<'_>]) -> Result<Option<usize>, String> {
    let Some(first) = lines.first() else {
        return Ok(None);
    };
    if first.text.trim_end() != FENCE || first.eol.is_empty() {
        return Ok(None);
    }
    lines
        .iter()
        .enumerate()
        .skip(1)
        .find(|(_, line)| is_close_fence(line.text))
        .map(|(index, _)| Some(index))
        .ok_or_else(|| "Frontmatter has no closing `---` line.".to_string())
}

/// `---` closes the block, and so does YAML's `...` document end.
fn is_close_fence(text: &str) -> bool {
    let text = text.trim_end();
    text == FENCE || text == "..."
}

fn prepend_block(body: &str, status: &str) -> StatusEdit {
    let eol = if body.contains("\r\n") { "\r\n" } else { "\n" };
    let value = format_value(status, None);
    StatusEdit {
        content: format!("{FENCE}{eol}Status: {value}{eol}{FENCE}{eol}{body}"),
        from: None,
    }
}

fn edit_frontmatter(lines: &[Line<'_>], close: usize, status: &str) -> StatusEdit {
    // `status_spans` sees only the lines between the fences.
    let spans = status_spans(&lines[1..close]);
    if spans.is_empty() {
        return insert_status(lines, close, status);
    }
    let mut out = String::new();
    let mut from = None;
    let mut index = 0;
    for span in spans {
        let (start, end) = (span.start + 1, span.end + 1);
        push_lines(&mut out, &lines[index..start]);
        let old = rewrite_span(&mut out, &lines[start..=end], status);
        from = from.or(old);
        index = end + 1;
    }
    push_lines(&mut out, &lines[index..]);
    StatusEdit { content: out, from }
}

/// Adds a `Status` line just before the closing fence.
fn insert_status(lines: &[Line<'_>], close: usize, status: &str) -> StatusEdit {
    let mut out = String::new();
    push_lines(&mut out, &lines[..close]);
    let eol = lines[0].eol;
    out.push_str(&format!("Status: {}{eol}", format_value(status, None)));
    push_lines(&mut out, &lines[close..]);
    StatusEdit {
        content: out,
        from: None,
    }
}

/// Writes one `Status` entry as a single line. Returns the old value.
fn rewrite_span(out: &mut String, span: &[Line<'_>], status: &str) -> Option<String> {
    let Some(key) = parse_key_line(span[0].text) else {
        push_lines(out, span);
        return None;
    };
    out.push_str(&rewrite_key_line(&key, status));
    // Every line before the close fence has an ending.
    out.push_str(span[span.len() - 1].eol);
    read_value(span, &key)
}

fn push_lines(out: &mut String, lines: &[Line<'_>]) {
    for line in lines {
        push_line(out, line);
    }
}

fn push_line(out: &mut String, line: &Line<'_>) {
    out.push_str(line.text);
    out.push_str(line.eol);
}

/// Inclusive line range of one top-level `Status` entry.
#[derive(Debug, Clone, Copy)]
struct Span {
    start: usize,
    end: usize,
}

/// Parsed top-level `key: value` line.
#[derive(Debug, Clone, Copy)]
struct KeyLine<'a> {
    /// Text up to and including the space after `:`.
    prefix: &'a str,
    /// Value text with any trailing comment removed.
    value: &'a str,
    /// ` # comment` suffix, kept as written.
    comment: &'a str,
}

fn status_spans(lines: &[Line<'_>]) -> Vec<Span> {
    let mut spans = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let text = lines[index].text;
        let Some(key) = parse_key_line(text) else {
            index += 1;
            continue;
        };
        let end = value_end(lines, index, key.value);
        if key_name(text).is_some_and(is_status_key) {
            spans.push(Span { start: index, end });
        }
        index = end + 1;
    }
    spans
}

/// `Status` or `status`, the two spellings the vault parser reads.
fn is_status_key(name: &str) -> bool {
    matches!(name, "Status" | "status")
}

/// Last line that belongs to the value that starts on `lines[start]`.
fn value_end(lines: &[Line<'_>], start: usize, value: &str) -> usize {
    let trimmed = value.trim();
    if let Some(quote) = open_quote(trimmed) {
        let mut index = start;
        let mut text = trimmed[1..].to_string();
        while !closes_quote(&text, quote) && index + 1 < lines.len() {
            index += 1;
            text = lines[index].text.to_string();
        }
        return index;
    }
    // Block scalars, nested maps, and lists: indented lines, plus `- `
    // items at column 0 (YAML's compact sequence form). A blank line
    // belongs to the value only when a continuation line follows it.
    let mut index = start;
    loop {
        let mut next = index + 1;
        while next < lines.len() && lines[next].text.trim().is_empty() {
            next += 1;
        }
        if next < lines.len() && is_continuation(lines[next].text, trimmed.is_empty()) {
            index = next;
        } else {
            return index;
        }
    }
}

fn is_continuation(text: &str, empty_value: bool) -> bool {
    if text.trim().is_empty() {
        return false;
    }
    text.starts_with(' ')
        || text.starts_with('\t')
        || (empty_value && (text == "-" || text.starts_with("- ")))
}

/// Quote char when the value opens a quoted scalar that does not close
/// on the same line.
fn open_quote(value: &str) -> Option<char> {
    let quote = value.chars().next().filter(|c| *c == '"' || *c == '\'')?;
    if closes_quote(&value[1..], quote) {
        None
    } else {
        Some(quote)
    }
}

fn closes_quote(text: &str, quote: char) -> bool {
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if quote == '"' && c == '\\' {
            chars.next();
            continue;
        }
        if c == quote {
            if quote == '\'' && chars.peek() == Some(&'\'') {
                chars.next();
                continue;
            }
            return true;
        }
    }
    false
}

fn key_name(text: &str) -> Option<&str> {
    let colon = key_colon(text)?;
    let key = text[..colon].trim();
    Some(strip_quotes(key).unwrap_or(key))
}

/// Byte index of the `:` that ends a top-level key, if `text` is one.
fn key_colon(text: &str) -> Option<usize> {
    let first = text.chars().next()?;
    if first.is_whitespace() || matches!(first, '#' | '-' | '[' | '{') {
        return None;
    }
    let bytes = text.as_bytes();
    if first == '"' || first == '\'' {
        let close = text[1..].find(first)? + 1;
        return (bytes.get(close + 1) == Some(&b':')).then_some(close + 1);
    }
    let colon = text.find(':')?;
    let after = bytes.get(colon + 1);
    matches!(after, None | Some(b' ') | Some(b'\t')).then_some(colon)
}

fn parse_key_line(text: &str) -> Option<KeyLine<'_>> {
    let colon = key_colon(text)?;
    let rest = &text[colon + 1..];
    let gap = rest.len() - rest.trim_start().len();
    let prefix = &text[..colon + 1 + gap];
    let raw = &text[colon + 1 + gap..];
    let (value, comment) = split_comment(raw);
    Some(KeyLine {
        prefix,
        value,
        comment,
    })
}

/// Split a single-line value from a ` # comment` suffix.
fn split_comment(raw: &str) -> (&str, &str) {
    let trimmed = raw.trim_start();
    if let Some(quote) = trimmed.chars().next().filter(|c| *c == '"' || *c == '\'') {
        if let Some(end) = quoted_end(trimmed, quote) {
            let tail = &trimmed[end..];
            if tail.trim_start().starts_with('#') {
                let cut = raw.len() - tail.len();
                let (value, comment) = raw.split_at(cut);
                return (value, comment);
            }
        }
        return (raw, "");
    }
    if raw.starts_with('#') {
        return ("", raw);
    }
    match raw.find(" #").or_else(|| raw.find("\t#")) {
        Some(index) => {
            let value = raw[..index].trim_end();
            (value, &raw[value.len()..])
        }
        None => (raw, ""),
    }
}

/// Byte index just past the closing quote of a quoted scalar.
fn quoted_end(text: &str, quote: char) -> Option<usize> {
    let mut iter = text.char_indices().skip(1).peekable();
    while let Some((index, c)) = iter.next() {
        if quote == '"' && c == '\\' {
            iter.next();
            continue;
        }
        if c == quote {
            if quote == '\'' && iter.peek().map(|(_, n)| *n) == Some('\'') {
                iter.next();
                continue;
            }
            return Some(index + c.len_utf8());
        }
    }
    None
}

fn strip_quotes(text: &str) -> Option<&str> {
    ['"', '\'']
        .into_iter()
        .find_map(|quote| text.strip_prefix(quote)?.strip_suffix(quote))
}

/// Old value as text. Lists and maps read as `None`.
fn read_value(span: &[Line<'_>], key: &KeyLine<'_>) -> Option<String> {
    let mut source = key.value.to_string();
    for line in &span[1..] {
        source.push('\n');
        source.push_str(line.text);
    }
    let parsed = serde_yaml::from_str::<serde_yaml::Value>(&source).ok()?;
    let text = match parsed {
        serde_yaml::Value::String(text) => text,
        serde_yaml::Value::Number(number) => number.to_string(),
        serde_yaml::Value::Bool(flag) => flag.to_string(),
        _ => return None,
    };
    let text = text.trim().to_string();
    (!text.is_empty()).then_some(text)
}

fn rewrite_key_line(key: &KeyLine<'_>, status: &str) -> String {
    let quote = key
        .value
        .trim()
        .chars()
        .next()
        .filter(|c| *c == '"' || *c == '\'');
    let mut prefix = key.prefix.to_string();
    if !prefix.ends_with(' ') && !prefix.ends_with('\t') {
        prefix.push(' ');
    }
    let comment = if key.comment.is_empty() {
        String::new()
    } else if key.comment.starts_with(' ') || key.comment.starts_with('\t') {
        key.comment.to_string()
    } else {
        format!(" {}", key.comment)
    };
    format!("{prefix}{}{comment}", format_value(status, quote))
}

/// YAML text for `status`, keeping the old quote style when there was one.
fn format_value(status: &str, quote: Option<char>) -> String {
    match quote {
        Some('\'') => format!("'{}'", status.replace('\'', "''")),
        Some(_) => double_quoted(status),
        None if is_plain_safe(status) => status.to_string(),
        None => double_quoted(status),
    }
}

fn double_quoted(status: &str) -> String {
    format!("\"{}\"", status.replace('\\', "\\\\").replace('"', "\\\""))
}

fn is_plain_safe(status: &str) -> bool {
    let first = status.chars().next().unwrap_or(' ');
    if "-?:,[]{}#&*!|>'\"%@`".contains(first) {
        return false;
    }
    if status.contains(": ") || status.contains(" #") || status.ends_with(':') {
        return false;
    }
    matches!(
        serde_yaml::from_str::<serde_yaml::Value>(status),
        Ok(serde_yaml::Value::String(ref parsed)) if parsed == status
    )
}
