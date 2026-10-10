//! Optional engines behind one trait (ADR-0180, harness plan Phase 5–2a).
//!
//! Chat still talks to Prime directly. Phase 6 adds the toggle.
//! Native maps quit to cancel. Prime detaches. Hermes uses ACP.

mod hermes;
mod native;
pub mod native_log;
mod prime;

pub use hermes::HermesEngine;
pub use native::{NativeControl, NativeEngine};
pub use prime::PrimeEngine;

use crate::rhizome_loop::{ApprovalOption, ApprovalReply};
use crate::rhizome_routing::ProviderAttempt;
use serde::Serialize;

/// One event an engine surfaces to Chat.
///
/// `Provider(Trying)` with no later `Provider` event means that attempt
/// was stopped (cancel or quit). The activity line must not wait for a
/// follow-up after `Cancelled`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EngineEvent {
    TextDelta {
        text: String,
    },
    ToolCall {
        id: String,
        name: String,
        args: String,
    },
    ToolResult {
        id: String,
        name: String,
        output: String,
    },
    ToolDenied {
        id: String,
        name: String,
        reason: String,
    },
    ApprovalRequested {
        prompt_id: String,
        tool: String,
        args: String,
        options: Vec<ApprovalOption>,
    },
    ApprovalDismissed {
        prompt_id: String,
    },
    Provider(ProviderAttempt),
    TurnEnd,
    Cancelled {
        cause: String,
    },
    Error {
        message: String,
    },
}

/// Start with a live sink. Control methods work while a turn runs.
pub trait Engine {
    fn kind(&self) -> &'static str;
    fn start(
        &mut self,
        prompt: &str,
        sink: Box<dyn FnMut(EngineEvent) + Send>,
    ) -> Result<(), String>;
    fn stop(&mut self);
    fn events(&self) -> Vec<EngineEvent>;
    fn steer(&mut self, text: &str);
    fn cancel(&mut self, cause: &str);
    fn reply_approval(&mut self, prompt_id: &str, reply: ApprovalReply);
    fn settle_on_quit(&mut self);
}

#[cfg(test)]
fn start_quiet(engine: &mut dyn Engine, prompt: &str) -> Result<(), String> {
    engine.start(prompt, Box::new(|_| {}))
}

#[cfg(test)]
mod tests {
    use super::{start_quiet, Engine, EngineEvent, HermesEngine, NativeEngine, PrimeEngine};
    use crate::ai_agents::AiAgentPermissionMode;
    use crate::model_events::{FinishReason, ModelErrorKind, ModelEvent};
    use crate::prime_session_host::QuitDisposition;
    use crate::rhizome_loop::{
        AgentLoop, ApprovalReply, DurableEvent, FakeModel, Model, ModelView, ScriptPart,
    };
    use crate::rhizome_routing::ProviderAttempt;
    use std::sync::mpsc;
    use std::sync::{Arc, Mutex};
    use std::thread;
    use std::time::{Duration, Instant};

    #[test]
    fn native_engine_start_stop() {
        let mut engine = NativeEngine::saying("ok");
        start_quiet(&mut engine, "hi").expect("native start");
        assert_eq!(engine.kind(), "native");
        assert_eq!(
            engine.events(),
            vec![
                EngineEvent::TextDelta { text: "ok".into() },
                EngineEvent::TurnEnd,
            ]
        );
        engine.stop();
        assert!(engine.agent().when_idle());
    }

    #[test]
    fn native_engine_quit_cancels_turn() {
        let agent = AgentLoop::new();
        let quit = agent.clone();
        let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
        model.on_after_chunk(move |index| {
            if index == 0 {
                quit.stop_and_drain("quit");
            }
        });
        let mut engine = NativeEngine::from_parts(agent, model);
        start_quiet(&mut engine, "hello").expect("native start");
        engine.stop();
        assert!(engine
            .events()
            .iter()
            .any(|event| { matches!(event, EngineEvent::Cancelled { cause } if cause == "quit") }));
        assert!(
            !engine
                .loop_events()
                .iter()
                .any(|event| matches!(event, DurableEvent::TurnEnd)),
            "quit must not leave a resume grant: {:?}",
            engine.loop_events()
        );
    }

