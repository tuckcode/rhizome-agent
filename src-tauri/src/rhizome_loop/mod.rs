//! Rhizome-owned agent loop (ADR-0180, harness plan Phases 1–2.5).
//!
//! Chat does not call this module. The engine toggle is Phase 6.
//! One inbox, one turn at a time. A step is one model request plus
//! the tools it called. The loop consumes `ModelEvent`. Cancel stops
//! reading; the model has no `Cancelled` event. Tool-call `id`s stay
//! on the history items that go back to the model.
//! Allow-once is spent for echo. Read-only file tools (`read_file`,
//! `list_dir`, `grep`, `glob`) auto-run in both modes. `edit_file` and
//! `write_file` ask in both modes unless a session grant covers that
//! tool and path. `create_note` is offered in both modes: Limited
//! tools asks every call (Allow once and Deny); Power User runs it
//! with no prompt. Power User bash asks every call. There is no
//! session grant. Unknown tools always ask and
//! never match a session grant. Quit is `stop_and_drain`.
//! The turn / inbox vocabulary is the DeepSeek Harness idea. No DeepSeek
//! code is copied.

mod driver;
#[cfg(test)]
mod fake_model;
mod model;
mod policy;
mod tools;
mod types;

pub use driver::{AgentLoop, ApprovalReply, DEFAULT_STEP_CAP};
#[cfg(test)]
pub use fake_model::{FakeModel, ScriptPart};
pub use model::Model;
pub use policy::{approval_options, ApprovalOption};
#[cfg(test)]
pub(crate) use tools::command_from_args;
#[cfg(test)]
pub(crate) use tools::override_secret_block;
pub use tools::resolve_for_write;
pub(crate) use tools::write_atomic;
pub(crate) use tools::{allowed_roots, preflight, relative_to_root, resolve_file_for_write};
pub(crate) use tools::{openai_tool_definition, require_mutate_card};
pub(crate) use tools::{write_target_is_secret, BLOCKED_SECRET};
pub use types::{DurableEvent, HistoryItem, ModelView, ToolCall, UNANSWERED_TOOL_OUTPUT};

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::mpsc;
    use std::sync::{Arc, Mutex};
    use std::thread;
    use std::time::Duration;

    use super::{
        AgentLoop, ApprovalReply, DurableEvent, FakeModel, HistoryItem, Model, ModelView,
        ScriptPart, ToolCall, DEFAULT_STEP_CAP, UNANSWERED_TOOL_OUTPUT,
    };
    use crate::ai_agents::AiAgentPermissionMode;
    use crate::model_events::{FinishReason, ModelError, ModelErrorKind, ModelEvent};

    #[test]
    fn one_user_message_yields_one_assistant_and_turn_end() {
        let agent = AgentLoop::new();
        let mut model = FakeModel::saying("ok");
        agent.submit("hi");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User { text: "hi".into() },
                DurableEvent::Assistant { text: "ok".into() },
                DurableEvent::TurnEnd,
            ]
        );
    }

    #[test]
    fn cancel_stops_before_a_second_chunk() {
        let agent = AgentLoop::new();
        let cancel = agent.clone();
        let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
        model.on_after_chunk(move |index| {
            if index == 0 {
                cancel.cancel("quit");
            }
        });
        agent.submit("hello");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User {
                    text: "hello".into(),
                },
                DurableEvent::Assistant { text: "one".into() },
                DurableEvent::Cancelled {
                    cause: "quit".into(),
                },
            ]
        );
    }

    #[test]
    fn follow_up_waits_until_idle() {
        let agent = AgentLoop::new();
        let probe = agent.clone();
        let mut model = FakeModel::streaming(vec![vec!["from-a".into()], vec!["from-b".into()]]);
        model.on_after_chunk(move |index| {
            if index != 0 {
                return;
            }
            let events = probe.events();
            let first_turn_open = !events
                .iter()
                .any(|event| matches!(event, DurableEvent::TurnEnd));
            if !first_turn_open {
                return;
            }
            assert!(
                !events
                    .iter()
                    .any(|event| matches!(event, DurableEvent::User { text } if text == "B")),
                "B must stay in the inbox until A's turn ends"
            );
            probe.submit("B");
        });
        agent.submit("A");
        agent.run_until_idle(&mut model);

        assert_eq!(
            model.seen,
            vec![
                ModelView {
                    admitted: "A".into(),
                    history: vec![],
                    turn_start: 0,
                    offered_tools: super::policy::offered_tools(AiAgentPermissionMode::Safe),
                },
                ModelView {
                    admitted: "B".into(),
                    history: vec![
                        HistoryItem::User { text: "A".into() },
                        HistoryItem::Assistant {
                            text: "from-a".into(),
                            tool_calls: vec![],
                        },
                    ],
                    turn_start: 2,
                    offered_tools: super::policy::offered_tools(AiAgentPermissionMode::Safe),
                },
            ]
        );
        let events = agent.events();
        let turn_end = events
            .iter()
            .position(|event| matches!(event, DurableEvent::TurnEnd))
            .expect("turn end");
        let user_b = events
            .iter()
            .position(|event| matches!(event, DurableEvent::User { text } if text == "B"))
            .expect("user B");
        assert!(turn_end < user_b);
    }

    #[test]
    fn idle_means_inbox_empty_and_no_step() {
        let agent = AgentLoop::new();
        let probe = agent.clone();
        let saw_step = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&saw_step);
        let mut model = FakeModel::saying("ok");
        model.on_after_chunk(move |_| {
            // The admitted message is already out of the inbox. Idle is
            // still false because the step is running.
            assert!(!probe.when_idle());
            flag.store(true, Ordering::SeqCst);
        });
        agent.submit("A");
        agent.run_until_idle(&mut model);

        assert!(saw_step.load(Ordering::SeqCst), "the step never ran");
        assert!(agent.when_idle());
    }

    #[test]
    fn cancel_then_next_turn_reaches_turn_end() {
        let agent = AgentLoop::new();
        agent.cancel("stray");
        let cancel = agent.clone();
        let once = Arc::new(AtomicBool::new(false));
        let armed = Arc::clone(&once);
        let mut model =
            FakeModel::streaming(vec![vec!["one".into(), "two".into()], vec!["bee".into()]]);
        model.on_after_chunk(move |index| {
            if index == 0 && !armed.swap(true, Ordering::SeqCst) {
                cancel.cancel("quit");
            }
        });
        agent.submit("A");
        agent.submit("B");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User { text: "A".into() },
                DurableEvent::Assistant { text: "one".into() },
                DurableEvent::Cancelled {
                    cause: "quit".into(),
                },
                DurableEvent::User { text: "B".into() },
                DurableEvent::Assistant { text: "bee".into() },
                DurableEvent::TurnEnd,
            ]
        );
    }

    #[test]
    fn cancel_before_first_chunk_omits_assistant() {
        let agent = AgentLoop::new();
        let cancel = agent.clone();
        let mut model = FakeModel::saying("secret");
        model.on_before_chunk(move |index| {
            if index == 0 {
                cancel.cancel("quit");
            }
        });
        agent.submit("hello");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User {
                    text: "hello".into(),
                },
                DurableEvent::Cancelled {
                    cause: "quit".into(),
                },
            ]
        );
    }

    #[test]
    fn tool_then_text_completes_one_turn() {
        let agent = AgentLoop::new();
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "echo".into(),
                args: "ping".into(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("hi");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User { text: "hi".into() },
                DurableEvent::ToolCall {
                    id: "call_1".into(),
                    name: "echo".into(),
                    args: "ping".into(),
                },
                DurableEvent::ToolResult {
                    id: "call_1".into(),
                    name: "echo".into(),
                    output: "ping".into(),
                },
                DurableEvent::Assistant {
                    text: "done".into()
                },
                DurableEvent::TurnEnd,
            ]
        );
        assert!(model.seen.len() >= 2);
        assert_eq!(
            model.seen[1].history,
            vec![
                HistoryItem::Assistant {
                    text: String::new(),
                    tool_calls: vec![ToolCall {
                        id: "call_1".into(),
                        name: "echo".into(),
                        args: "ping".into(),
                    }],
                },
                HistoryItem::ToolResult {
                    id: "call_1".into(),
                    name: "echo".into(),
                    output: "ping".into(),
                },
            ]
        );
    }

    #[test]
    fn step_two_history_starts_with_the_assistant_tool_call() {
        let agent = AgentLoop::new();
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "echo".into(),
                args: "ping".into(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("hi");
        agent.run_until_idle(&mut model);

        assert!(
            model.seen.len() >= 2,
            "the tool round must be followed by a text round"
        );
        let first = model.seen[1]
            .history
            .first()
            .expect("step two must see history");
        assert!(
            matches!(first, HistoryItem::Assistant { .. }),
            "step order: the model must see its own tool call before the result, got {first:?}"
        );
    }

    #[test]
    fn read_only_file_tools_run_without_approval_and_are_offered() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        std::fs::write(root.join("note.md"), "hello rhizome\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::Deny
        });
        let mut model = FakeModel::script(vec![
            vec![
                ScriptPart::Tool {
                    name: "read_file".into(),
                    args: serde_json::json!({ "path": "note.md" }).to_string(),
                },
                ScriptPart::Tool {
                    name: "list_dir".into(),
                    args: serde_json::json!({ "path": "." }).to_string(),
                },
                ScriptPart::Tool {
                    name: "grep".into(),
                    args: serde_json::json!({ "pattern": "hello" }).to_string(),
                },
                ScriptPart::Tool {
                    name: "glob".into(),
                    args: serde_json::json!({ "pattern": "*.md" }).to_string(),
                },
            ],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("look");
        agent.run_until_idle(&mut model);

        assert!(
            !asked.load(Ordering::SeqCst),
            "read-only tools must not open an approval card: {:?}",
            agent.events()
        );
        let offered = &model.seen[0].offered_tools;
        for name in ["read_file", "list_dir", "grep", "glob"] {
            assert!(
                offered.iter().any(|offered| offered == name),
                "registry must offer {name}: {offered:?}"
            );
        }
        let results: Vec<(String, String)> = agent
            .events()
            .into_iter()
            .filter_map(|event| match event {
                DurableEvent::ToolResult { name, output, .. } => Some((name, output)),
                _ => None,
            })
            .collect();
        assert_eq!(results.len(), 4, "all four tools must run: {results:?}");
        assert_eq!(results[0].0, "read_file");
        assert!(results[0].1.contains("hello rhizome"), "{:?}", results[0]);
        assert_eq!(results[1].0, "list_dir");
        assert!(results[1].1.contains("file note.md"), "{:?}", results[1]);
        assert_eq!(results[2].0, "grep");
        assert!(
            results[2].1.contains("note.md:1:hello rhizome"),
            "{:?}",
            results[2]
        );
        assert_eq!(results[3].0, "glob");
        assert!(results[3].1.contains("note.md"), "{:?}", results[3]);
    }

    #[test]
    fn mutate_tools_ask_before_writing_in_both_modes() {
        for mode in [
            AiAgentPermissionMode::Safe,
            AiAgentPermissionMode::PowerUser,
        ] {
            let vault = tempfile::tempdir().unwrap();
            let root = vault.path().canonicalize().unwrap();
            let dest = root.join("note.md");
            std::fs::write(&dest, "keep\n").unwrap();
            let agent = AgentLoop::new();
            agent.set_permission_mode(mode);
            agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
            let asked = Arc::new(AtomicBool::new(false));
            let flag = Arc::clone(&asked);
            let note_path = dest.clone();
            agent.set_approval_waiter(move |name, _| {
                assert!(name == "write_file" || name == "edit_file", "{name}");
                assert_eq!(std::fs::read_to_string(&note_path).unwrap(), "keep\n");
                flag.store(true, Ordering::SeqCst);
                ApprovalReply::Deny
            });
            let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
                name: "write_file".into(),
                args: serde_json::json!({ "path": "note.md", "content": "no\n" }).to_string(),
            }]]);
            agent.submit("overwrite");
            agent.run_until_idle(&mut model);
            assert!(
                asked.load(Ordering::SeqCst),
                "{mode:?} must ask before write_file: {:?}",
                agent.events()
            );
            assert_eq!(std::fs::read_to_string(&dest).unwrap(), "keep\n");
        }
    }

    #[test]
    fn denied_write_file_leaves_the_file_untouched() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let dest = root.join("note.md");
        std::fs::write(&dest, "keep\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        agent.set_approval_waiter(|_, _| ApprovalReply::Deny);
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: serde_json::json!({ "path": "note.md", "content": "no\n" }).to_string(),
        }]]);
        agent.submit("overwrite");
        agent.run_until_idle(&mut model);
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "keep\n");
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "write_file")
        }));
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "write_file")
        }));
    }

    #[test]
    fn approved_write_file_creates_a_new_file() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let dest = root.join("fresh.md");
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        agent.set_approval_waiter(|_, _| ApprovalReply::AllowOnce);
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "write_file".into(),
                args: serde_json::json!({ "path": "fresh.md", "content": "hello\n" }).to_string(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("create");
        agent.run_until_idle(&mut model);
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello\n");
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "write_file")
        }));
    }

    #[test]
    fn allow_session_covers_later_edits_to_the_same_path_only() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        std::fs::write(root.join("a.md"), "one\n").unwrap();
        std::fs::write(root.join("b.md"), "two\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                ApprovalReply::AllowSession
            } else {
                ApprovalReply::AllowOnce
            }
        });
        let mut model = FakeModel::script(vec![vec![
            ScriptPart::Tool {
                name: "edit_file".into(),
                args: serde_json::json!({
                    "path": "a.md",
                    "old_string": "one",
                    "new_string": "ONE"
                })
                .to_string(),
            },
            ScriptPart::Tool {
                name: "edit_file".into(),
                args: serde_json::json!({
                    "path": "a.md",
                    "old_string": "ONE",
                    "new_string": "uno"
                })
                .to_string(),
            },
            ScriptPart::Tool {
                name: "edit_file".into(),
                args: serde_json::json!({
                    "path": "b.md",
                    "old_string": "two",
                    "new_string": "TWO"
                })
                .to_string(),
            },
        ]]);
        agent.submit("edit");
        agent.run_until_idle(&mut model);
        assert_eq!(asks.load(Ordering::SeqCst), 2);
        assert_eq!(std::fs::read_to_string(root.join("a.md")).unwrap(), "uno\n");
        assert_eq!(std::fs::read_to_string(root.join("b.md")).unwrap(), "TWO\n");
    }

    #[test]
    fn file_changed_since_approval_does_not_write() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let dest = root.join("note.md");
        std::fs::write(&dest, "keep\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let note_path = dest.clone();
        agent.set_approval_waiter(move |_, _| {
            std::fs::write(&note_path, "changed\n").unwrap();
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: serde_json::json!({ "path": "note.md", "content": "no\n" }).to_string(),
        }]]);
        agent.submit("overwrite");
        agent.run_until_idle(&mut model);
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "changed\n");
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output, .. }
                    if name == "write_file" && output == super::tools::CHANGED_SINCE_APPROVAL
            )
        }));
    }

    #[test]
    fn preview_error_does_not_open_an_approval_card() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        std::fs::write(root.join("note.md"), "only this\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit_file".into(),
            args: serde_json::json!({
                "path": "note.md",
                "old_string": "missing",
                "new_string": "x"
            })
            .to_string(),
        }]]);
        agent.submit("edit");
        agent.run_until_idle(&mut model);
        assert!(
            !asked.load(Ordering::SeqCst),
            "a call that will error must not show Allow buttons: {:?}",
            agent.events()
        );
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output, .. }
                    if name == "edit_file" && output.contains("not found")
            )
        }));
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "edit_file")
        }));
    }

    #[test]
    fn session_grants_clear_when_the_vault_changes() {
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        let root_a = first.path().canonicalize().unwrap();
        let root_b = second.path().canonicalize().unwrap();
        std::fs::write(root_a.join("note.md"), "one\n").unwrap();
        std::fs::write(root_b.join("note.md"), "two\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(root_a.to_string_lossy().into_owned()), Vec::new());
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowSession
        });
        let mut model_a = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: serde_json::json!({ "path": "note.md", "content": "ONE\n" }).to_string(),
        }]]);
        agent.submit("a");
        agent.run_until_idle(&mut model_a);
        assert_eq!(asks.load(Ordering::SeqCst), 1);
        assert_eq!(
            std::fs::read_to_string(root_a.join("note.md")).unwrap(),
            "ONE\n"
        );

        agent.set_vault(Some(root_b.to_string_lossy().into_owned()), Vec::new());
        let mut model_b = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: serde_json::json!({ "path": "note.md", "content": "TWO\n" }).to_string(),
        }]]);
        agent.submit("b");
        agent.run_until_idle(&mut model_b);
        assert_eq!(
            asks.load(Ordering::SeqCst),
            2,
            "a grant from the old vault must not cover the new one"
        );
        assert_eq!(
            std::fs::read_to_string(root_b.join("note.md")).unwrap(),
            "TWO\n"
        );
    }

    #[test]
    fn set_vault_same_path_keeps_session_grants() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        std::fs::write(root.join("note.md"), "keep\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        let root_s = root.to_string_lossy().into_owned();
        agent.set_vault(Some(root_s.clone()), Vec::new());
        agent.grant_for_session(
            "write_file",
            serde_json::json!({ "path": "note.md", "content": "one\n" }).to_string(),
        );
        agent.set_vault(Some(root_s), Vec::new());
        assert_eq!(agent.session_grants().len(), 1);
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: serde_json::json!({ "path": "note.md", "content": "two\n" }).to_string(),
        }]]);
        agent.submit("again");
        agent.run_until_idle(&mut model);
        assert!(
            !asked.load(Ordering::SeqCst),
            "the same vault must not wipe a session grant"
        );
        assert_eq!(
            std::fs::read_to_string(root.join("note.md")).unwrap(),
            "two\n"
        );
    }

    #[test]
    fn deny_clears_stamp_so_a_later_session_grant_can_write() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let dest = root.join("note.md");
        std::fs::write(&dest, "keep\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        agent.set_approval_waiter(|_, _| ApprovalReply::Deny);
        let mut first = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: serde_json::json!({ "path": "note.md", "content": "no\n" }).to_string(),
        }]]);
        agent.submit("deny");
        agent.run_until_idle(&mut first);
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "keep\n");

        std::fs::write(&dest, "other\n").unwrap();
        agent.grant_for_session(
            "write_file",
            serde_json::json!({ "path": "note.md", "content": "yes\n" }).to_string(),
        );
        let mut second = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: serde_json::json!({ "path": "note.md", "content": "yes\n" }).to_string(),
        }]]);
        agent.submit("granted");
        agent.run_until_idle(&mut second);
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "yes\n");
        assert!(
            !agent.events().iter().any(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { output, .. }
                        if output == super::tools::CHANGED_SINCE_APPROVAL
                )
            }),
            "a leftover stamp must not block a later session grant: {:?}",
            agent.events()
        );
    }

    #[test]
    fn limited_tools_asks_before_create_note_writes() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("asked.md");
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        let note_path = note.clone();
        agent.set_approval_waiter(move |name, _| {
            assert_eq!(name, "create_note");
            assert!(!note_path.exists(), "create_note must ask before writing");
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "asked.md",
                    "content": "# Asked\n",
                })
                .to_string(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("write a note");
        agent.run_until_idle(&mut model);

        assert!(
            asked.load(Ordering::SeqCst),
            "Limited tools must ask before create_note writes: {:?}",
            agent.events()
        );
    }

    #[test]
    fn denied_create_note_writes_no_note() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("denied.md");
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::Deny
        });
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "denied.md",
                    "content": "# Denied\n",
                })
                .to_string(),
            }],
            vec![ScriptPart::Text("after".into())],
        ]);
        agent.submit("write a note");
        agent.run_until_idle(&mut model);

        assert!(
            asked.load(Ordering::SeqCst),
            "Limited tools must ask before denying create_note: {:?}",
            agent.events()
        );
        assert!(!note.exists(), "a denied create_note must write no file");
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "create_note")
        }));
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "create_note")
        }));
    }

    #[test]
    fn approved_create_note_writes_the_note_in_the_vault() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("approved.md");
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "approved.md",
                    "content": "# Approved\n",
                })
                .to_string(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("write a note");
        agent.run_until_idle(&mut model);

        assert!(
            asked.load(Ordering::SeqCst),
            "Limited tools must ask before an approved create_note: {:?}",
            agent.events()
        );
        assert_eq!(
            std::fs::read_to_string(&note).expect("approved create_note must write the note"),
            "# Approved\n"
        );
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, .. } if name == "create_note"
            )
        }));
    }

    #[test]
    fn create_note_refuses_a_path_outside_the_vault() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        std::fs::create_dir(&vault).unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(vault.to_string_lossy().into_owned()), Vec::new());
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "../escape.md",
                    "content": "# Escape\n",
                })
                .to_string(),
            }],
            vec![ScriptPart::Text("after".into())],
        ]);
        agent.submit("escape");
        agent.run_until_idle(&mut model);

        assert!(
            !asked.load(Ordering::SeqCst),
            "Power User must not prompt for create_note"
        );
        assert!(!parent.path().join("escape.md").exists());
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output, .. }
                    if name == "create_note" && !output.starts_with('{')
            )
        }));
    }

    #[test]
    fn create_note_does_not_overwrite() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("kept.md");
        std::fs::write(&note, "# Kept\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "kept.md",
                    "content": "# Replaced\n",
                })
                .to_string(),
            }],
            vec![ScriptPart::Text("after".into())],
        ]);
        agent.submit("overwrite");
        agent.run_until_idle(&mut model);

        assert_eq!(std::fs::read_to_string(&note).unwrap(), "# Kept\n");
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output, .. }
                    if name == "create_note" && output.contains("already exists")
            )
        }));
    }

    #[test]
    fn limited_tools_asks_for_every_create_note() {
        let vault = tempfile::tempdir().unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![
            vec![
                ScriptPart::Tool {
                    name: "create_note".into(),
                    args: serde_json::json!({
                        "path": "one.md",
                        "content": "# One\n",
                    })
                    .to_string(),
                },
                ScriptPart::Tool {
                    name: "create_note".into(),
                    args: serde_json::json!({
                        "path": "two.md",
                        "content": "# Two\n",
                    })
                    .to_string(),
                },
            ],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("two notes");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 2);
        assert!(vault.path().join("one.md").exists());
        assert!(vault.path().join("two.md").exists());
    }

    #[test]
    fn limited_tools_create_note_offers_no_session_grant() {
        let vault = tempfile::tempdir().unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        agent.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        agent.grant_for_session("create_note", "{}");
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                ApprovalReply::AllowSession
            } else {
                ApprovalReply::AllowOnce
            }
        });
        let mut model = FakeModel::script(vec![
            vec![
                ScriptPart::Tool {
                    name: "create_note".into(),
                    args: serde_json::json!({
                        "path": "first.md",
                        "content": "# First\n",
                    })
                    .to_string(),
                },
                ScriptPart::Tool {
                    name: "create_note".into(),
                    args: serde_json::json!({
                        "path": "second.md",
                        "content": "# Second\n",
                    })
                    .to_string(),
                },
            ],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("two notes");
        agent.run_until_idle(&mut model);

        assert_eq!(
            asks.load(Ordering::SeqCst),
            2,
            "create_note must not match or store a session grant"
        );
        assert!(vault.path().join("first.md").exists());
        assert!(vault.path().join("second.md").exists());
    }

    #[test]
    fn power_user_runs_create_note_without_a_prompt() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("power.md");
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::Deny
        });
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "power.md",
                    "content": "# Power\n",
                })
                .to_string(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("write");
        agent.run_until_idle(&mut model);

        assert!(
            !asked.load(Ordering::SeqCst),
            "Power User create_note must not ask: {:?}",
            agent.events()
        );
        assert_eq!(std::fs::read_to_string(&note).unwrap(), "# Power\n");
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "create_note")
        }));
    }

    #[test]
    fn limited_tools_denies_shell() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "bash".into(),
                args: "ls".into(),
            }],
            vec![ScriptPart::Text("after".into())],
        ]);
        agent.submit("hi");
        agent.run_until_idle(&mut model);

        assert!(!model.seen[0]
            .offered_tools
            .iter()
            .any(|name| name == "bash"));
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "bash")
        }));
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "bash")
        }));
        assert!(agent
            .events()
            .iter()
            .any(|event| matches!(event, DurableEvent::TurnEnd)));
        assert!(!model.seen[1]
            .offered_tools
            .iter()
            .any(|name| name == "bash"));
    }

    #[test]
    fn power_user_allow_once_runs_echo() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        let mut model = FakeModel::script(vec![
            vec![
                ScriptPart::Tool {
                    name: "echo".into(),
                    args: "hi".into(),
                },
                ScriptPart::Tool {
                    name: "echo".into(),
                    args: "hi".into(),
                },
            ],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        let results = agent
            .events()
            .into_iter()
            .filter(
                |event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "echo"),
            )
            .count();
        assert_eq!(results, 1);
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "echo")
        }));
        assert!(agent
            .events()
            .iter()
            .any(|event| matches!(event, DurableEvent::TurnEnd)));
    }

    #[cfg(unix)]
    #[test]
    fn power_user_bash_asks_for_a_new_command() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        let seen = Arc::new(Mutex::new(String::new()));
        let seen_args = Arc::clone(&seen);
        agent.set_approval_waiter(move |_, args| {
            count.fetch_add(1, Ordering::SeqCst);
            *seen_args.lock().expect("seen command") = args.to_string();
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "bash".into(),
            args: serde_json::json!({ "command": "echo hi" }).to_string(),
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 1);
        assert_eq!(seen.lock().expect("seen command").as_str(), "echo hi");
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output, .. }
                    if name == "bash"
                        && output.contains("hi")
                        && output.contains("\"exit_code\":0")
                        && output.contains("\"stopped\":false")
            )
        }));
    }

    #[cfg(unix)]
    #[test]
    fn power_user_bash_asks_again_for_a_repeat() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let command = serde_json::json!({ "command": "echo hi" }).to_string();
        let mut model = FakeModel::script(vec![vec![
            ScriptPart::Tool {
                name: "bash".into(),
                args: command.clone(),
            },
            ScriptPart::Tool {
                name: "bash".into(),
                args: command,
            },
        ]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 2);
        let runs = agent
            .events()
            .iter()
            .filter(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { name, output, .. }
                        if name == "bash"
                            && output.contains("hi")
                            && output.contains("\"exit_code\":0")
                            && output.contains("\"stopped\":false")
                )
            })
            .count();
        assert_eq!(runs, 2);
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "bash")
        }));
    }

    #[cfg(unix)]
    #[test]
    fn cancel_during_bash_records_cancelled() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let started = root.join("started");
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        agent.set_approval_waiter(|_, _| ApprovalReply::AllowOnce);
        let command = format!("echo go > '{}'; sleep 30", started.display());
        let watcher = agent.clone();
        let flag = started.clone();
        thread::spawn(move || {
            for _ in 0..200 {
                if flag.exists() {
                    watcher.cancel("quit");
                    return;
                }
                thread::sleep(Duration::from_millis(10));
            }
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "bash".into(),
            args: serde_json::json!({ "command": command, "timeout_secs": 5 }).to_string(),
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::Cancelled { cause } if cause == "quit")
        }));
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output, .. }
                    if name == "bash" && output.contains("\"stopped\":true") && output.contains("\"kind\":\"bash_result\"")
            )
        }));
    }

    #[test]
    fn bash_approval_shows_the_command_with_escapes_intact() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        let command = "printf '%s' \"a\\b\\\"c\"";
        let seen = Arc::new(Mutex::new(String::new()));
        let seen_args = Arc::clone(&seen);
        agent.set_approval_waiter(move |_, args| {
            *seen_args.lock().expect("seen command") = args.to_string();
            ApprovalReply::Deny
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "bash".into(),
            args: serde_json::json!({ "command": command }).to_string(),
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(seen.lock().expect("seen command").as_str(), command);
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "bash")
        }));
    }

    #[test]
    fn a_session_grant_does_not_skip_bash_approval() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        let args = serde_json::json!({ "command": "echo hi" }).to_string();
        agent.grant_for_session("bash", &args);
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::Deny
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "bash".into(),
            args,
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 1);
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "bash")
        }));
    }

    #[test]
    fn no_ui_timeout_denies() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::Cancelled
        });
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "edit".into(),
                args: "note".into(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("please");
        agent.run_until_idle(&mut model);

        assert!(asked.load(Ordering::SeqCst));
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
        }));
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolDenied { name, reason, .. }
                    if name == "edit" && reason == "approval cancelled"
            )
        }));
    }

    #[test]
    fn safe_mode_denies_unoffered_edit_even_when_waiter_allows_once() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::Safe);
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert!(
            !asked.load(Ordering::SeqCst),
            "an unoffered tool must be denied before the waiter runs"
        );
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
        }));
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolDenied { name, reason, .. }
                    if name == "edit" && reason == "not offered"
            )
        }));
    }

    #[test]
    fn waiter_allow_once_runs_and_deny_does_not() {
        let allowed = AgentLoop::new();
        allowed.offer_extra_tool_for_test("edit");
        allowed.set_approval_waiter(|_, _| ApprovalReply::AllowOnce);
        let mut allow_model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        allowed.submit("go");
        allowed.run_until_idle(&mut allow_model);
        assert!(allowed.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
        }));

        let denied = AgentLoop::new();
        denied.offer_extra_tool_for_test("edit");
        denied.set_approval_waiter(|_, _| ApprovalReply::Deny);
        let mut deny_model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        denied.submit("go");
        denied.run_until_idle(&mut deny_model);
        assert!(!denied.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
        }));
        assert!(denied.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "edit")
        }));
    }

    #[test]
    fn unknown_tool_is_denied_when_not_offered() {
        let agent = AgentLoop::new();
        agent.grant_for_session("mystery", "anything");
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_, _| {
            flag.store(true, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "mystery".into(),
            args: "anything".into(),
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert!(
            !asked.load(Ordering::SeqCst),
            "an unknown tool must be denied before the waiter runs"
        );
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "mystery")
        }));
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolDenied { name, reason, .. }
                    if name == "mystery" && reason == "not offered"
            )
        }));
    }

    #[test]
    fn unknown_tool_session_grant_does_not_cover_later_calls() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("mystery");
        agent.grant_for_session("mystery", "alpha");
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowSession
        });
        let mut model = FakeModel::script(vec![
            vec![
                ScriptPart::Tool {
                    name: "mystery".into(),
                    args: "alpha".into(),
                },
                ScriptPart::Tool {
                    name: "mystery".into(),
                    args: "beta".into(),
                },
            ],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(
            asks.load(Ordering::SeqCst),
            2,
            "a session grant must not cover an unknown tool"
        );
    }

    #[cfg(unix)]
    #[test]
    fn allow_session_does_not_cover_a_later_bash_call() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowSession
        });
        let command = serde_json::json!({ "command": "echo hi" }).to_string();
        let mut model = FakeModel::script(vec![vec![
            ScriptPart::Tool {
                name: "bash".into(),
                args: command.clone(),
            },
            ScriptPart::Tool {
                name: "bash".into(),
                args: command,
            },
        ]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 2);
        let runs = agent
            .events()
            .iter()
            .filter(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { name, output, .. }
                        if name == "bash" && output.contains("\"exit_code\":0") && output.contains("\"kind\":\"bash_result\"")
                )
            })
            .count();
        assert_eq!(runs, 2);
    }

    #[test]
    fn session_grants_clear_when_the_session_ends() {
        let vault = tempfile::tempdir().unwrap();
        let root = vault.path().canonicalize().unwrap();
        std::fs::write(root.join("note.md"), "one\n").unwrap();
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowSession
        });
        let args = serde_json::json!({ "path": "note.md", "content": "TWO\n" }).to_string();
        let mut first = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: args.clone(),
        }]]);
        agent.submit("a");
        agent.run_until_idle(&mut first);
        assert_eq!(asks.load(Ordering::SeqCst), 1);

        let mut replay = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args: args.clone(),
        }]]);
        agent.submit("again");
        agent.run_until_idle(&mut replay);
        assert_eq!(
            asks.load(Ordering::SeqCst),
            1,
            "the same path should stay granted until the session ends"
        );

        agent.end_session();
        agent.set_vault(Some(root.to_string_lossy().into_owned()), Vec::new());

        let mut after = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "write_file".into(),
            args,
        }]]);
        agent.submit("b");
        agent.run_until_idle(&mut after);
        assert_eq!(asks.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn step_cap_stops_a_runaway_turn() {
        assert_eq!(DEFAULT_STEP_CAP, 8);
        let agent = AgentLoop::new();
        agent.set_step_cap(2);
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "echo".into(),
                args: "1".into(),
            }],
            vec![ScriptPart::Tool {
                name: "echo".into(),
                args: "2".into(),
            }],
            vec![ScriptPart::Tool {
                name: "echo".into(),
                args: "3".into(),
            }],
            vec![ScriptPart::Text("never".into())],
        ]);
        agent.submit("loop");
        agent.run_until_idle(&mut model);

        let echoes = agent
            .events()
            .iter()
            .filter(
                |event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "echo"),
            )
            .count();
        assert_eq!(echoes, 2);
        assert!(!agent
            .events()
            .iter()
            .any(|event| matches!(event, DurableEvent::Assistant { text } if text == "never")));
        assert!(agent
            .events()
            .iter()
            .any(|event| matches!(event, DurableEvent::TurnEnd)));
        assert_eq!(model.seen.len(), 2);
    }

    #[test]
    fn cancel_between_queued_tools_skips_the_rest() {
        let agent = AgentLoop::new();
        let cancel = agent.clone();
        let once = Arc::new(AtomicBool::new(false));
        let armed = Arc::clone(&once);
        agent.on_after_tool_for_test(move |name, _| {
            if name == "echo" && !armed.swap(true, Ordering::SeqCst) {
                cancel.cancel("quit");
            }
        });
        let mut model = FakeModel::script(vec![vec![
            ScriptPart::Tool {
                name: "echo".into(),
                args: "one".into(),
            },
            ScriptPart::Tool {
                name: "echo".into(),
                args: "two".into(),
            },
        ]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        let echoes: Vec<String> = agent
            .events()
            .iter()
            .filter_map(|event| match event {
                DurableEvent::ToolResult { name, output, .. } if name == "echo" => {
                    Some(output.clone())
                }
                _ => None,
            })
            .collect();
        assert_eq!(echoes, vec!["one".to_string()]);
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::Cancelled { cause } if cause == "quit")
        }));
    }

    #[test]
    fn stop_and_drain_drops_the_inbox_and_does_not_start_the_next_turn() {
        let agent = AgentLoop::new();
        let stop = agent.clone();
        let mut model =
            FakeModel::streaming(vec![vec!["one".into(), "two".into()], vec!["bee".into()]]);
        model.on_after_chunk(move |index| {
            if index == 0 {
                stop.stop_and_drain("quit");
            }
        });
        agent.submit("A");
        agent.submit("B");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User { text: "A".into() },
                DurableEvent::Assistant { text: "one".into() },
                DurableEvent::Cancelled {
                    cause: "quit".into(),
                },
            ]
        );
        assert!(agent.when_idle());
    }

    #[test]
    fn submit_after_stop_and_drain_does_not_run() {
        let agent = AgentLoop::new();
        agent.stop_and_drain("quit");
        agent.submit("later");
        let mut model = FakeModel::saying("nope");
        agent.run_until_idle(&mut model);
        assert!(agent.events().is_empty());
        assert!(model.seen.is_empty());
    }

    #[test]
    fn loop_drives_any_model_impl() {
        let agent = AgentLoop::new();
        let mut model = OnceModel {
            text: "ok".into(),
            used: false,
        };
        agent.submit("hi");
        agent.run_until_idle(&mut model);
        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User { text: "hi".into() },
                DurableEvent::Assistant { text: "ok".into() },
                DurableEvent::TurnEnd,
            ]
        );
    }

    #[test]
    fn cancel_stops_reading_unread_model_events() {
        let agent = AgentLoop::new();
        let cancel = agent.clone();
        let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
        model.on_after_chunk(move |index| {
            if index == 0 {
                cancel.cancel("quit");
            }
        });
        agent.submit("hello");
        agent.run_until_idle(&mut model);

        assert!(
            model.unread > 0,
            "cancel must drop unread events, unread={}",
            model.unread
        );
        assert!(
            !agent.events().iter().any(
                |event| matches!(event, DurableEvent::Assistant { text } if text.contains("two"))
            ),
            "the second chunk must not be accepted"
        );
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::Cancelled { cause } if cause == "quit")
        }));
    }

    #[test]
    fn interleaved_tool_calls_keep_their_ids() {
        let agent = AgentLoop::new();
        let mut model = FakeModel::events(vec![
            vec![
                ModelEvent::ToolCallStart {
                    id: "call_a".into(),
                    name: "echo".into(),
                },
                ModelEvent::ToolCallStart {
                    id: "call_b".into(),
                    name: "echo".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_b".into(),
                    delta: "beta".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_a".into(),
                    delta: "alpha".into(),
                },
                ModelEvent::ToolCallEnd {
                    id: "call_a".into(),
                },
                ModelEvent::ToolCallEnd {
                    id: "call_b".into(),
                },
                ModelEvent::Finish {
                    reason: FinishReason::ToolCalls,
                },
            ],
            vec![
                ModelEvent::TextDelta {
                    text: "done".into(),
                },
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ],
        ]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        let results: Vec<(String, String)> = agent
            .events()
            .into_iter()
            .filter_map(|event| match event {
                DurableEvent::ToolResult { id, output, .. } => Some((id, output)),
                _ => None,
            })
            .collect();
        assert_eq!(
            results,
            vec![
                ("call_a".into(), "alpha".into()),
                ("call_b".into(), "beta".into()),
            ]
        );
        let HistoryItem::Assistant { tool_calls, .. } = &model.seen[1].history[0] else {
            panic!("step two must start with the assistant tool calls");
        };
        assert_eq!(
            tool_calls
                .iter()
                .map(|call| call.id.as_str())
                .collect::<Vec<_>>(),
            vec!["call_a", "call_b"]
        );
    }

    #[test]
    fn malformed_json_args_are_a_visible_tool_error() {
        let agent = AgentLoop::new();
        let mut model = FakeModel::events(vec![
            vec![
                ModelEvent::ToolCallStart {
                    id: "call_bad".into(),
                    name: "echo".into(),
                },
                ModelEvent::ToolCallArgsDelta {
                    id: "call_bad".into(),
                    delta: "{not-json".into(),
                },
                ModelEvent::ToolCallEnd {
                    id: "call_bad".into(),
                },
                ModelEvent::Finish {
                    reason: FinishReason::ToolCalls,
                },
            ],
            vec![
                ModelEvent::TextDelta {
                    text: "after".into(),
                },
                ModelEvent::Finish {
                    reason: FinishReason::Stop,
                },
            ],
        ]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolDenied { id, reason, .. }
                    if id == "call_bad" && reason.starts_with("malformed arguments")
            )
        }));
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { id, .. } if id == "call_bad")
        }));
        let HistoryItem::ToolDenied { id, reason, .. } = &model.seen[1].history[1] else {
            panic!("the model must see the malformed-args denial");
        };
        assert_eq!(id, "call_bad");
        assert!(reason.starts_with("malformed arguments"));
    }

    #[test]
    fn model_error_ends_the_turn() {
        let agent = AgentLoop::new();
        let mut model = FakeModel::script(vec![vec![ScriptPart::Fail(ModelError {
            kind: ModelErrorKind::Unavailable,
            status: Some(503),
            message: "down".into(),
        })]]);
        agent.submit("hi");
        agent.run_until_idle(&mut model);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User { text: "hi".into() },
                DurableEvent::ModelFailed {
                    message: "down".into(),
                },
                DurableEvent::TurnEnd,
            ]
        );
        assert_eq!(model.seen.len(), 1);
    }

    #[test]
    fn cancel_ends_a_blocked_approval_wait() {
        let (events, _) = run_until_approval_then(|agent| {
            agent.cancel("quit");
        });
        assert!(
            events.iter().any(|event| {
                matches!(
                    event,
                    DurableEvent::ToolDenied { id, reason, .. }
                        if id == "call_1" && reason == "cancelled"
                )
            }),
            "cancel mid-wait must deny the call as cancelled: {events:?}"
        );
        assert!(!events
            .iter()
            .any(|event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")));
        assert!(events
            .iter()
            .any(|event| matches!(event, DurableEvent::Cancelled { cause } if cause == "quit")));
    }

    #[test]
    fn quit_ends_a_blocked_approval_wait() {
        let (events, agent) = run_until_approval_then(|agent| {
            agent.stop_and_drain("quit");
        });
        assert!(events.iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolDenied { id, reason, .. }
                    if id == "call_1" && reason == "cancelled"
            )
        }));
        assert!(!events
            .iter()
            .any(|event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")));
        assert!(events
            .iter()
            .any(|event| matches!(event, DurableEvent::Cancelled { cause } if cause == "quit")));

        let mut later = FakeModel::saying("nope");
        agent.submit("later");
        agent.run_until_idle(&mut later);
        assert!(
            later.seen.is_empty(),
            "quit must keep refusing later submits"
        );
    }

    #[test]
    fn allow_once_after_cancel_does_not_run_the_tool() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let cancel = agent.clone();
        agent.set_approval_waiter(move |_, _| {
            cancel.cancel("quit");
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
        }));
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolDenied { id, reason, .. }
                    if id == "call_1" && reason == "cancelled"
            )
        }));
    }

    #[test]
    fn allow_session_after_cancel_does_not_record_a_grant() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let cancel = agent.clone();
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_, _| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                cancel.cancel("quit");
                ApprovalReply::AllowSession
            } else {
                ApprovalReply::AllowOnce
            }
        });
        let mut first = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("one");
        agent.run_until_idle(&mut first);
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
        }));

        let mut second = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("two");
        agent.run_until_idle(&mut second);
        assert_eq!(
            asks.load(Ordering::SeqCst),
            2,
            "AllowSession after cancel must not store a session grant"
        );
    }

    #[test]
    fn waiter_is_asked_again_after_a_cancelled_wait() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        let (entered_tx, entered_rx) = mpsc::channel();
        let (hold_tx, hold_rx) = mpsc::channel::<()>();
        let hold_rx = Mutex::new(hold_rx);
        agent.set_approval_waiter(move |_, _| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                entered_tx.send(()).ok();
                let _ = hold_rx.lock().expect("hold").recv();
            }
            ApprovalReply::AllowOnce
        });
        let mut first = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("one");
        let runner = agent.clone();
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            runner.run_until_idle(&mut first);
            done_tx.send(()).ok();
        });
        entered_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("the first wait should block");
        agent.cancel("quit");
        done_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("cancel must end the first turn");
        drop(hold_tx);

        let mut second = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("two");
        agent.run_until_idle(&mut second);

        assert_eq!(
            asks.load(Ordering::SeqCst),
            2,
            "the same waiter must be asked again after a mid-wait cancel"
        );
        assert!(
            agent.events().iter().any(
                |event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
            ),
            "AllowOnce on the next turn must run the tool: {:?}",
            agent.events()
        );
    }

    #[test]
    fn cancelled_wait_does_not_hold_the_next_approval() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        let dismissed = Arc::new(AtomicUsize::new(0));
        let dismiss_count = Arc::clone(&dismissed);
        let (entered_tx, entered_rx) = mpsc::channel();
        let (hold_tx, hold_rx) = mpsc::channel::<()>();
        let hold_rx = Mutex::new(hold_rx);
        let (second_tx, second_rx) = mpsc::channel();
        agent.set_approval_waiter(move |_, _| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                entered_tx.send(()).ok();
                let _ = hold_rx.lock().expect("hold").recv();
                return ApprovalReply::AllowOnce;
            }
            second_tx.send(()).ok();
            ApprovalReply::AllowOnce
        });
        agent.set_approval_dismiss(move || {
            dismiss_count.fetch_add(1, Ordering::SeqCst);
        });
        let mut first = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("one");
        let runner = agent.clone();
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            runner.run_until_idle(&mut first);
            done_tx.send(()).ok();
        });
        entered_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("the first wait should block");
        agent.cancel("quit");
        done_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("cancel must end the first turn");
        assert_eq!(
            dismissed.load(Ordering::SeqCst),
            1,
            "cancel must dismiss the stale prompt"
        );

        let mut second = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "later".into(),
        }]]);
        agent.submit("two");
        let runner = agent.clone();
        let (second_done_tx, second_done_rx) = mpsc::channel();
        thread::spawn(move || {
            runner.run_until_idle(&mut second);
            second_done_tx.send(runner.events()).ok();
        });
        second_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("the next wait must not sit on the cancelled lock");
        let events = second_done_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("the second turn must finish while the first waiter is still held");
        assert_eq!(asks.load(Ordering::SeqCst), 2);
        let edit_results = events
            .iter()
            .filter(
                |event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit"),
            )
            .count();
        assert_eq!(
            edit_results, 1,
            "AllowOnce on the live prompt must run once: {events:?}"
        );
        drop(hold_tx);
        assert!(
            !events.iter().any(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { name, output, .. }
                        if name == "edit" && output == "note"
                )
            }),
            "a stale AllowOnce must not echo cancelled args: {events:?}"
        );
    }

    #[test]
    fn from_log_closes_unpaired_tool_calls_and_drops_orphan_results() {
        let agent = AgentLoop::from_log(vec![
            DurableEvent::User { text: "hi".into() },
            DurableEvent::ToolCall {
                id: "open".into(),
                name: "echo".into(),
                args: "x".into(),
            },
            DurableEvent::ToolDenied {
                id: "orphan-deny".into(),
                name: "echo".into(),
                reason: "nope".into(),
            },
            DurableEvent::ToolResult {
                id: "orphan-result".into(),
                name: "echo".into(),
                output: "no".into(),
            },
            DurableEvent::Assistant {
                text: "done".into(),
            },
            DurableEvent::TurnEnd,
        ]);
        let events = agent.events();
        assert!(
            events.iter().any(|event| matches!(
                event,
                DurableEvent::ToolResult { id, output, .. }
                    if id == "open" && output == UNANSWERED_TOOL_OUTPUT
            )),
            "unpaired ToolCall must get a synthetic result: {events:?}"
        );
        assert!(
            !events.iter().any(|event| matches!(
                event,
                DurableEvent::ToolDenied { id, .. } if id == "orphan-deny"
            )),
            "orphan ToolDenied must be dropped: {events:?}"
        );
        assert!(
            !events.iter().any(|event| matches!(
                event,
                DurableEvent::ToolResult { id, .. } if id == "orphan-result"
            )),
            "orphan ToolResult must be dropped: {events:?}"
        );
    }

    #[test]
    fn from_log_keeps_pending_and_errored_tools_paired_for_the_model() {
        let agent = AgentLoop::from_log(vec![
            DurableEvent::User {
                text: "Do both".into(),
            },
            DurableEvent::ToolCall {
                id: "pending-1".into(),
                name: "search".into(),
                args: "{}".into(),
            },
            DurableEvent::ToolDenied {
                id: "pending-1".into(),
                name: "search".into(),
                reason: "cancelled".into(),
            },
            DurableEvent::ToolCall {
                id: "err-1".into(),
                name: "write".into(),
                args: "{}".into(),
            },
            DurableEvent::ToolDenied {
                id: "err-1".into(),
                name: "write".into(),
                reason: "disk full".into(),
            },
            DurableEvent::Assistant {
                text: "Tried both".into(),
            },
            DurableEvent::TurnEnd,
        ]);
        let history = agent.model_view_for_resume().history;
        let HistoryItem::Assistant { tool_calls, .. } = &history[1] else {
            panic!("first assistant should hold the tool calls: {history:?}");
        };
        assert_eq!(
            tool_calls
                .iter()
                .map(|call| call.id.as_str())
                .collect::<Vec<_>>(),
            ["pending-1", "err-1"]
        );
        assert!(matches!(
            &history[2],
            HistoryItem::ToolDenied { id, reason, .. }
                if id == "pending-1" && reason == "cancelled"
        ));
        assert!(matches!(
            &history[3],
            HistoryItem::ToolDenied { id, reason, .. }
                if id == "err-1" && reason == "disk full"
        ));
        assert!(matches!(
            &history[4],
            HistoryItem::Assistant { text, tool_calls }
                if text == "Tried both" && tool_calls.is_empty()
        ));
    }

    /// Blocks in the waiter until `on_entered` runs, then expects the loop
    /// to finish without the waiter returning. Times out if cancel/quit
    /// cannot end the wait.
    fn run_until_approval_then(
        on_entered: impl FnOnce(&AgentLoop) + Send + 'static,
    ) -> (Vec<DurableEvent>, AgentLoop) {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let (entered_tx, entered_rx) = mpsc::channel();
        let (hold_tx, hold_rx) = mpsc::channel::<()>();
        let hold_rx = Mutex::new(hold_rx);
        agent.set_approval_waiter(move |_, _| {
            entered_tx.send(()).ok();
            let _ = hold_rx.lock().expect("hold").recv();
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        agent.submit("go");
        let runner = agent.clone();
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            runner.run_until_idle(&mut model);
            done_tx.send(runner.events()).ok();
        });
        entered_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("the waiter should block");
        on_entered(&agent);
        let events = done_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("cancel or quit must end the approval wait");
        drop(hold_tx);
        (events, agent)
    }

    struct OnceModel {
        text: String,
        used: bool,
    }

    impl Model for OnceModel {
        fn complete(
            &mut self,
            _view: &ModelView,
            emit: &mut dyn FnMut(ModelEvent) -> bool,
        ) -> bool {
            if self.used {
                return false;
            }
            self.used = true;
            let keep = emit(ModelEvent::TextDelta {
                text: self.text.clone(),
            });
            if keep {
                emit(ModelEvent::Finish {
                    reason: FinishReason::Stop,
                });
            }
            true
        }
    }
}
