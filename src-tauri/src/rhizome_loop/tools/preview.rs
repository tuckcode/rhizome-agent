//! Unified hunks for an approval card. Added lines keep their own
//! budget so a large deletion cannot hide what will be written.
//! Myers via `similar` with a deadline; leftover hunks become a note.

use std::time::{Duration, Instant};

use similar::{Algorithm, ChangeTag, TextDiff};

pub const MAX_REMOVED: usize = 40;
pub const MAX_ADDED: usize = 40;
pub const CONTEXT: usize = 3;
pub const PREVIEW_TIMEOUT: Duration = Duration::from_millis(250);
pub const TIMEOUT_NOTE: &str = "Preview timed out; showing a coarse whole-file preview";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Preview {
    pub text: String,
    pub notes: Vec<String>,
    pub capped: bool,
}

impl Preview {
    #[cfg(test)]
    pub fn render(&self) -> String {
        let mut out = self.text.clone();
        if !out.ends_with('\n') && !out.is_empty() {
            out.push('\n');
        }
        for note in &self.notes {
            out.push_str(note);
            if !note.ends_with('\n') {
                out.push('\n');
            }
        }
        out
    }
}

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

#[cfg(test)]
pub fn unified(path: &str, before: &str, after: &str) -> String {
    build(path, before, after, PREVIEW_TIMEOUT).render()
}

pub fn build(path: &str, before: &str, after: &str, timeout: Duration) -> Preview {
    let created = before.is_empty() && !after.is_empty();
    let (old_lines, old_nl) = parse(before);
    let (new_lines, new_nl) = parse(after);
    let header = if created {
        format!("--- /dev/null\n+++ {path}\n")
    } else {
        format!("--- {path}\n+++ {path}\n")
    };

    let mut notes = Vec::new();
    if !before.is_empty() && super::text::endings_changed(before, after) {
        notes.push(format!(
            "Line endings change: {} → {}",
            super::text::ending_label(before),
            super::text::ending_label(after)
        ));
    }

    if old_lines == new_lines {
        let mut text = header;
        emit_eof_note(&mut text, created, old_nl, new_nl, after);
        if notes.is_empty() && old_nl == new_nl {
            text.push_str("@@ -0,0 +0,0 @@\n");
        }
        return Preview {
            text,
            notes,
            capped: false,
        };
    }

    let started = Instant::now();
    let old_refs: Vec<&str> = old_lines.iter().map(|line| line.body.as_str()).collect();
    let new_refs: Vec<&str> = new_lines.iter().map(|line| line.body.as_str()).collect();
    let diff = TextDiff::configure()
        .algorithm(Algorithm::Myers)
        .timeout(timeout)
        .diff_slices(&old_refs, &new_refs);

    if started.elapsed() >= timeout {
        return coarse(
            header, &old_lines, &new_lines, created, old_nl, new_nl, after, notes,
        );
    }

    emit_similar(
        header, created, &diff, &old_lines, &new_lines, old_nl, new_nl, after, notes,
    )
}

fn leftover_note(hunks: usize, lines: usize) -> Option<String> {
    if hunks == 0 && lines == 0 {
        return None;
    }
    Some(format!(
        "… {hunks} more hunks / {lines} more lines not shown"
    ))
}

#[allow(clippy::too_many_arguments)]
fn coarse(
    header: String,
    old: &[Line],
    new: &[Line],
    created: bool,
    old_nl: bool,
    new_nl: bool,
    after: &str,
    mut notes: Vec<String>,
) -> Preview {
    let mut text = header;
    let old_count = old.len();
    let new_count = new.len();
    let old_start = if created || old.is_empty() { 0 } else { 1 };
    let new_start = if new.is_empty() { 0 } else { 1 };
    text.push_str(&format!(
        "@@ -{old_start},{old_count} +{new_start},{new_count} @@\n"
    ));
    let mut skipped = 0usize;
    for (index, line) in old.iter().enumerate() {
        if index >= MAX_REMOVED {
            skipped += 1;
            continue;
        }
        text.push('-');
        text.push_str(&line.body);
        text.push('\n');
    }
    for (index, line) in new.iter().enumerate() {
        if index >= MAX_ADDED {
            skipped += 1;
            continue;
        }
        text.push('+');
        text.push_str(&line.body);
        text.push('\n');
    }
    emit_eof_note(&mut text, created, old_nl, new_nl, after);
    notes.push(TIMEOUT_NOTE.to_string());
    if let Some(note) = leftover_note(0, skipped) {
        notes.push(note);
    }
    Preview {
        text,
        notes,
        capped: skipped > 0,
    }
}

