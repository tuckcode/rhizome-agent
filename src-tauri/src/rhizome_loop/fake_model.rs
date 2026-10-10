use std::collections::VecDeque;

use super::model::Model;
use super::types::ModelView;
use crate::model_events::{FinishReason, ModelError, ModelEvent};

/// One scripted piece of a model round.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScriptPart {
    Text(String),
    Tool { name: String, args: String },
    Fail(ModelError),
}

enum Round {
    Script(Vec<ScriptPart>),
    Events(Vec<ModelEvent>),
}

/// Scripted model. Each round is one model response.
/// Text hooks run around each text chunk.
pub struct FakeModel {
    rounds: VecDeque<Round>,
    pub seen: Vec<ModelView>,
    /// Events offered to `emit`, including the one that returned false.
    pub emitted: usize,
    /// Events in the script that were never offered because reading stopped.
    pub unread: usize,
    before_chunk: Option<Box<dyn FnMut(usize) + Send>>,
    after_chunk: Option<Box<dyn FnMut(usize) + Send>>,
}

impl FakeModel {
    pub fn saying(text: impl Into<String>) -> Self {
        Self::streaming(vec![vec![text.into()]])
    }

    pub fn streaming(rounds: Vec<Vec<String>>) -> Self {
        Self::script(
            rounds
                .into_iter()
                .map(|chunks| chunks.into_iter().map(ScriptPart::Text).collect())
                .collect(),
        )
    }

    pub fn script(rounds: Vec<Vec<ScriptPart>>) -> Self {
        Self {
            rounds: rounds.into_iter().map(Round::Script).collect(),
            seen: Vec::new(),
            emitted: 0,
            unread: 0,
            before_chunk: None,
            after_chunk: None,
        }
    }

    /// One request of raw `ModelEvent`s, including the terminal event.
    pub fn events(rounds: Vec<Vec<ModelEvent>>) -> Self {
        Self {
            rounds: rounds.into_iter().map(Round::Events).collect(),
            seen: Vec::new(),
            emitted: 0,
            unread: 0,
            before_chunk: None,
            after_chunk: None,
        }
    }

    pub fn on_before_chunk(&mut self, hook: impl FnMut(usize) + Send + 'static) {
        self.before_chunk = Some(Box::new(hook));
    }

    pub fn on_after_chunk(&mut self, hook: impl FnMut(usize) + Send + 'static) {
        self.after_chunk = Some(Box::new(hook));
    }
}

impl Model for FakeModel {
    fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool {
        self.seen.push(view.clone());
        let Some(round) = self.rounds.pop_front() else {
            return false;
        };
        let events = match round {
            Round::Script(parts) => script_to_events(parts),
            Round::Events(events) => events,
        };
        let mut text_index = 0;
        let mut remaining = events.len();
        for event in events {
            remaining -= 1;
            let is_text = matches!(event, ModelEvent::TextDelta { .. });
            if is_text {
                if let Some(hook) = self.before_chunk.as_mut() {
                    hook(text_index);
                }
            }
            self.emitted += 1;
            let keep = emit(event);
            if keep {
                if is_text {
                    if let Some(hook) = self.after_chunk.as_mut() {
                        hook(text_index);
                    }
                    text_index += 1;
                }
            } else {
                self.unread += remaining;
                break;
            }
        }
        true
    }
}

fn script_to_events(parts: Vec<ScriptPart>) -> Vec<ModelEvent> {
    let mut events = Vec::new();
    let mut next = 1u32;
    let mut has_tools = false;
    for part in parts {
        match part {
            ScriptPart::Text(text) => events.push(ModelEvent::TextDelta { text }),
            ScriptPart::Tool { name, args } => {
                let id = format!("call_{next}");
                next += 1;
                push_tool(&mut events, id, name, args);
                has_tools = true;
            }
            ScriptPart::Fail(error) => {
                events.push(ModelEvent::Error(error));
                return events;
            }
        }
    }
    events.push(ModelEvent::Finish {
        reason: if has_tools {
            FinishReason::ToolCalls
        } else {
            FinishReason::Stop
        },
    });
    events
}

fn push_tool(events: &mut Vec<ModelEvent>, id: String, name: String, args: String) {
    events.push(ModelEvent::ToolCallStart {
        id: id.clone(),
        name,
    });
    events.push(ModelEvent::ToolCallArgsDelta {
        id: id.clone(),
        delta: args,
    });
    events.push(ModelEvent::ToolCallEnd { id });
}
