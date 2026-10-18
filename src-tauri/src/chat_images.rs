//! Images on a native chat turn.
//!
//! The composer already stages PNG, JPEG, GIF, and WebP. This module checks
//! the same caps, builds each provider's user content, and keeps the bytes
//! beside the session log so the next turn can send them again.
//!
//! Bytes live in `{session}-images/`, named from `{session}.images.json`.
//! The JSONL event stays text. A log written before images existed has no
//! sidecar and still opens.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use base64::Engine;
use serde_json::{json, Value};

pub const IMAGE_TOO_LARGE: &str = "An image is over 5 MB.";
pub const TOO_MANY_IMAGES: &str = "Only 4 images can be sent with one message.";
pub const UNSUPPORTED_IMAGE: &str = "Only PNG, JPEG, GIF, and WebP images can be sent.";
pub const UNREADABLE_IMAGE: &str = "An image could not be read.";
pub const OMITTED_IMAGE_NOTE: &str = "[image from earlier turn omitted]";

/// Encoded base64 cap so Bedrock and Vertex's 5 MB limit holds.
pub const MAX_IMAGE_ENCODED_BYTES: usize = 5 * 1024 * 1024;
pub const MAX_IMAGES_PER_MESSAGE: usize = 4;
/// Whole request, under Gemini's inline limit.
pub const MAX_REQUEST_ENCODED_BYTES: usize = 12 * 1024 * 1024;
pub const KEPT_IMAGE_TURNS: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum VisionState {
    Yes,
    No,
    #[default]
    Unknown,
}

pub fn text_only_refusal(model: &str) -> String {
    let model = if model.trim().is_empty() {
        "This model"
    } else {
        model.trim()
    };
    format!("{model} can't read images. Remove the image or switch to a model that can.")
}

pub fn unknown_vision_note(model: &str) -> String {
    let model = if model.trim().is_empty() {
        "this model"
    } else {
        model.trim()
    };
    format!("Rhizome doesn't know if {model} can read images.")
}

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
    require_session_id(session_id)?;
    let images = normalize_images(&images)?;
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
    normalize_images(images).map(|_| ())
}

/// Sniffs the bytes and keeps the detected type. The client MIME is not trusted.
pub fn normalize_images(images: &[ChatImage]) -> Result<Vec<ChatImage>, String> {
    if images.len() > MAX_IMAGES_PER_MESSAGE {
        return Err(TOO_MANY_IMAGES.into());
    }
    let mut out = Vec::with_capacity(images.len());
    for image in images {
        let raw = raw_base64(&image.data);
        if raw.len() > MAX_IMAGE_ENCODED_BYTES {
            return Err(IMAGE_TOO_LARGE.into());
        }
        let bytes = decode_image(&image.data)?;
        let Some(mime) = sniff_image(&bytes) else {
            return Err(UNSUPPORTED_IMAGE.into());
        };
        out.push(ChatImage {
            mime_type: mime.to_string(),
            data: raw.to_string(),
        });
    }
    Ok(out)
}

pub fn sniff_image(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png");
    }
    if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    None
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BudgetedTurn {
    pub images: Vec<ChatImage>,
    pub omitted: bool,
}

/// Keeps images on the last few turns, inside the request budget.
/// A text-only model keeps the words and replaces every image with a note.
pub fn budget_turns(turns: &[Vec<ChatImage>], accepts_images: bool) -> Vec<BudgetedTurn> {
    budget_turns_limited(
        turns,
        accepts_images,
        KEPT_IMAGE_TURNS,
        MAX_REQUEST_ENCODED_BYTES,
    )
}

pub fn budget_turns_limited(
    turns: &[Vec<ChatImage>],
    accepts_images: bool,
    keep_turns: usize,
    max_encoded: usize,
) -> Vec<BudgetedTurn> {
    if !accepts_images {
        return turns
            .iter()
            .map(|turn| BudgetedTurn {
                images: Vec::new(),
                omitted: !turn.is_empty(),
            })
            .collect();
    }
    let start = turns.len().saturating_sub(keep_turns);
    let mut budgeted: Vec<BudgetedTurn> = turns
        .iter()
        .enumerate()
        .map(|(index, turn)| {
            if index < start {
                BudgetedTurn {
                    images: Vec::new(),
                    omitted: !turn.is_empty(),
                }
            } else {
                BudgetedTurn {
                    images: turn.clone(),
                    omitted: false,
                }
            }
        })
        .collect();
    let mut used = budgeted
        .iter()
        .map(|turn| encoded_len(&turn.images))
        .sum::<usize>();
    while used > max_encoded {
        let Some(index) = budgeted.iter().position(|turn| !turn.images.is_empty()) else {
            break;
        };
        used = used.saturating_sub(encoded_len(&budgeted[index].images));
        budgeted[index] = BudgetedTurn {
            images: Vec::new(),
            omitted: true,
        };
    }
    budgeted
}