    #[test]
    fn prime_engine_detaches_on_drop() {
        let seen = Arc::new(Mutex::new(Vec::<String>::new()));
        let log = Arc::clone(&seen);
        {
            let engine = PrimeEngine::with_settle(move |intent| {
                log.lock()
                    .expect("prime settle log")
                    .push(format!("{intent:?}"));
                Ok(QuitDisposition::KeepSessionRunning)
            });
            drop(engine);
        }
        let commands = seen.lock().expect("prime settle log").clone();
        assert_eq!(commands, vec!["Detach".to_string()]);
        assert!(
            !commands.iter().any(|command| command.contains("Shutdown")),
            "drop must detach, never shutdown: {commands:?}"
        );
    }

    #[test]
    fn hermes_engine_uses_acp_client() {
        let mut engine = HermesEngine::fake_agent();
        start_quiet(&mut engine, "Summarize the note").expect("acp fixture");
        assert_eq!(engine.kind(), "hermes");
        assert!(
            engine.events().iter().any(
                |event| matches!(event, EngineEvent::TextDelta { text } if text == "Hello from ACP")
            ),
            "fixture text missing: {:?}",
            engine.events()
        );
        engine.stop();
    }

    #[test]
    fn each_engine_starts_one_text_event_and_stops() {
        let cases: Vec<(&str, Box<dyn Engine>)> = vec![
            ("native", Box::new(NativeEngine::saying("ok"))),
            ("prime", Box::new(PrimeEngine::with_text("from-prime"))),
            ("hermes", Box::new(HermesEngine::fake_agent())),
        ];
        for (kind, mut engine) in cases {
            start_quiet(engine.as_mut(), "hi").expect(kind);
            assert_eq!(engine.kind(), kind);
            assert!(
                engine
                    .events()
                    .iter()
                    .any(|event| matches!(event, EngineEvent::TextDelta { .. })),
                "{kind} must emit one text event: {:?}",
                engine.events()
            );
            engine.stop();
        }
    }

    #[test]
    fn native_engine_streams_text_before_turn_end() {
        let (provider_tx, provider_rx) = mpsc::channel();
        let (held_tx, held_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let (sink_tx, sink_rx) = mpsc::channel();
        let model = HoldAfterFirstRound {
            tx: provider_tx.clone(),
            held: held_tx,
            release: release_rx,
            round: 0,
        };
        let mut engine =
            NativeEngine::with_provider_pair(AgentLoop::new(), model, provider_tx, provider_rx);
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            engine
                .start(
                    "hi",
                    Box::new(move |event| {
                        let _ = sink_tx.send(event);
                    }),
                )
                .ok();
            let _ = done_tx.send(engine.events());
        });
        held_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("second round holds start open");
        assert!(
            done_rx.try_recv().is_err(),
            "start must still be running when the sink sees live events"
        );