#[allow(clippy::too_many_arguments)]
fn emit_similar(
    header: String,
    created: bool,
    diff: &TextDiff<'_, '_, '_, str>,
    old_lines: &[Line],
    new_lines: &[Line],
    old_nl: bool,
    new_nl: bool,
    after: &str,
    mut notes: Vec<String>,
) -> Preview {
    let mut text = header;
    let mut removed_left = MAX_REMOVED;
    let mut added_left = MAX_ADDED;
    let mut leftover_hunks = 0usize;
    let mut leftover_lines = 0usize;
    let mut started = false;

    for group in diff.grouped_ops(CONTEXT) {
        if group.is_empty() {
            continue;
        }
        if started && removed_left == 0 && added_left == 0 {
            leftover_hunks += 1;
            leftover_lines += change_lines(&group, diff);
            continue;
        }
        started = true;
        let hunk = hunk_from_group(&group, diff, created, old_lines, new_lines);
        let skipped = emit_hunk(&mut text, hunk, created, &mut removed_left, &mut added_left);
        leftover_lines += skipped;
    }

    emit_eof_note(&mut text, created, old_nl, new_nl, after);
    let capped = leftover_hunks > 0 || leftover_lines > 0;
    if let Some(note) = leftover_note(leftover_hunks, leftover_lines) {
        notes.push(note);
    }
    Preview {
        text,
        notes,
        capped,
    }
}

fn change_lines(group: &[similar::DiffOp], diff: &TextDiff<'_, '_, '_, str>) -> usize {
    group
        .iter()
        .flat_map(|op| diff.iter_changes(op))
        .filter(|change| change.tag() != ChangeTag::Equal)
        .count()
}