fn encoded_len(images: &[ChatImage]) -> usize {
    images
        .iter()
        .map(|image| raw_base64(&image.data).len())
        .sum()
}

pub fn compose_user_text(text: &str, omitted: bool) -> String {
    if !omitted {
        return text.to_string();
    }
    if text.is_empty() {
        OMITTED_IMAGE_NOTE.to_string()
    } else {
        format!("{text}\n{OMITTED_IMAGE_NOTE}")
    }
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
    require_session_id(session_id)?;
    let path = index_path(session_id)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(&path).map_err(|error| format!("read image index: {error}"))?;
    let index: ImageIndex =
        serde_json::from_slice(&bytes).map_err(|error| format!("image index: {error}"))?;
    let dir = files_dir(session_id)?;
    Ok(index
        .turns
        .into_iter()
        .map(|turn| {
            turn.into_iter()
                .filter_map(|stored| load_stored(&dir, stored))
                .collect()
        })
        .collect())
}

fn load_stored(dir: &Path, stored: StoredImage) -> Option<ChatImage> {
    if !safe_image_file_name(&stored.file) {
        log::warn!("skipped an image index entry with an unexpected file name");
        return None;
    }
    let path = dir.join(&stored.file);
    if !path.starts_with(dir) {
        log::warn!("skipped an image index entry outside the image directory");
        return None;
    }
    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) => {
            log::warn!("skipped a missing image file: {error}");
            return None;
        }
    };
    let mime = sniff_image(&bytes).unwrap_or("image/png");
    Some(ChatImage {
        mime_type: mime.to_string(),
        data: base64::engine::general_purpose::STANDARD.encode(bytes),
    })
}

pub fn require_session_id(session_id: &str) -> Result<(), String> {
    crate::engines::native_log::validate_session_id(session_id)
}

pub fn safe_image_file_name(name: &str) -> bool {
    let Some(stem) = name.strip_suffix(".img") else {
        return false;
    };
    let Some((turn, image)) = stem.split_once('-') else {
        return false;
    };
    !turn.is_empty()
        && !image.is_empty()
        && !stem.contains('/')
        && !name.contains("..")
        && turn.chars().all(|ch| ch.is_ascii_digit())
        && image.chars().all(|ch| ch.is_ascii_digit())
}

pub fn drop_ledger(session_id: &str) {
    ledgers().lock().expect("image ledgers").remove(session_id);
}

pub fn delete_session_images(session_id: &str) -> Result<(), String> {
    require_session_id(session_id)?;
    drop_ledger(session_id);
    let index = index_path(session_id)?;
    if index.exists() {
        fs::remove_file(&index).map_err(|error| format!("delete image index: {error}"))?;
    }
    let dir = files_dir(session_id)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|error| format!("delete image files: {error}"))?;
    }
    Ok(())
}

pub fn copy_session_images(from: &str, to: &str, user_turns: usize) -> Result<(), String> {
    require_session_id(from)?;
    require_session_id(to)?;
    let turns = read_turns(from)?;
    let kept = turns.into_iter().take(user_turns).collect::<Vec<_>>();
    for turn in kept {
        push_turn(to, turn)?;
    }
    Ok(())
}

