//! Images on a native chat turn.
//!
//! The composer already stages PNG, JPEG, GIF, and WebP. This module checks
//! the same caps, builds each provider's user content, and keeps the bytes
//! beside the session log so the next turn can send them again.
//!
//! Bytes live in `{session}-images/`, named from `{session}.images.json`.
//! The JSONL event stays text. A log written before images existed has no
//! sidecar and still opens.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use base64::Engine;
use serde_json::{json, Value};

/// Shown when the selected model is text-only, or no catalog row says it
/// accepts images. The turn is not sent.
pub const VISION_REFUSAL: &str = "This model cannot take images, or its vision support is not known. The message was not sent. Remove the image, or choose a model that accepts images.";

pub const IMAGE_TOO_LARGE: &str = "An image is over 5 MB. The message was not sent.";
pub const TOO_MANY_IMAGES: &str =
    "Only 4 images can be sent with one message. The message was not sent.";
pub const UNSUPPORTED_IMAGE: &str =
    "Only PNG, JPEG, GIF, and WebP images can be sent. The message was not sent.";
pub const UNREADABLE_IMAGE: &str = "An image could not be read. The message was not sent.";

/// Same cap as the composer, before base64 expansion.
pub const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
pub const MAX_IMAGES_PER_MESSAGE: usize = 4;

