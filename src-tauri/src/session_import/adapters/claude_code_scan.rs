//! Finding Claude Code's session logs on disk.
//!
//! Separate from the parser so the parser stays a pure function over text and
//! this stays the only part that touches the filesystem. Both are read-only:
//! `~/.claude/projects` is another tool's directory, and nothing here writes,
//! moves, or deletes anything in it — same principle as `prime_sessions`.
//!
//! Layout, verified on 2026-09-05: `~/.claude/projects/<project-slug>/<uuid>.jsonl`,
//! where the slug is the project's path with separators replaced by dashes.

use std::path::{Path, PathBuf};

use crate::session_import::adapters::claude_code::{parse_session_jsonl, ParsedSession};
use crate::session_import::selection::SelectionInput;

/// One discovered session: where it came from and what it holds.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScannedSession {
    /// Project folder name — the grouping key selection caps against.
    pub project_key: String,
    pub path: PathBuf,
    pub session: ParsedSession,
}

impl ScannedSession {
    pub fn selection_input(&self) -> SelectionInput {
        SelectionInput {
            project_key: self.project_key.clone(),
            source_session_id: self.session.source_session_id.clone(),
            message_count: self.session.messages.len(),
            character_count: self
                .session
                .messages
                .iter()
                .map(|message| message.content.chars().count())
                .sum(),
            last_active: self
                .session
                .date_span
                .map(|span| span.last_day)
                .unwrap_or(i64::MIN),
        }
    }
}

/// Default location of Claude Code's session logs.
pub fn default_projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".claude").join("projects"))
}

/// Read every session log under a projects directory.
///
/// A missing directory is "Claude Code is not installed here", not an error —
/// import offers what it finds and stays quiet about what it does not. Files
/// that cannot be read or hold no conversation are skipped for the same reason
/// the parser skips a bad line: one unreadable log must not cost the user the
/// other three hundred.
pub fn scan_projects_dir(root: &Path) -> Vec<ScannedSession> {
    let Ok(projects) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut found = Vec::new();
    for project in projects.flatten() {
        let project_key = project.file_name().to_string_lossy().into_owned();
        let Ok(entries) = std::fs::read_dir(project.path()) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
                continue;
            }
            let Ok(contents) = std::fs::read_to_string(&path) else {
                continue;
            };
            if let Some(session) = parse_session_jsonl(&contents) {
                found.push(ScannedSession {
                    project_key: project_key.clone(),
                    path,
                    session,
                });
            }
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_session(root: &Path, project: &str, name: &str, lines: &[String]) {
        let dir = root.join(project);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(name), lines.join("\n")).unwrap();
    }

    fn exchange(session: &str, text: &str) -> Vec<String> {
        vec![
            serde_json::json!({
                "type": "user",
                "sessionId": session,
                "timestamp": "2026-08-30T14:56:14.799Z",
                "cwd": "/Users/dtc/code",
                "isSidechain": false,
                "message": { "role": "user", "content": text },
            })
            .to_string(),
            serde_json::json!({
                "type": "assistant",
                "sessionId": session,
                "timestamp": "2026-08-30T14:56:20.000Z",
                "isSidechain": false,
                "message": { "role": "assistant", "content": [{ "type": "text", "text": "Sure." }] },
            })
            .to_string(),
        ]
    }

    #[test]
    fn finds_sessions_and_groups_them_by_project_folder() {
        let dir = tempfile::TempDir::new().unwrap();
        write_session(dir.path(), "project-a", "s1.jsonl", &exchange("s1", "one"));
        write_session(dir.path(), "project-a", "s2.jsonl", &exchange("s2", "two"));
        write_session(
            dir.path(),
            "project-b",
            "s3.jsonl",
            &exchange("s3", "three"),
        );

        let mut found = scan_projects_dir(dir.path());
        found.sort_by(|left, right| {
            left.session
                .source_session_id
                .cmp(&right.session.source_session_id)
        });

        assert_eq!(found.len(), 3);
        assert_eq!(found[0].project_key, "project-a");
        assert_eq!(found[2].project_key, "project-b");
    }

    /// A fresh machine has no Claude Code. That is not an error to report.
    #[test]
    fn returns_nothing_when_claude_code_was_never_installed() {
        let dir = tempfile::TempDir::new().unwrap();

        assert!(scan_projects_dir(&dir.path().join("absent")).is_empty());
        assert!(scan_projects_dir(dir.path()).is_empty());
    }

    #[test]
    fn ignores_files_that_are_not_session_logs() {
        let dir = tempfile::TempDir::new().unwrap();
        write_session(dir.path(), "project-a", "s1.jsonl", &exchange("s1", "kept"));
        std::fs::write(
            dir.path().join("project-a").join("notes.md"),
            "not a session",
        )
        .unwrap();
        std::fs::write(dir.path().join("project-a").join("config.json"), "{}").unwrap();

        assert_eq!(scan_projects_dir(dir.path()).len(), 1);
    }

    /// One unreadable or empty log must not cost the user the others.
    #[test]
    fn skips_logs_with_no_conversation_and_keeps_going() {
        let dir = tempfile::TempDir::new().unwrap();
        write_session(dir.path(), "project-a", "empty.jsonl", &[]);
        write_session(
            dir.path(),
            "project-a",
            "metadata.jsonl",
            &[r#"{"type":"mode","sessionId":"m","mode":"default"}"#.to_string()],
        );
        write_session(
            dir.path(),
            "project-a",
            "real.jsonl",
            &exchange("real", "kept"),
        );

        let found = scan_projects_dir(dir.path());

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].session.source_session_id, "real");
    }

    #[test]
    fn describes_a_session_for_the_selection_policy() {
        let dir = tempfile::TempDir::new().unwrap();
        write_session(
            dir.path(),
            "project-a",
            "s1.jsonl",
            &exchange("s1", "hello there"),
        );

        let found = scan_projects_dir(dir.path());
        let input = found[0].selection_input();

        assert_eq!(input.project_key, "project-a");
        assert_eq!(input.source_session_id, "s1");
        assert_eq!(input.message_count, 2);
        // "hello there" + "Sure."
        assert_eq!(input.character_count, 16);
        assert!(input.last_active > 0);
    }
}