/// Removes the last saved turn when the send did not start.
pub fn rollback_turn(session_id: &str) -> Result<(), String> {
    require_session_id(session_id)?;
    let mut ledgers = ledgers().lock().expect("image ledgers");
    let Some(turns) = ledgers.get_mut(session_id) else {
        return Ok(());
    };
    let Some(removed) = turns.pop() else {
        return Ok(());
    };
    let index = turns.len();
    if !removed.is_empty() {
        if let Ok(dir) = files_dir(session_id) {
            for image_index in 0..removed.len() {
                let _ = fs::remove_file(dir.join(file_name(index, image_index)));
            }
        }
    }
    let snapshot = turns.clone();
    drop(ledgers);
    write_index(session_id, &snapshot)
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

/// Catalog vision. A saved `true` is an explicit yes. A saved `false` is not
/// a known text-only model: that was the default on every row.
pub fn vision_state(
    provider_id: &str,
    base_url: &str,
    model_id: &str,
    saved_explicit_yes: bool,
) -> VisionState {
    match crate::reasoning_levels::vision_from_catalog(provider_id, base_url, model_id) {
        Some(true) => VisionState::Yes,
        Some(false) => VisionState::No,
        None if saved_explicit_yes => VisionState::Yes,
        None => VisionState::Unknown,
    }
}

pub fn openai_turn_content(text: &str, turn: &BudgetedTurn) -> Value {
    let text = compose_user_text(text, turn.omitted);
    openai_user_content(&text, &turn.images)
}

pub fn anthropic_turn_content(text: &str, turn: &BudgetedTurn) -> Value {
    let text = compose_user_text(text, turn.omitted);
    anthropic_user_content(&text, &turn.images)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    fn png(extra: &[u8]) -> ChatImage {
        let mut bytes = b"\x89PNG\r\n\x1a\n".to_vec();
        bytes.extend_from_slice(extra);
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
            data: "A".repeat(MAX_IMAGE_ENCODED_BYTES + 1),
        };
        assert_eq!(validate(&[big]).unwrap_err(), IMAGE_TOO_LARGE);
        let svg = ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"<svg></svg>"),
        };
        assert_eq!(validate(&[svg]).unwrap_err(), UNSUPPORTED_IMAGE);
        let sniffed = normalize_images(&[png(b"ok")]).unwrap();
        assert_eq!(sniffed[0].mime_type, "image/png");
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
        assert_eq!(
            vision_state(
                "openai",
                "https://api.openai.com/v1",
                "not-a-real-model",
                false
            ),
            VisionState::Unknown
        );
        assert_eq!(
            vision_state(
                "openai",
                "https://api.openai.com/v1",
                "not-a-real-model",
                true
            ),
            VisionState::Yes
        );
        assert_eq!(
            vision_state(
                "openai",
                "https://api.openai.com/v1",
                "gpt-3.5-turbo",
                false
            ),
            VisionState::No
        );
    }

    #[test]
    fn a_failed_send_does_not_shift_later_images() {
        let _home = temp_home();
        let session = uuid::Uuid::new_v4().to_string();
        push_turn(&session, vec![png(b"A")]).unwrap();
        push_turn(&session, Vec::new()).unwrap();
        push_turn(&session, vec![png(b"C")]).unwrap();
        push_turn(&session, vec![png(b"PHANTOM")]).unwrap();
        rollback_turn(&session).unwrap();
        push_turn(&session, vec![png(b"D")]).unwrap();
        let loaded = read_turns(&session).unwrap();
        assert_eq!(loaded.len(), 4);
        assert_eq!(loaded[0].len(), 1);
        assert!(loaded[1].is_empty());
        assert_eq!(loaded[2].len(), 1);
        assert_eq!(loaded[3].len(), 1);
        let sets = image_sets_for_users(4, &loaded);
        assert_eq!(sets[0].len(), 1);
        assert!(sets[1].is_empty());
        assert_eq!(sets[2].len(), 1);
        assert_eq!(sets[3].len(), 1);
    }

    #[test]
    fn a_long_chat_stays_under_the_image_budget_and_keeps_text() {
        let image = png(b"budget");
        let turns = vec![
            vec![image.clone()],
            vec![image.clone()],
            vec![image.clone()],
            vec![image],
        ];
        let budgeted = budget_turns_limited(&turns, true, 2, 10_000);
        let kept: usize = budgeted.iter().map(|turn| encoded_len(&turn.images)).sum();
        assert!(kept <= 10_000);
        assert!(budgeted[0].omitted);
        assert!(budgeted[1].omitted);
        let text_only = budget_turns(&turns, false);
        assert!(text_only.iter().all(|turn| turn.images.is_empty()));
        assert!(text_only.iter().all(|turn| turn.omitted));
        let note = compose_user_text("hello", true);
        assert!(note.starts_with("hello"));
        assert!(note.contains(OMITTED_IMAGE_NOTE));
    }

    #[test]
    fn deleting_a_chat_removes_its_images() {
        let _home = temp_home();
        let session = uuid::Uuid::new_v4().to_string();
        push_turn(&session, vec![png(b"secret")]).unwrap();
        assert!(index_path(&session).unwrap().exists());
        delete_session_images(&session).unwrap();
        assert!(!index_path(&session).unwrap().exists());
        assert!(!files_dir(&session).unwrap().exists());
        assert!(read_turns(&session).unwrap().is_empty());
    }

    #[test]
    fn a_crafted_index_cannot_read_outside_the_image_directory() {
        let _home = temp_home();
        let session = uuid::Uuid::new_v4().to_string();
        let dir = sessions_dir().unwrap();
        fs::create_dir_all(&dir).unwrap();
        let secret = dir.join("secret.txt");
        fs::write(&secret, b"top secret").unwrap();
        let index = index_path(&session).unwrap();
        fs::write(
            &index,
            r#"{"version":1,"turns":[[{"mimeType":"image/png","file":"../../secret.txt"}]]}"#,
        )
        .unwrap();
        let loaded = read_turns(&session).unwrap();
        assert!(loaded[0].is_empty());
        let body = String::from_utf8(fs::read(&secret).unwrap()).unwrap();
        assert_eq!(body, "top secret");
    }

    #[test]
    fn a_missing_image_file_does_not_block_the_rest() {
        let _home = temp_home();
        let session = uuid::Uuid::new_v4().to_string();
        push_turn(&session, vec![png(b"keep")]).unwrap();
        let dir = files_dir(&session).unwrap();
        fs::remove_file(dir.join("0-0.img")).unwrap();
        let loaded = read_turns(&session).unwrap();
        assert!(loaded[0].is_empty());
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