const INDEX_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatImage {
    pub mime_type: String,
    pub data: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ImageIndex {
    version: u32,
    turns: Vec<Vec<StoredImage>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredImage {
    mime_type: String,
    file: String,
}

fn ledgers() -> &'static Mutex<HashMap<String, Vec<Vec<ChatImage>>>> {
    static LEDGERS: std::sync::OnceLock<Mutex<HashMap<String, Vec<Vec<ChatImage>>>>> =
        std::sync::OnceLock::new();
    LEDGERS.get_or_init(|| Mutex::new(HashMap::new()))
}

thread_local! {
    static BOUND_SESSION: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Binds this thread to a session so the provider adapter can see its images.
pub fn bind_session(session_id: &str) {
    BOUND_SESSION.with(|slot| *slot.borrow_mut() = Some(session_id.to_string()));
}

pub fn unbind_session() {
    BOUND_SESSION.with(|slot| *slot.borrow_mut() = None);
}

pub struct SessionBind;

impl SessionBind {
    pub fn new(session_id: &str) -> Self {
        bind_session(session_id);
        Self
    }
}

impl Drop for SessionBind {
    fn drop(&mut self) {
        unbind_session();
    }
}

/// Loads the sidecar into memory once. A later [`push_turn`] is kept.
pub fn load_ledger(session_id: &str) -> Result<(), String> {
    let mut ledgers = ledgers().lock().expect("image ledgers");
    if ledgers.contains_key(session_id) {
        return Ok(());
    }
    let turns = read_turns(session_id)?;
    ledgers.insert(session_id.to_string(), turns);
    Ok(())
}

/// Records one user turn, including a turn with no images, so later turns
/// stay aligned with the log.
pub fn push_turn(session_id: &str, images: Vec<ChatImage>) -> Result<(), String> {
    validate(&images)?;
    let mut ledgers = ledgers().lock().expect("image ledgers");
    let turns = ledgers
        .entry(session_id.to_string())
        .or_insert_with(|| read_turns(session_id).unwrap_or_default());
    let index = turns.len();
    if images.is_empty() {
        turns.push(Vec::new());
        return write_index(session_id, turns);
    }
    let stored = write_image_files(session_id, index, &images)?;
    turns.push(images);
    if let Err(error) = write_stored_index(session_id, turns, &stored, index) {
        turns.pop();
        return Err(error);
    }
    Ok(())
}

/// Image sets for this thread's session, one per user turn so far.
pub fn current_ledger() -> Vec<Vec<ChatImage>> {
    let Some(session_id) = BOUND_SESSION.with(|slot| slot.borrow().clone()) else {
        return Vec::new();
    };
    ledgers()
        .lock()
        .expect("image ledgers")
        .get(&session_id)
        .cloned()
        .unwrap_or_default()
}

pub fn ledger_has_images() -> bool {
    current_ledger().iter().any(|turn| !turn.is_empty())
}

/// Images for the user lines in one provider request.
///
/// The ledger is aligned with user turns. When an older log has no sidecar,
/// the missing prefix is empty and the newest turns keep their images.
pub fn image_sets_for_users(user_count: usize, ledger: &[Vec<ChatImage>]) -> Vec<Vec<ChatImage>> {
    if user_count == 0 {
        return Vec::new();
    }
    if ledger.len() >= user_count {
        return ledger[ledger.len() - user_count..].to_vec();
    }
    let mut sets = vec![Vec::new(); user_count - ledger.len()];
    sets.extend(ledger.iter().cloned());
    sets
}

pub fn validate(images: &[ChatImage]) -> Result<(), String> {
    if images.len() > MAX_IMAGES_PER_MESSAGE {
        return Err(TOO_MANY_IMAGES.into());
    }
    for image in images {
        if !is_supported_mime(&image.mime_type) {
            return Err(UNSUPPORTED_IMAGE.into());
        }
        let bytes = decode_image(&image.data)?;
        if bytes.len() > MAX_IMAGE_BYTES {
            return Err(IMAGE_TOO_LARGE.into());
        }
    }
    Ok(())
}

pub fn is_supported_mime(mime: &str) -> bool {
    matches!(
        mime.trim().to_ascii_lowercase().as_str(),
        "image/png" | "image/jpeg" | "image/jpg" | "image/gif" | "image/webp"
    )
}

/// OpenAI-compatible user content. Gemini, Ollama, LM Studio, OpenRouter,
/// and other OpenAI-compatible hosts take this `image_url` data URL.
/// No images keeps a string, so a text turn stays the old shape.
pub fn openai_user_content(text: &str, images: &[ChatImage]) -> Value {
    if images.is_empty() {
        return Value::String(text.to_string());
    }
    let mut parts = Vec::new();
    if !text.is_empty() {
        parts.push(json!({ "type": "text", "text": text }));
    }
    for image in images {
        parts.push(json!({
            "type": "image_url",
            "image_url": { "url": data_url(image) }
        }));
    }
    Value::Array(parts)
}

/// Anthropic Messages API content. Images use base64 source blocks.
pub fn anthropic_user_content(text: &str, images: &[ChatImage]) -> Value {
    if images.is_empty() {
        return Value::String(text.to_string());
    }
    let mut parts = Vec::new();
    for image in images {
        parts.push(json!({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": normalize_mime(&image.mime_type),
                "data": raw_base64(&image.data)
            }
        }));
    }
    if !text.is_empty() {
        parts.push(json!({ "type": "text", "text": text }));
    }
    Value::Array(parts)
}

/// Last turn's images, for a provider call that sends one user message.
pub fn current_turn_images() -> Vec<ChatImage> {
    current_ledger().last().cloned().unwrap_or_default()
}

fn data_url(image: &ChatImage) -> String {
    format!(
        "data:{};base64,{}",
        normalize_mime(&image.mime_type),
        raw_base64(&image.data)
    )
}

fn normalize_mime(mime: &str) -> String {
    let mime = mime.trim().to_ascii_lowercase();
    if mime == "image/jpg" {
        "image/jpeg".to_string()
    } else {
        mime
    }
}

fn raw_base64(data: &str) -> &str {
    let trimmed = data.trim();
    if let Some(rest) = trimmed.strip_prefix("data:") {
        rest.split_once(',')
            .map(|(_, body)| body)
            .unwrap_or(trimmed)
    } else {
        trimmed
    }
}

fn decode_image(data: &str) -> Result<Vec<u8>, String> {
    let raw = raw_base64(data);
    let engine = base64::engine::general_purpose::STANDARD;
    if let Ok(bytes) = engine.decode(raw) {
        return Ok(bytes);
    }
    base64::engine::general_purpose::STANDARD_NO_PAD
        .decode(raw)
        .map_err(|_| UNREADABLE_IMAGE.to_string())
}

fn sessions_dir() -> Result<PathBuf, String> {
    crate::app_config::preferred_app_config_path("native-sessions")
}

fn index_path(session_id: &str) -> Result<PathBuf, String> {
    Ok(sessions_dir()?.join(format!("{session_id}.images.json")))
}

fn files_dir(session_id: &str) -> Result<PathBuf, String> {
    Ok(sessions_dir()?.join(format!("{session_id}-images")))
}

pub fn read_turns(session_id: &str) -> Result<Vec<Vec<ChatImage>>, String> {
    let path = index_path(session_id)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(&path).map_err(|error| format!("read image index: {error}"))?;
    let index: ImageIndex =
        serde_json::from_slice(&bytes).map_err(|error| format!("image index: {error}"))?;
    let dir = files_dir(session_id)?;
    index
        .turns
        .into_iter()
        .map(|turn| {
            turn.into_iter()
                .map(|stored| load_stored(&dir, stored))
                .collect()
        })
        .collect()
}

fn load_stored(dir: &Path, stored: StoredImage) -> Result<ChatImage, String> {
    let path = dir.join(&stored.file);
    let bytes = fs::read(&path).map_err(|error| format!("read image {}: {error}", stored.file))?;
    Ok(ChatImage {
        mime_type: stored.mime_type,
        data: base64::engine::general_purpose::STANDARD.encode(bytes),
    })
}

fn write_index(session_id: &str, turns: &[Vec<ChatImage>]) -> Result<(), String> {
    let stored: Vec<Vec<StoredImage>> = turns
        .iter()
        .enumerate()
        .map(|(turn_index, turn)| {
            turn.iter()
                .enumerate()
                .map(|(image_index, image)| StoredImage {
                    mime_type: normalize_mime(&image.mime_type),
                    file: file_name(turn_index, image_index),
                })
                .collect()
        })
        .collect();
    write_index_value(session_id, &stored)
}

fn write_stored_index(
    session_id: &str,
    turns: &[Vec<ChatImage>],
    new_files: &[StoredImage],
    turn_index: usize,
) -> Result<(), String> {
    let mut stored: Vec<Vec<StoredImage>> = turns
        .iter()
        .enumerate()
        .map(|(index, turn)| {
            if index == turn_index {
                return new_files.to_vec();
            }
            turn.iter()
                .enumerate()
                .map(|(image_index, image)| StoredImage {
                    mime_type: normalize_mime(&image.mime_type),
                    file: file_name(index, image_index),
                })
                .collect()
        })
        .collect();
    if stored.len() == turn_index {
        stored.push(new_files.to_vec());
    }
    write_index_value(session_id, &stored)
}

fn write_index_value(session_id: &str, turns: &[Vec<StoredImage>]) -> Result<(), String> {
    let path = index_path(session_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("create native-sessions: {error}"))?;
    }
    let index = ImageIndex {
        version: INDEX_VERSION,
        turns: turns.to_vec(),
    };
    let body = serde_json::to_vec(&index).map_err(|error| format!("image index: {error}"))?;
    let tmp = PathBuf::from(format!("{}.tmp", path.display()));
    fs::write(&tmp, body).map_err(|error| format!("write image index: {error}"))?;
    restrict(&tmp)?;
    fs::rename(&tmp, &path).map_err(|error| format!("save image index: {error}"))?;
    restrict(&path)?;
    Ok(())
}

