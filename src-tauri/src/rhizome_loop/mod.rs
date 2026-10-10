//! Rhizome-owned agent loop (ADR-0180, harness plan Phases 1–2).
//!
//! Chat does not call this module. `lib.rs` compiles it only for tests.
//! One inbox, one turn at a time. A step is one model request.
//! The turn / inbox vocabulary is the DeepSeek Harness idea. No DeepSeek
//! code is copied.

mod driver;
mod fake_model;
mod policy;
mod tools;
mod types;

pub use driver::{AgentLoop, ApprovalReply};
pub use fake_model::{FakeModel, ScriptPart};
pub use types::{DurableEvent, HistoryItem, ModelView};

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    use super::{
        AgentLoop, ApprovalReply, DurableEvent, FakeModel, HistoryItem, ModelView, ScriptPart,
    };
    use crate::ai_agents::AiAgentPermissionMode;

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
                    offered_tools: vec!["echo".into()],
                },
                ModelView {
                    admitted: "B".into(),
                    history: vec![
                        HistoryItem::User { text: "A".into() },
                        HistoryItem::Assistant {
                            text: "from-a".into(),
                        },
                    ],
                    offered_tools: vec!["echo".into()],
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
                DurableEvent::ToolResult {
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
        assert!(model.seen[1].history.iter().any(|item| {
            matches!(
                item,
                HistoryItem::ToolResult { name, output }
                    if name == "echo" && output == "ping"
            )
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

    #[test]
    fn no_ui_timeout_denies() {
        let agent = AgentLoop::new();
        agent.set_approval_waiter(|_| ApprovalReply::Cancelled);
        let mut model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "edit".into(),
                args: "note".into(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("please");
        agent.run_until_idle(&mut model);

        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit")
        }));
        assert!(agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "edit")
        }));
    }

    #[test]
    fn waiter_allow_once_runs_and_deny_does_not() {
        let allowed = AgentLoop::new();
        allowed.set_approval_waiter(|_| ApprovalReply::AllowOnce);
        let mut allow_model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "note".into(),
        }]]);
        allowed.submit("go");
        allowed.run_until_idle(&mut allow_model);
        assert!(allowed.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output }
                    if name == "edit" && output == "note"
            )
        }));

        let denied = AgentLoop::new();
        denied.set_approval_waiter(|_| ApprovalReply::Deny);
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
}
