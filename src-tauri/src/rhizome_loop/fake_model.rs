use std::collections::VecDeque;

use super::types::ModelView;

/// Scripted model. Each round is the chunks for one step.
/// `on_after_chunk` runs after a chunk is admitted, before the next one.
pub struct FakeModel {
    rounds: VecDeque<Vec<String>>,
    pub seen: Vec<ModelView>,
    after_chunk: Option<Box<dyn FnMut(usize)>>,
}

impl FakeModel {
    pub fn saying(text: impl Into<String>) -> Self {
        Self::streaming(vec![vec![text.into()]])
    }

    pub fn streaming(rounds: Vec<Vec<String>>) -> Self {
        Self {
            rounds: rounds.into(),
            seen: Vec::new(),
            after_chunk: None,
        }
    }

    pub fn on_after_chunk(&mut self, hook: impl FnMut(usize) + 'static) {
        self.after_chunk = Some(Box::new(hook));
    }

    pub fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(&str) -> bool) {
        self.seen.push(view.clone());
        let chunks = self
            .rounds
            .pop_front()
            .expect("fake model has a scripted round");
        for (index, chunk) in chunks.iter().enumerate() {
            if !emit(chunk) {
                break;
            }
            if let Some(hook) = self.after_chunk.as_mut() {
                hook(index);
            }
        }
    }
}
