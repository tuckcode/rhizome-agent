//! Optional engines behind one trait (ADR-0180, harness plan Phase 5).
//!
//! Chat still talks to Prime directly. Phase 6 adds the toggle.
//! Native maps quit to cancel. Prime detaches. Hermes uses ACP.

mod hermes;
mod native;
mod prime;

pub use hermes::HermesEngine;
pub use native::NativeEngine;
pub use prime::PrimeEngine;

/// One event an engine surfaces to a later Chat path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EngineEvent {
    Text(String),
    Cancelled { cause: String },
}

/// Start, one stream, then stop. No Chat import yet.
pub trait Engine {
    fn kind(&self) -> &'static str;
    fn start(&mut self, prompt: &str) -> Result<(), String>;
    fn stop(&mut self);
    fn events(&self) -> Vec<EngineEvent>;
}

#[cfg(test)]
mod tests {
    use super::{Engine, EngineEvent, HermesEngine, NativeEngine, PrimeEngine};
    use crate::prime_session_host::QuitDisposition;
    use crate::rhizome_loop::{AgentLoop, DurableEvent, FakeModel};
    use std::sync::{Arc, Mutex};

    #[test]
    fn native_engine_start_stop() {
        let mut engine = NativeEngine::saying("ok");
        engine.start("hi").expect("native start");
        assert_eq!(engine.kind(), "native");
        assert_eq!(engine.events(), vec![EngineEvent::Text("ok".into())]);
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
        engine.start("hello").expect("native start");
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
        engine.start("Summarize the note").expect("acp fixture");
        assert_eq!(engine.kind(), "hermes");
        assert!(
            engine
                .events()
                .iter()
                .any(|event| matches!(event, EngineEvent::Text(text) if text == "Hello from ACP")),
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
            engine.start("hi").expect(kind);
            assert_eq!(engine.kind(), kind);
            assert!(
                engine
                    .events()
                    .iter()
                    .any(|event| matches!(event, EngineEvent::Text(_))),
                "{kind} must emit one text event: {:?}",
                engine.events()
            );
            engine.stop();
        }
    }
}
