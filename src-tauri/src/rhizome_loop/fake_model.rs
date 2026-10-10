use std::collections::VecDeque;

use super::types::ModelView;

/// One scripted piece of a model round.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScriptPart {
    Text(String),
    Tool { name: String, args: String },
}

/// Scripted model. Each round is one model response.
/// Text hooks run around each text chunk. A tool part has no text index.
pub struct FakeModel {
    rounds: VecDeque<Vec<ScriptPart>>,
    pub seen: Vec<ModelView>,
    before_chunk: Option<Box<dyn FnMut(usize)>>,
    after_chunk: Option<Box<dyn FnMut(usize)>>,
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
            rounds: rounds.into(),
            seen: Vec::new(),
            before_chunk: None,
            after_chunk: None,
        }
    }

    pub fn on_before_chunk(&mut self, hook: impl FnMut(usize) + 'static) {
        self.before_chunk = Some(Box::new(hook));
    }

    pub fn on_after_chunk(&mut self, hook: impl FnMut(usize) + 'static) {
        self.after_chunk = Some(Box::new(hook));
    }

    /// Returns false when the script has no round left.
    pub fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(ScriptPart) -> bool) -> bool {
        self.seen.push(view.clone());
        let Some(parts) = self.rounds.pop_front() else {
            return false;
        };
        let mut text_index = 0;
        for part in parts {
            match part {
                ScriptPart::Text(chunk) => {
                    if let Some(hook) = self.before_chunk.as_mut() {
                        hook(text_index);
                    }
                    let keep = emit(ScriptPart::Text(chunk));
                    if keep {
                        if let Some(hook) = self.after_chunk.as_mut() {
                            hook(text_index);
                        }
                    }
                    text_index += 1;
                    if !keep {
                        break;
                    }
                }
                tool @ ScriptPart::Tool { .. } => {
                    if !emit(tool) {
                        break;
                    }
                }
            }
        }
        true
    }
}
