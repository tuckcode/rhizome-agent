//! Rhizome-owned agent loop (ADR-0180, harness plan Phases 1–2.5).
//!
//! Chat does not call this module. `lib.rs` compiles it only for tests.
//! One inbox, one turn at a time. A step is one model request plus
//! the tools it called. The loop consumes `ModelEvent`. Cancel stops
//! reading; the model has no `Cancelled` event. Tool-call `id`s stay
//! on the history items that go back to the model.
//! Allow-once is spent for echo. Power User bash asks each call
//! unless a session grant matches the exact command. Quit is
//! `stop_and_drain`.
//! The turn / inbox vocabulary is the DeepSeek Harness idea. No DeepSeek
//! code is copied.

mod driver;
mod fake_model;
mod model;
mod policy;
mod tools;
mod types;

pub use driver::{AgentLoop, ApprovalReply, DEFAULT_STEP_CAP};
pub use fake_model::{FakeModel, ScriptPart};
pub use model::Model;
pub use types::{DurableEvent, HistoryItem, ModelView, ToolCall};

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::mpsc;
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    use super::{
        AgentLoop, ApprovalReply, DurableEvent, FakeModel, HistoryItem, Model, ModelView,
        ScriptPart, ToolCall, DEFAULT_STEP_CAP,
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
                    offered_tools: vec!["echo".into()],
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
    fn power_user_bash_asks_for_a_new_command() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "bash".into(),
            args: "ls".into(),
        }]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 1);
        assert!(agent.events().iter().any(|event| {
            matches!(
                event,
                DurableEvent::ToolResult { name, output, .. }
                    if name == "bash" && output == "ls"
            )
        }));
    }

    #[test]
    fn power_user_bash_asks_again_for_a_repeat() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowOnce
        });
        let mut model = FakeModel::script(vec![vec![
            ScriptPart::Tool {
                name: "bash".into(),
                args: "ls".into(),
            },
            ScriptPart::Tool {
                name: "bash".into(),
                args: "ls".into(),
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
                        if name == "bash" && output == "ls"
                )
            })
            .count();
        assert_eq!(runs, 2);
        assert!(!agent.events().iter().any(|event| {
            matches!(event, DurableEvent::ToolDenied { name, .. } if name == "bash")
        }));
    }

    #[test]
    fn no_ui_timeout_denies() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let asked = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&asked);
        agent.set_approval_waiter(move |_| {
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
        agent.set_approval_waiter(move |_| {
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
                DurableEvent::ToolResult { name, output, .. }
                    if name == "edit" && output == "note"
            )
        }));

        let denied = AgentLoop::new();
        denied.offer_extra_tool_for_test("edit");
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

    #[test]
    fn allow_session_covers_the_tool_for_any_args() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowSession
        });
        let mut model = FakeModel::script(vec![
            vec![
                ScriptPart::Tool {
                    name: "edit".into(),
                    args: "alpha".into(),
                },
                ScriptPart::Tool {
                    name: "edit".into(),
                    args: "beta".into(),
                },
            ],
            vec![ScriptPart::Text("done".into())],
        ]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 1);
        let edits = agent
            .events()
            .iter()
            .filter(
                |event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit"),
            )
            .count();
        assert_eq!(edits, 2);
    }

    #[test]
    fn allow_session_stops_asking_for_that_exact_bash_command_only() {
        let agent = AgentLoop::new();
        agent.set_permission_mode(AiAgentPermissionMode::PowerUser);
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                ApprovalReply::AllowSession
            } else {
                ApprovalReply::AllowOnce
            }
        });
        let mut model = FakeModel::script(vec![vec![
            ScriptPart::Tool {
                name: "bash".into(),
                args: "ls".into(),
            },
            ScriptPart::Tool {
                name: "bash".into(),
                args: "ls".into(),
            },
            ScriptPart::Tool {
                name: "bash".into(),
                args: "pwd".into(),
            },
        ]]);
        agent.submit("go");
        agent.run_until_idle(&mut model);

        assert_eq!(asks.load(Ordering::SeqCst), 2);
        let ls_runs = agent
            .events()
            .iter()
            .filter(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { name, output, .. }
                        if name == "bash" && output == "ls"
                )
            })
            .count();
        let pwd_runs = agent
            .events()
            .iter()
            .filter(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { name, output, .. }
                        if name == "bash" && output == "pwd"
                )
            })
            .count();
        assert_eq!(ls_runs, 2);
        assert_eq!(pwd_runs, 1);
    }

    #[test]
    fn session_grants_clear_when_the_session_ends() {
        let agent = AgentLoop::new();
        agent.offer_extra_tool_for_test("edit");
        let asks = Arc::new(AtomicUsize::new(0));
        let count = Arc::clone(&asks);
        agent.set_approval_waiter(move |_| {
            count.fetch_add(1, Ordering::SeqCst);
            ApprovalReply::AllowSession
        });
        let mut first = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "one".into(),
        }]]);
        agent.submit("a");
        agent.run_until_idle(&mut first);
        assert_eq!(asks.load(Ordering::SeqCst), 1);

        let mut replay = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "one".into(),
        }]]);
        agent.submit("again");
        agent.run_until_idle(&mut replay);
        assert_eq!(
            asks.load(Ordering::SeqCst),
            1,
            "the same tool should stay granted until the session ends"
        );

        agent.end_session();

        let mut after = FakeModel::script(vec![vec![ScriptPart::Tool {
            name: "edit".into(),
            args: "one".into(),
        }]]);
        agent.submit("b");
        agent.run_until_idle(&mut after);
        assert_eq!(asks.load(Ordering::SeqCst), 2);
        let edits = agent
            .events()
            .iter()
            .filter(
                |event| matches!(event, DurableEvent::ToolResult { name, .. } if name == "edit"),
            )
            .count();
        assert_eq!(edits, 3);
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
        agent.set_approval_waiter(move |_| {
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
        agent.set_approval_waiter(move |_| {
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
        agent.set_approval_waiter(move |_| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                entered_tx.send(()).ok();
                let _ = hold_rx.recv();
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
            agent.events().iter().any(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { name, output, .. }
                        if name == "edit" && output == "note"
                )
            }),
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
        let (entered_tx, entered_rx) = mpsc::channel();
        let (hold_tx, hold_rx) = mpsc::channel::<()>();
        let (second_tx, second_rx) = mpsc::channel();
        agent.set_approval_waiter(move |_| {
            let n = count.fetch_add(1, Ordering::SeqCst);
            if n == 0 {
                entered_tx.send(()).ok();
                let _ = hold_rx.recv();
                return ApprovalReply::AllowOnce;
            }
            second_tx.send(()).ok();
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
        assert!(
            events.iter().any(|event| {
                matches!(
                    event,
                    DurableEvent::ToolResult { name, output, .. }
                        if name == "edit" && output == "later"
                )
            }),
            "AllowOnce on the live prompt must run: {events:?}"
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
            "a stale AllowOnce must not run after dismiss: {events:?}"
        );
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
        agent.set_approval_waiter(move |_| {
            entered_tx.send(()).ok();
            let _ = hold_rx.recv();
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