fn write_image_files(
    session_id: &str,
    turn_index: usize,
    images: &[ChatImage],
) -> Result<Vec<StoredImage>, String> {
    let dir = files_dir(session_id)?;
    fs::create_dir_all(&dir).map_err(|error| format!("create image dir: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
    let mut stored = Vec::new();
    for (image_index, image) in images.iter().enumerate() {
        let name = file_name(turn_index, image_index);
        let path = dir.join(&name);
        let bytes = decode_image(&image.data)?;
        fs::write(&path, &bytes).map_err(|error| format!("write image {name}: {error}"))?;
        restrict(&path)?;
        stored.push(StoredImage {
            mime_type: normalize_mime(&image.mime_type),
            file: name,
        });
    }
    Ok(stored)
}

fn file_name(turn_index: usize, image_index: usize) -> String {
    format!("{turn_index}-{image_index}.img")
}

fn restrict(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("restrict {}: {error}", path.display()))?;
    }
    let _ = path;
    Ok(())
}

/// True when this catalog target may receive images.
///
/// Free tier returns true here. Each routed model is checked on its own,
/// because the model is chosen at send time.
pub fn catalog_target_allows_images(
    provider_id: &str,
    base_url: &str,
    model_id: &str,
    saved_vision: bool,
) -> bool {
    match crate::reasoning_levels::vision_from_catalog(provider_id, base_url, model_id) {
        Some(value) => value,
        None => saved_vision,
    }
}