        let mut seen = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if let Ok(event) = sink_rx.recv_timeout(Duration::from_millis(20)) {
                seen.push(event);
            }
            if has_live_text(&seen) && has_trying(&seen, "a") {
                break;
            }
        }
        assert!(
            has_live_text(&seen),
            "sink must receive text before start returns: {seen:?}"
        );
        assert!(
            has_trying(&seen, "a"),
            "sink must receive Trying before start returns: {seen:?}"
        );
        assert!(
            !seen
                .iter()
                .any(|event| matches!(event, EngineEvent::TurnEnd)),
            "turn must still be open: {seen:?}"
        );
        assert!(done_rx.try_recv().is_err());

        let _ = release_tx.send(());
        let events = done_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("start returns after release");
        let text = events
            .iter()
            .position(|event| matches!(event, EngineEvent::TextDelta { text } if text == "hello"))
            .expect("text");
        let end = events
            .iter()
            .position(|event| matches!(event, EngineEvent::TurnEnd))
            .expect("turn end");
        assert!(text < end, "{events:?}");
    }

    #[test]
    fn native_engine_second_turn_does_not_replay_first() {
        let mut engine = NativeEngine::from_parts(
            AgentLoop::new(),
            FakeModel::streaming(vec![vec!["first".into()], vec!["second".into()]]),
        );
        let first_sink = Arc::new(Mutex::new(Vec::new()));
        let seen = Arc::clone(&first_sink);
        engine
            .start(
                "one",
                Box::new(move |event| seen.lock().expect("turn 1 sink").push(event)),
            )
            .expect("turn 1");
        let turn1 = first_sink.lock().expect("turn 1 sink").clone();
        assert!(turn1
            .iter()
            .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "first")));
        assert!(!turn1
            .iter()
            .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "second")));

        let second_sink = Arc::new(Mutex::new(Vec::new()));
        let seen = Arc::clone(&second_sink);
        engine
            .start(
                "two",
                Box::new(move |event| seen.lock().expect("turn 2 sink").push(event)),
            )
            .expect("turn 2");
        let turn2 = second_sink.lock().expect("turn 2 sink").clone();
        assert!(
            !turn2
                .iter()
                .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "first")),
            "turn 1 text must not replay on turn 2: {turn2:?}"
        );
        assert!(
            turn2
                .iter()
                .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "second")),
            "turn 2 missing its own text: {turn2:?}"
        );
        assert_eq!(
            turn2
                .iter()
                .filter(|event| matches!(event, EngineEvent::TextDelta { .. }))
                .count(),
            1
        );
    }

    #[test]
    fn native_engine_reports_tool_call_and_result() {
        let model = FakeModel::script(vec![
            vec![ScriptPart::Tool {
                name: "echo".into(),
                args: "ping".into(),
            }],
            vec![ScriptPart::Text("done".into())],
        ]);
        let mut engine = NativeEngine::from_parts(AgentLoop::new(), model);
        start_quiet(&mut engine, "hi").expect("start");
        assert!(engine.events().iter().any(|event| {
            matches!(
                event,
                EngineEvent::ToolCall { name, args, .. } if name == "echo" && args == "ping"
            )
        }));
        assert!(engine.events().iter().any(|event| {
            matches!(
                event,
                EngineEvent::ToolResult { name, output, .. } if name == "echo" && output == "ping"
            )
        }));
    }

    #[test]
    fn native_engine_sets_vault_for_create_note() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("from-engine.md");
        let mut engine = NativeEngine::from_parts(
            AgentLoop::new(),
            FakeModel::script(vec![
                vec![ScriptPart::Tool {
                    name: "create_note".into(),
                    args: serde_json::json!({
                        "path": "from-engine.md",
                        "content": "# Engine\n",
                    })
                    .to_string(),
                }],
                vec![ScriptPart::Text("done".into())],
            ]),
        );
        engine.set_permission_mode(AiAgentPermissionMode::PowerUser);
        engine.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        start_quiet(&mut engine, "write").expect("start");
        assert_eq!(std::fs::read_to_string(&note).unwrap(), "# Engine\n");
    }

    #[test]
    fn native_engine_create_note_allow_writes_and_deny_does_not() {
        let vault = tempfile::tempdir().unwrap();
        let allowed = vault.path().join("allowed.md");
        let denied = vault.path().join("denied.md");

        run_create_note_through_chat(&vault, "allowed.md", ApprovalReply::AllowOnce);
        assert_eq!(std::fs::read_to_string(&allowed).unwrap(), "# Note\n");

        run_create_note_through_chat(&vault, "denied.md", ApprovalReply::Deny);
        assert!(!denied.exists());
    }

    #[test]
    fn native_engine_create_note_prompt_is_allow_once_and_deny() {
        let vault = tempfile::tempdir().unwrap();
        let requested = run_until_create_note_prompt(&vault, "opts.md");
        let ids: Vec<&str> = requested
            .options
            .iter()
            .map(|option| option.id.as_str())
            .collect();
        assert_eq!(ids, vec!["allow_once", "deny"]);
        assert!(!ids.contains(&"allow_session"));
    }

    #[test]
    fn native_engine_approval_timeout_denies() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("late.md");
        let mut engine = NativeEngine::from_parts(
            AgentLoop::new(),
            FakeModel::script(vec![vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "late.md",
                    "content": "# Late\n",
                })
                .to_string(),
            }]]),
        );
        engine.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        engine.set_approval_timeout(Duration::from_millis(30));
        start_quiet(&mut engine, "write").expect("start");
        assert!(!note.exists());
        assert!(engine.events().iter().any(|event| {
            matches!(event, EngineEvent::ToolDenied { name, .. } if name == "create_note")
        }));
    }

    #[test]
    fn native_engine_cancel_during_approval_dismisses_prompt() {
        let vault = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::channel();
        let mut engine = NativeEngine::from_parts(
            AgentLoop::new(),
            FakeModel::script(vec![vec![ScriptPart::Tool {
                name: "create_note".into(),
                args: serde_json::json!({
                    "path": "cancel.md",
                    "content": "# Cancel\n",
                })
                .to_string(),
            }]]),
        );
        engine.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let control = engine.control();
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            engine
                .start(
                    "write",
                    Box::new(move |event| {
                        let _ = tx.send(event);
                    }),
                )
                .ok();
            let _ = done_tx.send(engine.events());
        });
        let requested = wait_for_approval(&rx);
        control.cancel("quit");
        let events = done_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("cancel must end start");
        assert!(events.iter().any(|event| {
            matches!(
                event,
                EngineEvent::ApprovalDismissed { prompt_id } if prompt_id == &requested.prompt_id
            )
        }));
        assert!(!vault.path().join("cancel.md").exists());
    }

    #[test]
    fn native_engine_steer_waits_for_idle() {
        let control = Arc::new(Mutex::new(None::<super::NativeControl>));
        let slot = Arc::clone(&control);
        let mut model = FakeModel::streaming(vec![vec!["from-a".into()], vec!["from-b".into()]]);
        model.on_after_chunk(move |index| {
            if index != 0 {
                return;
            }
            if let Some(control) = slot.lock().expect("control").as_ref() {
                control.steer("B");
            }
        });
        let mut engine = NativeEngine::from_parts(AgentLoop::new(), model);
        *control.lock().expect("control") = Some(engine.control());
        start_quiet(&mut engine, "A").expect("start");
        let events = engine.events();
        let end_a = events
            .iter()
            .position(|event| matches!(event, EngineEvent::TurnEnd))
            .expect("A turn end");
        let text_b = events
            .iter()
            .position(|event| matches!(event, EngineEvent::TextDelta { text } if text == "from-b"))
            .expect("B text");
        assert!(end_a < text_b, "{events:?}");
    }

    #[test]
    fn native_engine_ignores_stale_approval_id() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("stale.md");
        let requested = run_until_create_note_prompt(&vault, "stale.md");
        requested
            .control
            .reply_approval("prompt_999", ApprovalReply::Deny);
        thread::sleep(Duration::from_millis(80));
        assert!(
            requested.done.try_recv().is_err(),
            "a reply for another prompt must keep waiting"
        );
        assert!(!note.exists());
        requested
            .control
            .reply_approval(&requested.prompt_id, ApprovalReply::AllowOnce);
        requested
            .done
            .recv_timeout(Duration::from_secs(2))
            .expect("matching allow finishes the turn");
        assert_eq!(std::fs::read_to_string(&note).unwrap(), "# Note\n");
    }

    #[test]
    fn native_engine_current_approval_survives_a_stale_flood() {
        let vault = tempfile::tempdir().unwrap();
        let note = vault.path().join("flood.md");
        let (tx, rx) = mpsc::channel();
        let mut engine = NativeEngine::from_parts(
            AgentLoop::new(),
            FakeModel::script(vec![
                vec![ScriptPart::Tool {
                    name: "create_note".into(),
                    args: serde_json::json!({
                        "path": "flood.md",
                        "content": "# Note\n",
                    })
                    .to_string(),
                }],
                vec![ScriptPart::Text("done".into())],
            ]),
        );
        engine.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        engine.set_approval_timeout(Duration::from_millis(250));
        let control = engine.control();
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            engine
                .start(
                    "write",
                    Box::new(move |event| {
                        let _ = tx.send(event);
                    }),
                )
                .ok();
            let _ = done_tx.send(engine.events());
        });
        let requested = wait_for_approval(&rx);
        for index in 0..16 {
            control.reply_approval(&format!("prompt_old_{index}"), ApprovalReply::Deny);
        }
        control.reply_approval(&requested.prompt_id, ApprovalReply::AllowOnce);
        done_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("matching allow must get through the flood");
        assert_eq!(std::fs::read_to_string(&note).unwrap(), "# Note\n");
    }

    #[test]
    fn native_engine_reports_provider_failover() {
        let (tx, rx) = mpsc::channel();
        let model = FailoverModel { tx: tx.clone() };
        let mut engine = NativeEngine::with_provider_pair(AgentLoop::new(), model, tx, rx);
        start_quiet(&mut engine, "hi").expect("start");
        let events = engine.events();
        let providers: Vec<&ProviderAttempt> = events
            .iter()
            .filter_map(|event| match event {
                EngineEvent::Provider(attempt) => Some(attempt),
                _ => None,
            })
            .collect();
        assert_eq!(
            providers,
            vec![
                &trying("a"),
                &ProviderAttempt::FailedOver {
                    provider_id: "a".into(),
                    model_id: "a-model".into(),
                    reason: ModelErrorKind::RateLimited {
                        retry_after_secs: Some(30)
                    },
                },
                &trying("b"),
                &answered("b"),
            ]
        );
    }

    #[test]
    fn native_engine_provider_trying_then_cancel_means_stopped() {
        let (tx, rx) = mpsc::channel();
        let control = Arc::new(Mutex::new(None::<super::NativeControl>));
        let slot = Arc::clone(&control);
        let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
        let report = tx.clone();
        model.on_before_chunk(move |index| {
            if index == 0 {
                let _ = report.send(trying("a"));
            }
        });
        model.on_after_chunk(move |index| {
            if index != 0 {
                return;
            }
            if let Some(control) = slot.lock().expect("control").as_ref() {
                control.cancel("quit");
            }
        });
        let mut engine = NativeEngine::with_provider_pair(AgentLoop::new(), model, tx, rx);
        *control.lock().expect("control") = Some(engine.control());
        start_quiet(&mut engine, "hi").expect("start");
        let events = engine.events();
        let providers: Vec<&ProviderAttempt> = events
            .iter()
            .filter_map(|event| match event {
                EngineEvent::Provider(attempt) => Some(attempt),
                _ => None,
            })
            .collect();
        assert_eq!(providers, vec![&trying("a")]);
        assert!(events
            .iter()
            .any(|event| matches!(event, EngineEvent::Cancelled { cause } if cause == "quit")));
        assert!(!events.iter().any(|event| matches!(
            event,
            EngineEvent::Provider(ProviderAttempt::Answered { .. })
        )));
    }

    #[test]
    fn native_engine_provider_reports_do_not_block_the_answer() {
        let (tx, rx) = mpsc::channel();
        let model = FloodModel { tx: tx.clone() };
        let mut engine = NativeEngine::with_provider_pair(AgentLoop::new(), model, tx, rx);
        start_quiet(&mut engine, "hi").expect("start must not wait on a full channel");
        assert!(engine
            .events()
            .iter()
            .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "ok")));
    }

    #[test]
    fn native_engine_keeps_every_provider_report() {
        let (tx, rx) = mpsc::channel();
        let model = LongFailoverModel {
            tx: tx.clone(),
            count: 200,
        };
        let mut engine = NativeEngine::with_provider_pair(AgentLoop::new(), model, tx, rx);
        start_quiet(&mut engine, "hi").expect("start");
        let events = engine.events();
        let providers: Vec<&ProviderAttempt> = events
            .iter()
            .filter_map(|event| match event {
                EngineEvent::Provider(attempt) => Some(attempt),
                _ => None,
            })
            .collect();
        assert_eq!(
            providers.len(),
            201,
            "unbounded drain must keep every report: {}",
            providers.len()
        );
        assert_eq!(providers[0], &trying("p0"));
        assert_eq!(providers[199], &trying("p199"));
        assert_eq!(providers[200], &answered("last"));
    }

    #[test]
    fn native_settle_on_quit_cancels_and_refuses_submit() {
        let (chunk_tx, chunk_rx) = mpsc::channel();
        let (hold_tx, hold_rx) = mpsc::channel::<()>();
        let mut model = FakeModel::streaming(vec![vec!["one".into(), "two".into()]]);
        model.on_after_chunk(move |index| {
            if index == 0 {
                let _ = chunk_tx.send(());
                let _ = hold_rx.recv();
            }
        });
        let mut engine = NativeEngine::from_parts(AgentLoop::new(), model);
        let control = engine.control();
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            start_quiet(&mut engine, "A").ok();
            let _ = done_tx.send(engine);
        });
        chunk_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("first chunk");
        control.settle_on_quit();
        drop(hold_tx);
        let mut engine = done_rx
            .recv_timeout(Duration::from_secs(2))
            .expect("quit ends start");
        assert!(engine
            .events()
            .iter()
            .any(|event| matches!(event, EngineEvent::Cancelled { cause } if cause == "quit")));
        control.steer("later");
        start_quiet(&mut engine, "later").expect("start after quit");
        assert!(
            !engine
                .events()
                .iter()
                .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "later")),
            "quit must refuse later submits: {:?}",
            engine.events()
        );
    }

    fn run_create_note_through_chat(vault: &tempfile::TempDir, path: &str, reply: ApprovalReply) {
        let requested = run_until_create_note_prompt(vault, path);
        requested
            .control
            .reply_approval(&requested.prompt_id, reply);
        requested
            .done
            .recv_timeout(Duration::from_secs(2))
            .expect("turn finishes");
    }

    struct PendingPrompt {
        prompt_id: String,
        options: Vec<crate::rhizome_loop::ApprovalOption>,
        control: super::NativeControl,
        done: mpsc::Receiver<Vec<EngineEvent>>,
    }

    fn run_until_create_note_prompt(vault: &tempfile::TempDir, path: &str) -> PendingPrompt {
        let (tx, rx) = mpsc::channel();
        let mut engine = NativeEngine::from_parts(
            AgentLoop::new(),
            FakeModel::script(vec![
                vec![ScriptPart::Tool {
                    name: "create_note".into(),
                    args: serde_json::json!({
                        "path": path,
                        "content": "# Note\n",
                    })
                    .to_string(),
                }],
                vec![ScriptPart::Text("done".into())],
            ]),
        );
        engine.set_vault(
            Some(vault.path().to_string_lossy().into_owned()),
            Vec::new(),
        );
        let control = engine.control();
        let (done_tx, done_rx) = mpsc::channel();
        thread::spawn(move || {
            engine
                .start(
                    "write",
                    Box::new(move |event| {
                        let _ = tx.send(event);
                    }),
                )
                .ok();
            let _ = done_tx.send(engine.events());
        });
        let requested = wait_for_approval(&rx);
        PendingPrompt {
            prompt_id: requested.prompt_id,
            options: requested.options,
            control,
            done: done_rx,
        }
    }

    struct Requested {
        prompt_id: String,
        options: Vec<crate::rhizome_loop::ApprovalOption>,
    }

    fn wait_for_approval(rx: &mpsc::Receiver<EngineEvent>) -> Requested {
        let started = std::time::Instant::now();
        while started.elapsed() < Duration::from_secs(2) {
            match rx.recv_timeout(Duration::from_millis(50)) {
                Ok(EngineEvent::ApprovalRequested {
                    prompt_id, options, ..
                }) => {
                    return Requested { prompt_id, options };
                }
                Ok(_) => {}
                Err(_) => {}
            }
        }
        panic!("expected ApprovalRequested");
    }

    fn has_live_text(events: &[EngineEvent]) -> bool {
        events
            .iter()
            .any(|event| matches!(event, EngineEvent::TextDelta { text } if text == "hello"))
    }

    fn has_trying(events: &[EngineEvent], id: &str) -> bool {
        events.iter().any(|event| {
            matches!(
                event,
                EngineEvent::Provider(ProviderAttempt::Trying { provider_id, .. })
                    if provider_id == id
            )
        })
    }

    fn trying(id: &str) -> ProviderAttempt {
        ProviderAttempt::Trying {
            provider_id: id.into(),
            model_id: format!("{id}-model"),
        }
    }

    fn answered(id: &str) -> ProviderAttempt {
        ProviderAttempt::Answered {
            provider_id: id.into(),
            model_id: format!("{id}-model"),
        }
    }

    struct FailoverModel {
        tx: mpsc::Sender<ProviderAttempt>,
    }

    impl Model for FailoverModel {
        fn complete(
            &mut self,
            _view: &ModelView,
            emit: &mut dyn FnMut(ModelEvent) -> bool,
        ) -> bool {
            let _ = self.tx.send(trying("a"));
            let _ = self.tx.send(ProviderAttempt::FailedOver {
                provider_id: "a".into(),
                model_id: "a-model".into(),
                reason: ModelErrorKind::RateLimited {
                    retry_after_secs: Some(30),
                },
            });
            let _ = self.tx.send(trying("b"));
            let _ = self.tx.send(answered("b"));
            let _ = emit(ModelEvent::TextDelta { text: "ok".into() });
            let _ = emit(ModelEvent::Finish {
                reason: FinishReason::Stop,
            });
            true
        }
    }

    struct FloodModel {
        tx: mpsc::Sender<ProviderAttempt>,
    }

    impl Model for FloodModel {
        fn complete(
            &mut self,
            _view: &ModelView,
            emit: &mut dyn FnMut(ModelEvent) -> bool,
        ) -> bool {
            for _ in 0..16 {
                let _ = self.tx.send(trying("a"));
            }
            let _ = emit(ModelEvent::TextDelta { text: "ok".into() });
            let _ = emit(ModelEvent::Finish {
                reason: FinishReason::Stop,
            });
            true
        }
    }

    struct LongFailoverModel {
        tx: mpsc::Sender<ProviderAttempt>,
        count: usize,
    }

    impl Model for LongFailoverModel {
        fn complete(
            &mut self,
            _view: &ModelView,
            emit: &mut dyn FnMut(ModelEvent) -> bool,
        ) -> bool {
            for index in 0..self.count {
                let _ = self.tx.send(trying(&format!("p{index}")));
            }
            let _ = self.tx.send(answered("last"));
            let _ = emit(ModelEvent::TextDelta { text: "ok".into() });
            let _ = emit(ModelEvent::Finish {
                reason: FinishReason::Stop,
            });
            true
        }
    }

    struct HoldAfterFirstRound {
        tx: mpsc::Sender<ProviderAttempt>,
        held: mpsc::Sender<()>,
        release: mpsc::Receiver<()>,
        round: usize,
    }

    impl Model for HoldAfterFirstRound {
        fn complete(
            &mut self,
            _view: &ModelView,
            emit: &mut dyn FnMut(ModelEvent) -> bool,
        ) -> bool {
            self.round += 1;
            if self.round == 1 {
                let _ = self.tx.send(trying("a"));
                let _ = emit(ModelEvent::TextDelta {
                    text: "hello".into(),
                });
                let _ = emit(ModelEvent::ToolCallStart {
                    id: "call_1".into(),
                    name: "echo".into(),
                });
                let _ = emit(ModelEvent::ToolCallArgsDelta {
                    id: "call_1".into(),
                    delta: "ping".into(),
                });
                let _ = emit(ModelEvent::ToolCallEnd {
                    id: "call_1".into(),
                });
                let _ = emit(ModelEvent::Finish {
                    reason: FinishReason::ToolCalls,
                });
                return true;
            }
            let _ = self.held.send(());
            let _ = self.release.recv();
            let _ = emit(ModelEvent::TextDelta {
                text: "done".into(),
            });
            let _ = emit(ModelEvent::Finish {
                reason: FinishReason::Stop,
            });
            true
        }
    }
}
