use std::cell::RefCell;
use std::collections::HashMap;
use std::process::{Child, ExitStatus};
use std::sync::{Arc, Mutex, OnceLock};

type SharedChild = Arc<Mutex<Child>>;

thread_local! {
    static CURRENT_STREAM_ID: RefCell<Option<String>> = const { RefCell::new(None) };
}

static ACTIVE_CHILDREN: OnceLock<Mutex<HashMap<String, SharedChild>>> = OnceLock::new();

pub(crate) struct RegisteredAiAgentChild {
    stream_id: Option<String>,
    child: SharedChild,
}

struct StreamIdGuard {
    previous: Option<String>,
}

impl Drop for StreamIdGuard {
    fn drop(&mut self) {
        CURRENT_STREAM_ID.with(|cell| {
            cell.replace(self.previous.take());
        });
    }
}

impl Drop for RegisteredAiAgentChild {
    fn drop(&mut self) {
        let Some(stream_id) = self.stream_id.as_deref() else {
            return;
        };

        if let Ok(mut children) = active_children().lock() {
            if children
                .get(stream_id)
                .is_some_and(|child| Arc::ptr_eq(child, &self.child))
            {
                children.remove(stream_id);
            }
        }
    }
}

impl RegisteredAiAgentChild {
    pub(crate) fn wait(&self) -> Result<ExitStatus, String> {
        let mut child = self
            .child
            .lock()
            .map_err(|_| "AI agent process lock was poisoned".to_string())?;
        child
            .wait()
            .map_err(|error| format!("Wait failed: {error}"))
    }
}

pub(crate) fn with_stream_id<T>(stream_id: String, run: impl FnOnce() -> T) -> T {
    let guard = CURRENT_STREAM_ID.with(|cell| StreamIdGuard {
        previous: cell.replace(Some(stream_id)),
    });
    let result = run();
    drop(guard);
    result
}

pub(crate) fn register_current_stream_child(child: Child) -> RegisteredAiAgentChild {
    let stream_id = current_stream_id();
    let child = Arc::new(Mutex::new(child));

    if let Some(stream_id) = stream_id.as_deref() {
        if let Ok(mut children) = active_children().lock() {
            children.insert(stream_id.to_string(), child.clone());
        }
    }

    RegisteredAiAgentChild { stream_id, child }
}

pub(crate) fn abort_stream(stream_id: &str) -> Result<bool, String> {
    let child = active_children()
        .lock()
        .map_err(|_| "AI agent process registry lock was poisoned".to_string())?
        .get(stream_id)
        .cloned();

    let Some(child) = child else {
        return Ok(false);
    };

    let mut child = child
        .lock()
        .map_err(|_| "AI agent process lock was poisoned".to_string())?;
    if child
        .try_wait()
        .map_err(|error| format!("Failed to inspect AI agent process: {error}"))?
        .is_some()
    {
        return Ok(false);
    }

    child
        .kill()
        .map_err(|error| format!("Failed to stop AI agent process: {error}"))?;
    Ok(true)
}

fn active_children() -> &'static Mutex<HashMap<String, SharedChild>> {
    ACTIVE_CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

fn current_stream_id() -> Option<String> {
    CURRENT_STREAM_ID.with(|cell| cell.borrow().clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn abort_stream_kills_registered_child() {
        let child = std::process::Command::new("sh")
            .arg("-c")
            .arg("sleep 30")
            .spawn()
            .unwrap();

        with_stream_id("ai-agent-stream-test".into(), || {
            let registered = register_current_stream_child(child);

            assert!(abort_stream("ai-agent-stream-test").unwrap());
            let status = registered.wait().unwrap();

            assert!(!status.success());
        });
    }
}