#[cfg(test)]
pub struct TestLedger {
    session_id: String,
}

#[cfg(test)]
impl TestLedger {
    pub fn set(session_id: &str, turns: Vec<Vec<ChatImage>>) -> Self {
        ledgers()
            .lock()
            .expect("image ledgers")
            .insert(session_id.to_string(), turns);
        bind_session(session_id);
        Self {
            session_id: session_id.to_string(),
        }
    }
}

#[cfg(test)]
impl Drop for TestLedger {
    fn drop(&mut self) {
        ledgers()
            .lock()
            .expect("image ledgers")
            .remove(&self.session_id);
        unbind_session();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    fn png(bytes: &[u8]) -> ChatImage {
        ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(bytes),
        }
    }

    struct HomeGuard {
        _lock: std::sync::MutexGuard<'static, ()>,
        _home: tempfile::TempDir,
        previous_home: Option<String>,
        previous_xdg: Option<String>,
    }

    impl Drop for HomeGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.previous_home {
                std::env::set_var("HOME", value);
            } else {
                std::env::remove_var("HOME");
            }
            if let Some(value) = &self.previous_xdg {
                std::env::set_var("XDG_CONFIG_HOME", value);
            } else {
                std::env::remove_var("XDG_CONFIG_HOME");
            }
        }
    }

    fn temp_home() -> HomeGuard {
        let lock = crate::app_config::TEST_CONFIG_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home = tempfile::tempdir().unwrap();
        let previous_home = std::env::var("HOME").ok();
        let previous_xdg = std::env::var("XDG_CONFIG_HOME").ok();
        std::env::set_var("HOME", home.path());
        std::env::remove_var("XDG_CONFIG_HOME");
        HomeGuard {
            _lock: lock,
            _home: home,
            previous_home,
            previous_xdg,
        }
    }

    #[test]
    fn openai_content_is_a_data_url_and_text_stays_a_string() {
        let image = png(b"png-bytes");
        let parts = openai_user_content("what is this", std::slice::from_ref(&image));
        assert_eq!(parts[0]["type"], "text");
        assert_eq!(parts[0]["text"], "what is this");
        assert_eq!(parts[1]["type"], "image_url");
        assert_eq!(
            parts[1]["image_url"]["url"],
            format!("data:image/png;base64,{}", image.data)
        );
        assert_eq!(
            openai_user_content("only text", &[]),
            Value::String("only text".into())
        );
        let image_only = openai_user_content("", &[image]);
        assert_eq!(image_only.as_array().unwrap().len(), 1);
        assert_eq!(image_only[0]["type"], "image_url");
    }

    #[test]
    fn anthropic_content_is_a_base64_image_block() {
        let image = png(b"png-bytes");
        let parts = anthropic_user_content("look", std::slice::from_ref(&image));
        assert_eq!(parts[0]["type"], "image");
        assert_eq!(parts[0]["source"]["type"], "base64");
        assert_eq!(parts[0]["source"]["media_type"], "image/png");
        assert_eq!(parts[0]["source"]["data"], image.data);
        assert_eq!(parts[1]["text"], "look");
    }

    #[test]
    fn gemini_ollama_and_openrouter_use_the_openai_data_url() {
        let image = png(b"shot");
        let content = openai_user_content("see", &[image]);
        let url = content[1]["image_url"]["url"].as_str().unwrap();
        assert!(url.starts_with("data:image/png;base64,"), "{url}");
    }

    #[test]
    fn caps_reject_size_count_and_type() {
        let big = ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(vec![1u8; MAX_IMAGE_BYTES + 1]),
        };
        assert_eq!(validate(&[big]).unwrap_err(), IMAGE_TOO_LARGE);
        let one = png(b"ok");
        let too_many = vec![one.clone(), one.clone(), one.clone(), one.clone(), one];
        assert_eq!(validate(&too_many).unwrap_err(), TOO_MANY_IMAGES);
        let bmp = ChatImage {
            mime_type: "image/bmp".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"bmp"),
        };
        assert_eq!(validate(&[bmp]).unwrap_err(), UNSUPPORTED_IMAGE);
        assert!(validate(&[png(b"ok")]).is_ok());
        assert!(is_supported_mime("image/jpeg"));
        assert!(is_supported_mime("image/webp"));
        assert!(is_supported_mime("image/gif"));
    }

    #[test]
    fn a_text_only_or_unknown_model_does_not_accept_images() {
        assert!(!catalog_target_allows_images(
            "openai",
            "https://api.openai.com/v1",
            "not-a-real-model",
            false
        ));
        assert!(catalog_target_allows_images(
            "openai",
            "https://api.openai.com/v1",
            "not-a-real-model",
            true
        ));
    }

    #[test]
    fn image_sets_pad_old_turns_that_have_no_sidecar() {
        let image = png(b"a");
        let sets = image_sets_for_users(3, &[vec![image.clone()]]);
        assert!(sets[0].is_empty());
        assert!(sets[1].is_empty());
        assert_eq!(sets[2], vec![image]);
    }

    #[test]
    fn sidecar_round_trip_and_an_old_log_without_images() {
        let _home = temp_home();
        let session = uuid::Uuid::new_v4().to_string();
        let image = png(b"round-trip");
        push_turn(&session, vec![image.clone()]).unwrap();
        push_turn(&session, Vec::new()).unwrap();
        let loaded = read_turns(&session).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0][0].mime_type, "image/png");
        assert_eq!(loaded[0][0].data, image.data);
        assert!(loaded[1].is_empty());

        let old = uuid::Uuid::new_v4().to_string();
        let header = crate::engines::native_log::SessionHeader {
            version: crate::engines::native_log::NATIVE_LOG_VERSION,
            session_id: old.clone(),
            created_at: "2026-10-01T00:00:00Z".into(),
            target: "openai/gpt-4.1-mini".into(),
            permission_mode: "safe".into(),
            vault_path: None,
            vault_paths: Vec::new(),
            system_prompt: None,
            reasoning_level: None,
        };
        let old_event = crate::rhizome_loop::DurableEvent::User {
            text: "hello from before images".into(),
        };
        crate::engines::native_log::write_session_events(&header, &[old_event]).unwrap();
        let opened = crate::engines::native_log::open_session_log(&old).unwrap();
        assert!(opened.events.iter().any(|event| matches!(
            event,
            crate::rhizome_loop::DurableEvent::User { text } if text == "hello from before images"
        )));
        assert!(read_turns(&old).unwrap().is_empty());
        let fixture = r#"{"User":{"text":"hello from before images"}}"#;
        let parsed: crate::rhizome_loop::DurableEvent = serde_json::from_str(fixture).unwrap();
        assert!(matches!(
            parsed,
            crate::rhizome_loop::DurableEvent::User { text } if text == "hello from before images"
        ));
    }
}