fn hunk_from_group(
    group: &[similar::DiffOp],
    diff: &TextDiff<'_, '_, '_, str>,
    created: bool,
    old_lines: &[Line],
    new_lines: &[Line],
) -> Hunk {
    let first = group[0];
    let old_start_idx = first.old_range().start;
    let new_start_idx = first.new_range().start;
    let mut tagged_old = Vec::new();
    let mut tagged_new = Vec::new();
    for op in group {
        for change in diff.iter_changes(op) {
            let body = change.value().to_string();
            match change.tag() {
                ChangeTag::Equal => {
                    tagged_old.push(Tag {
                        kind: ' ',
                        body: body.clone(),
                    });
                    tagged_new.push(Tag { kind: ' ', body });
                }
                ChangeTag::Delete => tagged_old.push(Tag { kind: '-', body }),
                ChangeTag::Insert => tagged_new.push(Tag { kind: '+', body }),
            }
        }
    }
    Hunk {
        old_start: if created || old_lines.is_empty() {
            0
        } else {
            old_start_idx + 1
        },
        new_start: if new_lines.is_empty() {
            0
        } else {
            new_start_idx + 1
        },
        old: tagged_old,
        new: tagged_new,
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

fn emit_hunk(
    out: &mut String,
    hunk: Hunk,
    created: bool,
    removed_left: &mut usize,
    added_left: &mut usize,
) -> usize {
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

    let mut skipped = 0usize;
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
            skipped += 1;
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
            skipped += 1;
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
    skipped
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
        assert!(diff.contains("more lines not shown"), "{diff}");
        let added = diff
            .lines()
            .filter(|line| line.starts_with('+') && !line.starts_with("+++"))
            .count();
        assert!(added >= 2, "{diff}");
    }

    #[test]
    fn long_new_file_notes_more_added_lines() {
        let after: String = (0..201).map(|i| format!("line{i}\n")).collect();
        let preview = build("fresh.md", "", &after, PREVIEW_TIMEOUT);
        assert!(preview.text.contains("+line0"), "{}", preview.text);
        assert!(preview.capped, "{preview:?}");
        assert!(
            preview
                .notes
                .iter()
                .any(|note| note.contains("more lines not shown")),
            "{preview:?}"
        );
        let added = preview
            .text
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
    fn more_than_forty_hunks_appends_a_leftover_note() {
        let mut before = String::new();
        let mut after = String::new();
        for i in 0..50 {
            for pad in 0..8 {
                let keep = format!("keep{i}_{pad}\n");
                before.push_str(&keep);
                after.push_str(&keep);
            }
            before.push_str(&format!("old{i}\n"));
            after.push_str(&format!("EVIL{i}\n"));
        }
        let preview = build("note.md", &before, &after, PREVIEW_TIMEOUT);
        let evils = preview
            .text
            .lines()
            .filter(|line| line.starts_with("+EVIL"))
            .count();
        assert_eq!(evils, MAX_ADDED, "{}", preview.text);
        assert!(preview.capped);
        assert!(
            preview
                .notes
                .iter()
                .any(|note| note.contains("more hunks") && note.contains("more lines not shown")),
            "{preview:?}"
        );
    }

    #[test]
    fn insert_does_not_invent_fake_pairs() {
        let diff = unified("a.md", "a\nb\nc\n", "a\nX\nb\nc\n");
        assert!(diff.contains("+X"), "{diff}");
        assert!(!diff.contains("-b"), "{diff}");
        assert!(!diff.contains("+b"), "{diff}");
    }

    #[test]
    fn delete_does_not_invent_fake_pairs() {
        let diff = unified("a.md", "a\nX\nb\n", "a\nb\n");
        assert!(diff.contains("-X"), "{diff}");
        assert!(!diff.contains("-b"), "{diff}");
        assert!(!diff.contains("+b"), "{diff}");
    }

    #[test]
    fn preview_deadline_falls_back_to_a_coarse_whole_file() {
        let before: String = (0..80).map(|i| format!("old{i}\n")).collect();
        let after: String = (0..80).map(|i| format!("new{i}\n")).collect();
        let started = Instant::now();
        let preview = build("big.md", &before, &after, Duration::ZERO);
        assert!(
            started.elapsed() < Duration::from_secs(1),
            "deadline fallback must not hang"
        );
        assert!(
            preview.notes.iter().any(|note| note.contains("timed out")),
            "{preview:?}"
        );
        assert!(preview.text.contains("-old0"), "{}", preview.text);
        assert!(preview.text.contains("+new0"), "{}", preview.text);
        assert!(preview.capped);
    }

    #[test]
    fn large_replace_finishes_under_the_live_deadline() {
        let before: String = (0..4000).map(|i| format!("L{i}A\n")).collect();
        let after: String = (0..4000).map(|i| format!("L{i}B\n")).collect();
        let started = Instant::now();
        let preview = build("big.md", &before, &after, PREVIEW_TIMEOUT);
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "similar preview hung: {:?}",
            started.elapsed()
        );
        assert!(preview.text.contains("-L0A"), "{}", preview.text);
        assert!(preview.text.contains("+L0B"), "{}", preview.text);
        assert!(preview.capped);
    }

    #[test]
    fn crlf_only_change_is_visible() {
        let preview = build("a.md", "hello\r\n", "hello\n", PREVIEW_TIMEOUT);
        assert!(
            preview
                .notes
                .iter()
                .any(|note| note.contains("Line endings change: CRLF → LF")),
            "{preview:?}"
        );
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
                    format!("rewrite line {i} of the weekly review\n")
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
            // Git on Windows checks these fixtures out as CRLF. The
            // generator emits LF. Compare the logical text.
            let fixture = fixture.replace("\r\n", "\n");
            assert_eq!(
                diff.trim_end(),
                fixture.trim_end(),
                "{name} shot fixture must match preview::unified"
            );
        }
    }
}
