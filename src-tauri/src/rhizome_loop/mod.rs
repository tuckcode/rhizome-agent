//! Rhizome-owned agent loop (ADR-0180, harness plan Phase 1).
//!
//! Chat does not call this module. `lib.rs` compiles it only for tests.
//! One inbox, one turn at a time. A step is one model request.
//! The turn / inbox vocabulary is the DeepSeek Harness idea. No DeepSeek
//! code is copied.

mod driver;
mod fake_model;
mod types;

pub use driver::AgentLoop;
pub use fake_model::FakeModel;
pub use types::{DurableEvent, ModelView};

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    use super::{AgentLoop, DurableEvent, FakeModel, ModelView};

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
                    prior_users: vec![],
                },
                ModelView {
                    admitted: "B".into(),
                    prior_users: vec!["A".into()],
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
}
