//! Unified hunks for an approval card. Added lines keep their own
//! budget so a large deletion cannot hide what will be written.

pub const MAX_REMOVED: usize = 40;
pub const MAX_ADDED: usize = 40;
pub const CONTEXT: usize = 3;
const RESYNC_WINDOW: usize = 2_000;

#[derive(Clone, Debug, PartialEq, Eq)]
struct Line {
    body: String,
}

struct Hunk {
    old_start: usize,
    new_start: usize,
    old: Vec<Tag>,
    new: Vec<Tag>,
}

#[derive(Clone)]
struct Tag {
    kind: char,
    body: String,
}

pub fn unified(path: &str, before: &str, after: &str) -> String {
    let created = before.is_empty() && !after.is_empty();
    let (old_lines, old_nl) = parse(before);
    let (new_lines, new_nl) = parse(after);
    let old_crlf = super::text::uses_crlf(before);
    let new_crlf = super::text::uses_crlf(after);

    let mut out = if created {
        format!("--- /dev/null\n+++ {path}\n")
    } else {
        format!("--- {path}\n+++ {path}\n")
    };

    if old_lines == new_lines {
        if old_crlf != new_crlf {
            out.push_str(&format!(
                "Line endings change: {} → {}\n",
                ending_name(old_crlf),
                ending_name(new_crlf)
            ));
        }
        emit_eof_note(&mut out, created, old_nl, new_nl, after);
        if old_crlf == new_crlf && old_nl == new_nl {
            out.push_str("@@ -0,0 +0,0 @@\n");
        }
        return out;
    }

    let hunks = split_hunks(&old_lines, &new_lines);
    let mut removed_left = MAX_REMOVED;
    let mut added_left = MAX_ADDED;
    for hunk in hunks {
        if removed_left == 0 && added_left == 0 {
            break;
        }
        emit_hunk(&mut out, hunk, created, &mut removed_left, &mut added_left);
    }
    if old_crlf != new_crlf {
        out.push_str(&format!(
            "Line endings change: {} → {}\n",
            ending_name(old_crlf),
            ending_name(new_crlf)
        ));
    }
    emit_eof_note(&mut out, created, old_nl, new_nl, after);
    out
}

fn ending_name(crlf: bool) -> &'static str {
    if crlf {
        "CRLF"
    } else {
        "LF"
    }
}

fn emit_eof_note(out: &mut String, created: bool, old_nl: bool, new_nl: bool, after: &str) {
    if created {
        if !after.is_empty() && !new_nl {
            out.push_str("\\ No newline at end of file\n");
        }
        return;
    }
    if old_nl && !new_nl {
        out.push_str("\\ No newline at end of file\n");
    } else if !old_nl && new_nl {
        out.push_str("\\ Newline added at end of file\n");
    }
}

fn parse(text: &str) -> (Vec<Line>, bool) {
    if text.is_empty() {
        return (Vec::new(), false);
    }
    let trailing_nl = text.ends_with('\n');
    let stripped = if trailing_nl {
        &text[..text.len() - 1]
    } else {
        text
    };
    let lines = stripped
        .split('\n')
        .map(|raw| Line {
            body: raw.strip_suffix('\r').unwrap_or(raw).to_string(),
        })
        .collect();
    (lines, trailing_nl)
}

fn split_hunks(old: &[Line], new: &[Line]) -> Vec<Hunk> {
    let mut hunks = Vec::new();
    let mut i = 0usize;
    let mut j = 0usize;
    while i < old.len() || j < new.len() {
        while i < old.len() && j < new.len() && old[i] == new[j] {
            i += 1;
            j += 1;
        }
        if i >= old.len() && j >= new.len() {
            break;
        }
        let old_from = i;
        let new_from = j;
        let (old_to, new_to) = match find_resync(old, new, i, j) {
            Some(pair) => pair,
            None => (old.len(), new.len()),
        };
        let ctx_before = CONTEXT.min(old_from).min(new_from);
        let old_start = old_from - ctx_before;
        let new_start = new_from - ctx_before;
        let mut tagged_old = Vec::new();
        let mut tagged_new = Vec::new();
        for line in &old[old_start..old_from] {
            tagged_old.push(Tag {
                kind: ' ',
                body: line.body.clone(),
            });
        }
        for line in &new[new_start..new_from] {
            tagged_new.push(Tag {
                kind: ' ',
                body: line.body.clone(),
            });
        }
        for line in &old[old_from..old_to] {
            tagged_old.push(Tag {
                kind: '-',
                body: line.body.clone(),
            });
        }
        for line in &new[new_from..new_to] {
            tagged_new.push(Tag {
                kind: '+',
                body: line.body.clone(),
            });
        }
        let ctx_after_old = CONTEXT.min(old.len().saturating_sub(old_to));
        let ctx_after_new = CONTEXT.min(new.len().saturating_sub(new_to));
        let ctx_after = ctx_after_old.min(ctx_after_new);
        for line in &old[old_to..old_to + ctx_after] {
            tagged_old.push(Tag {
                kind: ' ',
                body: line.body.clone(),
            });
        }
        for line in &new[new_to..new_to + ctx_after] {
            tagged_new.push(Tag {
                kind: ' ',
                body: line.body.clone(),
            });
        }
        hunks.push(Hunk {
            old_start: if old.is_empty() { 0 } else { old_start + 1 },
            new_start: if new.is_empty() { 0 } else { new_start + 1 },
            old: tagged_old,
            new: tagged_new,
        });
        i = old_to + ctx_after;
        j = new_to + ctx_after;
    }
    hunks
}

