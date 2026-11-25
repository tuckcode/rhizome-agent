use std::path::Path;
use std::sync::Mutex;

use crate::engines::native_log;
#[cfg(any(desktop, test))]
use crate::rhizome_loop::{DurableEvent, Model, ModelView};

static TITLE_WRITE: Mutex<()> = Mutex::new(());
const TITLE_LIMIT: usize = 120;

fn read_title_file(path: &Path) -> Option<String> {
    let name = std::fs::read_to_string(path).ok()?;
    let name = name.trim();
    (!name.is_empty() && name.chars().count() <= TITLE_LIMIT).then(|| name.to_owned())
}

pub(super) fn read_title(session_id: &str) -> Option<String> {
    read_title_file(
        &native_log::session_log_path(session_id)
            .ok()?
            .with_extension("title"),
    )
}

fn save_title(log: &Path, name: &str, manual: bool) -> Result<bool, String> {
    let _guard = TITLE_WRITE
        .lock()
        .map_err(|_| "Could not lock chat titles.")?;
    let path = log.with_extension("title");
    if !log.is_file() || (!manual && path.exists()) {
        return Ok(false);
    }
    crate::secure_fs::write_owner_only_atomic(&path, name)?;
    Ok(true)
}

pub(super) fn delete_session(session_id: &str) -> Result<(), String> {
    let _guard = TITLE_WRITE
        .lock()
        .map_err(|_| "Could not lock chat titles.")?;
    native_log::delete_session_log(session_id)?;
    let title = native_log::session_log_path(session_id)?.with_extension("title");
    match std::fs::remove_file(title) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove the chat title: {error}")),
    }
}

#[cfg(desktop)]
pub(super) fn rename(session_id: &str, name: &str) -> Result<(), String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() || name.chars().count() > TITLE_LIMIT {
        return Err(format!(
            "Enter a chat name of 1 to {TITLE_LIMIT} characters."
        ));
    }
    let name = native_log::scrub_secrets(&name);
    let log = native_log::session_log_path(session_id)?;
    save_title(&log, &name, true)?
        .then_some(())
        .ok_or_else(|| "The chat no longer exists.".into())
}

#[cfg(any(desktop, test))]
fn first_exchange(events: &[DurableEvent]) -> Option<(&str, String)> {
    let mut request = None;
    let mut reply = String::new();
    for event in events {
        match event {
            DurableEvent::User { text } => {
                request = Some(text.as_str());
                reply.clear();
            }
            DurableEvent::Assistant { text } => reply.push_str(text),
            DurableEvent::TurnEnd if !reply.trim().is_empty() => {
                if let Some(prompt) = request {
                    return Some((prompt, reply));
                }
            }
            DurableEvent::ModelFailed { .. } | DurableEvent::Cancelled { .. } => {
                request = None;
                reply.clear();
            }
            _ => {}
        }
    }
    None
}

#[cfg(any(desktop, test))]
fn request_title(model: &mut impl Model, prompt: &str, reply: &str) -> Option<String> {
    use crate::model_events::{FinishReason, ModelEvent};

    let admitted = format!(
        "User request:\n{}\n\nAssistant answer:\n{}",
        prompt.chars().take(1600).collect::<String>(),
        reply.chars().take(1600).collect::<String>(),
    );
    let view = ModelView {
        admitted,
        history: Vec::new(),
        offered_tools: Vec::new(),
        turn_start: 0,
    };
    let mut answer = String::new();
    let mut finished = false;
    model.complete(&view, &mut |event| {
        match event {
            ModelEvent::TextDelta { text } => {
                answer.extend(text.chars().take(256));
                if answer.chars().count() >= 256 {
                    return false;
                }
            }
            ModelEvent::Finish {
                reason: FinishReason::Stop,
            } => finished = true,
            _ => {}
        }
        true
    });
    let line = answer.trim().lines().next()?;
    let title = line.trim_matches(|c: char| {
        c.is_whitespace() || matches!(c, '"' | '\'' | '`' | '.' | '!' | '?' | '*' | '#')
    });
    (finished && !title.is_empty() && title.chars().count() <= 48).then(|| title.to_owned())
}

#[cfg(desktop)]
pub(super) fn generate(session_id: &str) -> Result<Option<bool>, String> {
    use super::{
        catalog_request, free_tier_routing_model, resolve_native_target, NativeChatTarget,
    };
    use crate::ai_models::HttpLimits;
    use crate::rhizome_provider_model::ProviderModel;

    if read_title(session_id).is_some() {
        return Ok(None);
    }
    let opened = native_log::open_session_log(session_id)?;
    let Some((prompt, reply)) = first_exchange(&opened.events) else {
        return Ok(None);
    };
    let instruction = Some(
        include_str!("../../../../shared/chat-title-prompt.txt")
            .trim()
            .to_owned(),
    );
    let generated = match resolve_native_target(&opened.header.target)? {
        // Claude Code runs only turns the user sends. Keep this exchange local.
        NativeChatTarget::ClaudeCode => None,
        NativeChatTarget::FreeTier => free_tier_routing_model(instruction, |_| {})
            .ok()
            .and_then(|mut model| request_title(&mut model, prompt, &reply)),
        NativeChatTarget::Catalog {
            provider_kind,
            provider_id,
            model_id,
        } => catalog_request(provider_kind, &provider_id, model_id, instruction)
            .ok()
            .and_then(|request| {
                request_title(
                    &mut ProviderModel::new(request, HttpLimits::DISCOVER),
                    prompt,
                    &reply,
                )
            }),
    };
    let model_written = generated.is_some();
    let title = generated.unwrap_or_else(|| {
        prompt
            .split_whitespace()
            .take(6)
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(48)
            .collect()
    });
    let title = native_log::scrub_secrets(&title);
    if title.trim().is_empty() {
        return Ok(None);
    }
    let log = native_log::session_log_path(session_id)?;
    Ok(save_title(&log, &title, false)?.then_some(model_written))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rhizome_loop::FakeModel;

    #[test]
    fn uses_the_first_complete_exchange_and_skips_partial_replies() {
        use DurableEvent::{Assistant, Cancelled, TurnEnd, User};
        let events = [
            User {
                text: "Abandoned request".into(),
            },
            Assistant {
                text: "Partial reply".into(),
            },
            Cancelled {
                cause: "user".into(),
            },
            User {
                text: "Plan the release".into(),
            },
            Assistant {
                text: "Set a date".into(),
            },
            TurnEnd,
            User {
                text: "Later request".into(),
            },
            Assistant {
                text: "Later reply".into(),
            },
            TurnEnd,
        ];
        assert_eq!(
            first_exchange(&events),
            Some(("Plan the release", "Set a date".into()))
        );
    }

    #[test]
    fn takes_a_short_title_from_the_model() {
        let mut model = FakeModel::saying("\"Release schedule.\"\nMore text");
        assert_eq!(
            request_title(&mut model, "Plan the release", "Set a date").as_deref(),
            Some("Release schedule")
        );
    }

    #[test]
    fn manual_title_wins_before_or_after_automatic_naming() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("session.jsonl");
        let title = log.with_extension("title");
        assert!(!save_title(&log, "Missing session", false).unwrap());
        std::fs::write(&log, "").unwrap();
        assert!(save_title(&log, "Generated name", false).unwrap());
        assert!(save_title(&log, "Manual name", true).unwrap());
        assert!(!save_title(&log, "Late result", false).unwrap());
        assert_eq!(read_title_file(&title).as_deref(), Some("Manual name"));
    }
}
