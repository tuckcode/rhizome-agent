//! Loop-side model seam. Providers later implement this with `ModelEvent`.
//!
//! Cancel belongs to the loop. There is no `Cancelled` event. When the
//! loop stops reading (`emit` returns false), unread events are dropped.

use super::types::ModelView;
use crate::model_events::ModelEvent;

/// One model request. The loop calls `emit` for each event and stops
/// after a terminal event or when `emit` returns false.
pub trait Model: Send {
    fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool;

    /// Images for this request. A model that ignores them sends text only.
    fn set_chat_images(&mut self, _images: Vec<Vec<crate::chat_images::ChatImage>>) {}
}