fn find_resync(old: &[Line], new: &[Line], i: usize, j: usize) -> Option<(usize, usize)> {
    let old_limit = old.len().min(i.saturating_add(RESYNC_WINDOW));
    let new_limit = new.len().min(j.saturating_add(RESYNC_WINDOW));
    for finger in [3, 2, 1] {
        if old_limit.saturating_sub(i) < finger || new_limit.saturating_sub(j) < finger {
            continue;
        }
        for k in i + 1..=old_limit.saturating_sub(finger) {
            for l in j + 1..=new_limit.saturating_sub(finger) {
                if old[k..k + finger] == new[l..l + finger] {
                    return Some((k, l));
                }
            }
        }
    }
    None
}

fn emit_hunk(
    out: &mut String,
    hunk: Hunk,
    created: bool,
    removed_left: &mut usize,
    added_left: &mut usize,
) {
    let old_count = hunk.old.iter().filter(|line| line.kind != '+').count();
    let new_count = hunk.new.iter().filter(|line| line.kind != '-').count();
    let old_start = if created || hunk.old.iter().all(|line| line.kind != '-') && old_count == 0 {
        0
    } else {
        hunk.old_start
    };
    out.push_str(&format!(
        "@@ -{old_start},{old_count} +{},{new_count} @@\n",
        hunk.new_start
    ));

    let mut skipped_removed = 0usize;
    let mut skipped_added = 0usize;
    let first_change = hunk
        .old
        .iter()
        .position(|line| line.kind == '-')
        .unwrap_or(hunk.old.len());
    let last_change = hunk
        .old
        .iter()
        .rposition(|line| line.kind == '-')
        .unwrap_or(first_change.saturating_sub(1));
    let leading = &hunk.old[..first_change];
    let removed = if first_change < hunk.old.len() {
        &hunk.old[first_change..=last_change]
    } else {
        &[]
    };
    let trailing = if first_change < hunk.old.len() {
        &hunk.old[last_change + 1..]
    } else {
        &[]
    };

    for line in leading {
        out.push(' ');
        out.push_str(&line.body);
        out.push('\n');
    }
    for line in removed {
        if line.kind != '-' {
            continue;
        }
        if *removed_left == 0 {
            skipped_removed += 1;
            continue;
        }
        *removed_left -= 1;
        out.push('-');
        out.push_str(&line.body);
        out.push('\n');
    }
    for line in &hunk.new {
        if line.kind != '+' {
            continue;
        }
        if *added_left == 0 {
            skipped_added += 1;
            continue;
        }
        *added_left -= 1;
        out.push('+');
        out.push_str(&line.body);
        out.push('\n');
    }
    for line in trailing {
        out.push(' ');
        out.push_str(&line.body);
        out.push('\n');
    }
    if skipped_removed > 0 {
        out.push_str(&format!("… {skipped_removed} more removed lines\n"));
    }
    if skipped_added > 0 {
        out.push_str(&format!("… {skipped_added} more added lines\n"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_file_preview_is_all_additions() {
        let diff = unified("notes/new.md", "", "hello\nworld\n");
        assert!(diff.contains("--- /dev/null"), "{diff}");
        assert!(diff.contains("+++ notes/new.md"), "{diff}");
        assert!(diff.contains("@@ -0,0 +1,2 @@"), "{diff}");
        assert!(diff.contains("+hello"), "{diff}");
        assert!(diff.contains("+world"), "{diff}");
        assert!(
            !diff.contains("Newline added"),
            "a new file with a trailing newline is normal: {diff}"
        );
    }

    #[test]
    fn new_file_header_is_zero_zero_not_one_zero() {
        let diff = unified("a.md", "", "x\n");
        assert!(diff.contains("@@ -0,0 +1,1 @@"), "{diff}");
        assert!(!diff.contains("@@ -1,0"), "{diff}");
    }

    #[test]
    fn edit_preview_shows_removed_and_added_lines() {
        let diff = unified("a.md", "keep\nold\nend\n", "keep\nnew\nend\n");
        assert!(diff.contains("-old"), "{diff}");
        assert!(diff.contains("+new"), "{diff}");
        assert!(diff.contains(" keep"), "{diff}");
        let lines: Vec<&str> = diff.lines().collect();
        let minus = lines
            .iter()
            .position(|line| *line == "-old")
            .expect("{diff}");
        let plus = lines
            .iter()
            .position(|line| *line == "+new")
            .expect("{diff}");
        let after = lines
            .iter()
            .position(|line| *line == " end")
            .expect("{diff}");
        assert!(minus < plus, "{diff}");
        assert!(plus < after, "{diff}");
    }

    #[test]
    fn added_lines_show_when_removed_would_fill_the_old_cap() {
        let before: String = (0..120).map(|i| format!("old{i}\n")).collect();
        let after = "MALICIOUS\nrm -rf ~\n".to_string();
        let diff = unified("big.md", &before, &after);
        assert!(diff.contains("+MALICIOUS"), "{diff}");
        assert!(diff.contains("+rm -rf ~"), "{diff}");
        assert!(diff.contains("more removed lines"), "{diff}");
        let added = diff
            .lines()
            .filter(|line| line.starts_with('+') && !line.starts_with("+++"))
            .count();
        assert!(added >= 2, "{diff}");
    }

    #[test]
    fn long_new_file_notes_more_added_lines() {
        let after: String = (0..201).map(|i| format!("line{i}\n")).collect();
        let diff = unified("fresh.md", "", &after);
        assert!(diff.contains("+line0"), "{diff}");
        assert!(diff.contains("more added lines"), "{diff}");
        let added = diff
            .lines()
            .filter(|line| line.starts_with('+') && !line.starts_with("+++"))
            .count();
        assert!(added <= MAX_ADDED, "{added}");
    }

    #[test]
    fn distant_replace_all_keeps_both_additions() {
        let mut before = vec!["keep 1".to_string()];
        before.extend((0..200).map(|i| format!("mid{i}")));
        before.push("keep 202".into());
        let mut after = before.clone();
        after[0] = "EVIL".into();
        after[201] = "EVIL".into();
        let before = before.join("\n") + "\n";
        let after = after.join("\n") + "\n";
        let diff = unified("note.md", &before, &after);
        let evils = diff.lines().filter(|line| *line == "+EVIL").count();
        assert_eq!(evils, 2, "{diff}");
    }

    #[test]
    fn crlf_only_change_is_visible() {
        let diff = unified("a.md", "hello\r\n", "hello\n");
        assert!(diff.contains("Line endings change: CRLF → LF"), "{diff}");
    }

    #[test]
    fn trailing_newline_only_change_is_visible() {
        let diff = unified("a.md", "hello\n", "hello");
        assert!(diff.contains("No newline at end of file"), "{diff}");
    }

    #[test]
    fn adding_a_trailing_newline_is_visible() {
        let diff = unified("a.md", "hello", "hello\n");
        assert!(diff.contains("Newline added at end of file"), "{diff}");
    }

    pub fn review_shot_edit() -> String {
        unified(
            "notes/plan.md",
            "Stay on course.\nKeep the intro.\nShip the read tools first.\nKeep the rest of the note.\nEnd of the page.\n",
            "Stay on course.\nKeep the intro.\nShip the edit tools after the read tools.\nKeep the rest of the note.\nEnd of the page.\n",
        )
    }

    pub fn review_shot_new() -> String {
        unified(
            "notes/fresh.md",
            "",
            "# Fresh note\n\nThe agent wants to create this file in the vault.\nKeep the parent folders inside the workspace root.\n",
        )
    }

    pub fn review_shot_overwrite() -> String {
        let before: String = (0..12)
            .map(|i| format!("old line {i} of the weekly review\n"))
            .collect();
        unified(
            "notes/weekly-review.md",
            &before,
            "MALICIOUS\nrm -rf ~\nrewritten body\n",
        )
    }

    pub fn review_shot_long() -> String {
        let before: String = (0..36)
            .map(|i| format!("keep line {i} of the weekly review\n"))
            .collect();
        let after: String = (0..36)
            .map(|i| {
                if (8..30).contains(&i) {
                    format!("rewrite line {i} so the card scrolls\n")
                } else {
                    format!("keep line {i} of the weekly review\n")
                }
            })
            .collect();
        unified("notes/weekly-review.md", &before, &after)
    }

    #[test]
    fn review_shot_fixtures_match_unified() {
        let cases = [
            (
                "edit",
                review_shot_edit(),
                include_str!("../../../../scripts/edit-tools-previews/edit.diff"),
            ),
            (
                "new",
                review_shot_new(),
                include_str!("../../../../scripts/edit-tools-previews/new.diff"),
            ),
            (
                "overwrite",
                review_shot_overwrite(),
                include_str!("../../../../scripts/edit-tools-previews/overwrite.diff"),
            ),
            (
                "long",
                review_shot_long(),
                include_str!("../../../../scripts/edit-tools-previews/long.diff"),
            ),
        ];
        for (name, diff, fixture) in cases {
            assert_eq!(
                diff.trim_end(),
                fixture.trim_end(),
                "{name} shot fixture must match preview::unified"
            );
        }
    }
}
