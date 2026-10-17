//! Unified-style text for an approval card. Caps long diffs so the
//! card stays readable.

pub const MAX_PREVIEW_LINES: usize = 80;

pub fn unified(path: &str, before: &str, after: &str) -> String {
    let old_lines = line_bodies(before);
    let new_lines = line_bodies(after);
    let prefix = common_prefix(&old_lines, &new_lines);
    let suffix = common_suffix(&old_lines[prefix..], &new_lines[prefix..]);
    let old_mid_end = old_lines.len().saturating_sub(suffix);
    let new_mid_end = new_lines.len().saturating_sub(suffix);
    let removed = &old_lines[prefix..old_mid_end];
    let added = &new_lines[prefix..new_mid_end];

    let created = before.is_empty() && !after.is_empty();
    let mut out = if created {
        format!("--- /dev/null\n+++ {path}\n")
    } else {
        format!("--- {path}\n+++ {path}\n")
    };

    let old_start = prefix + 1;
    let new_start = prefix + 1;
    let old_count = removed.len();
    let new_count = added.len();
    out.push_str(&format!(
        "@@ -{old_start},{old_count} +{new_start},{new_count} @@\n"
    ));

    let mut lines_used = 0usize;
    let mut truncated = false;
    for line in removed {
        if lines_used >= MAX_PREVIEW_LINES {
            truncated = true;
            break;
        }
        out.push('-');
        out.push_str(line);
        out.push('\n');
        lines_used += 1;
    }
    if !truncated {
        for line in added {
            if lines_used >= MAX_PREVIEW_LINES {
                truncated = true;
                break;
            }
            out.push('+');
            out.push_str(line);
            out.push('\n');
            lines_used += 1;
        }
    }
    if truncated {
        let leftover = removed.len() + added.len() - lines_used;
        out.push_str(&format!("… {leftover} more lines\n"));
    }
    out
}

fn line_bodies(text: &str) -> Vec<&str> {
    if text.is_empty() {
        return Vec::new();
    }
    let mut lines: Vec<&str> = text.split('\n').collect();
    if text.ends_with('\n') {
        lines.pop();
    }
    lines
        .into_iter()
        .map(|line| line.strip_suffix('\r').unwrap_or(line))
        .collect()
}

fn common_prefix(left: &[&str], right: &[&str]) -> usize {
    left.iter()
        .zip(right.iter())
        .take_while(|(a, b)| a == b)
        .count()
}

fn common_suffix(left: &[&str], right: &[&str]) -> usize {
    left.iter()
        .rev()
        .zip(right.iter().rev())
        .take_while(|(a, b)| a == b)
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_file_preview_is_all_additions() {
        let diff = unified("notes/new.md", "", "hello\nworld\n");
        assert!(diff.contains("--- /dev/null"), "{diff}");
        assert!(diff.contains("+++ notes/new.md"), "{diff}");
        assert!(diff.contains("+hello"), "{diff}");
        assert!(diff.contains("+world"), "{diff}");
    }

    #[test]
    fn edit_preview_shows_removed_and_added_lines() {
        let diff = unified("a.md", "keep\nold\nend\n", "keep\nnew\nend\n");
        assert!(diff.contains("-old"), "{diff}");
        assert!(diff.contains("+new"), "{diff}");
        assert!(!diff.contains("-keep"), "{diff}");
    }

    #[test]
    fn long_preview_is_capped() {
        let before: String = (0..120).map(|i| format!("old{i}\n")).collect();
        let after: String = (0..120).map(|i| format!("new{i}\n")).collect();
        let diff = unified("big.md", &before, &after);
        assert!(diff.contains("more lines"), "{diff}");
        let body_lines = diff
            .lines()
            .filter(|line| {
                (line.starts_with('+') && !line.starts_with("+++"))
                    || (line.starts_with('-') && !line.starts_with("---"))
            })
            .count();
        assert!(body_lines <= MAX_PREVIEW_LINES, "{body_lines}");
    }
}
