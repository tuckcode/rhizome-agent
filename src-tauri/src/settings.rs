use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::ai_models::{normalize_ai_model_providers, AiModelProvider};

const SUPPORTED_DEFAULT_AI_AGENTS: &[&str] = &[
    "claude_code",
    "codex",
    "opencode",
    "pi",
    "antigravity",
    "kiro",
    "hermes",
];
pub const DEFAULT_HIDE_GITIGNORED_FILES: bool = true;
/// A spike behind a flag; unset means OFF.
/// See `docs/adr/0163-automatic-consolidation-l0-to-l1.md`.
pub const DEFAULT_AUTOMATIC_CONSOLIDATION_ENABLED: bool = false;
const SUPPORTED_NOTE_WIDTH_MODES: &[&str] = &["normal", "wide"];
/// Fixed color themes from the brand handoff. `rhizome` is the default
/// light/dark pair in `index.css`; the rest are fixed-polarity skins whose
/// token blocks live in `src/themes.css`.
const SUPPORTED_COLOR_THEMES: &[&str] = &[
    "rhizome",
    "dracula",
    "nord",
    "gruvbox-dark",
    "gruvbox-light",
    "solarized-light",
    "solarized-dark",
    "catppuccin-mocha",
    "catppuccin-latte",
    "tokyo-night",
    "one-dark",
    "rose-pine",
    "github-light",
    "everforest",
    "monokai-pro",
];
/// Accent hues selectable on the default `rhizome` theme — matches the 8
/// keys `AccentColorPicker`/`ACCENT_COLOR_PICKER_KEYS` already expose
/// (reused verbatim per AGENTS.md's "reuse the color swatch picker" rule).
const SUPPORTED_ACCENT_COLORS: &[&str] = &[
    "red", "orange", "yellow", "green", "blue", "purple", "pink", "gray",
];
const SUPPORTED_DATE_DISPLAY_FORMATS: &[&str] = &["us", "european", "friendly", "iso"];
const SUPPORTED_UI_LANGUAGE_ALIASES: &[(&str, &str)] = &[
    ("en", "en"),
    ("en-us", "en"),
    ("en-gb", "en"),
    ("en-ca", "en"),
    ("en-au", "en"),
    ("it", "it-IT"),
    ("it-it", "it-IT"),
    ("fr", "fr-FR"),
    ("fr-fr", "fr-FR"),
    ("de", "de-DE"),
    ("de-de", "de-DE"),
    ("ru", "ru-RU"),
    ("ru-ru", "ru-RU"),
    ("es-es", "es-ES"),
    ("pt-br", "pt-BR"),
    ("pt-pt", "pt-PT"),
    ("es-419", "es-419"),
    ("es-ar", "es-419"),
    ("es-bo", "es-419"),
    ("es-cl", "es-419"),
    ("es-co", "es-419"),
    ("es-cr", "es-419"),
    ("es-cu", "es-419"),
    ("es-do", "es-419"),
    ("es-ec", "es-419"),
    ("es-gt", "es-419"),
    ("es-hn", "es-419"),
    ("es-mx", "es-419"),
    ("es-ni", "es-419"),
    ("es-pa", "es-419"),
    ("es-pe", "es-419"),
    ("es-pr", "es-419"),
    ("es-py", "es-419"),
    ("es-sv", "es-419"),
    ("es-us", "es-419"),
    ("es-uy", "es-419"),
    ("es-ve", "es-419"),
    ("zh", "zh-CN"),
    ("zh-cn", "zh-CN"),
    ("zh-hans", "zh-CN"),
    ("zh-sg", "zh-CN"),
    ("zh-tw", "zh-TW"),
    ("zh-hant", "zh-TW"),
    ("zh-hk", "zh-TW"),
    ("zh-mo", "zh-TW"),
    ("ja", "ja-JP"),
    ("ja-jp", "ja-JP"),
    ("ko", "ko-KR"),
    ("ko-kr", "ko-KR"),
    ("vi", "vi"),
    ("vi-vn", "vi"),
    ("pl", "pl-PL"),
    ("pl-pl", "pl-PL"),
    ("be", "be-BY"),
    ("be-by", "be-BY"),
    ("be-latn", "be-Latn"),
    ("id", "id-ID"),
    ("id-id", "id-ID"),
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct AiWorkspaceConversationSetting {
    pub archived: Option<bool>,
    pub id: String,
    pub target_id: Option<String>,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct Settings {
    pub auto_pull_interval_minutes: Option<u32>,
    pub git_enabled: Option<bool>,
    pub autogit_enabled: Option<bool>,
    pub autogit_idle_threshold_seconds: Option<u32>,
    pub autogit_inactive_threshold_seconds: Option<u32>,
    pub auto_advance_inbox_after_organize: Option<bool>,
    pub telemetry_consent: Option<bool>,
    pub crash_reporting_enabled: Option<bool>,
    pub analytics_enabled: Option<bool>,
    pub anonymous_id: Option<String>,
    pub release_channel: Option<String>,
    pub automatic_update_checks_enabled: Option<bool>,
    pub theme_mode: Option<String>,
    pub color_theme: Option<String>,
    pub accent_color: Option<String>,
    pub ui_language: Option<String>,
    pub date_display_format: Option<String>,
    pub note_width_mode: Option<String>,
    pub sidebar_type_pluralization_enabled: Option<bool>,
    pub initial_h1_auto_rename_enabled: Option<bool>,
    /// Gates the L0→L1 automatic-consolidation spike.
    pub automatic_consolidation_enabled: Option<bool>,
    pub default_ai_agent: Option<String>,
    pub default_ai_target: Option<String>,
    pub agent_memory_vault_path: Option<String>,
    pub ai_model_providers: Option<Vec<AiModelProvider>>,
    pub ai_workspace_conversations: Option<Vec<AiWorkspaceConversationSetting>>,
    pub hide_gitignored_files: Option<bool>,
    pub all_notes_show_pdfs: Option<bool>,
    pub all_notes_show_images: Option<bool>,
    pub all_notes_show_unsupported: Option<bool>,
    pub multi_workspace_enabled: Option<bool>,
    /// Keep Prime sessions running after Rhizome is fully closed.
    ///
    /// Off by default, which makes quitting behave the way Claude Code and
    /// Hermes do: closing the harness stops the agent. On, a session outlives
    /// the app so a heartbeat or goal can still fire — the reason ADR-0163
    /// connects to a daemon rather than owning a child process.
    ///
    /// Note this governs the *session*, not Prime's background service. The
    /// daemon is shared infrastructure that starts itself and hosts other
    /// clients' work; Rhizome stops what it started and nothing else.
    pub keep_sessions_running_on_quit: Option<bool>,
    /// Whether finishing something worth marking shows a burst of confetti.
    ///
    /// `None` means "never chosen", which reads as on — the effect is opt-out.
    /// A system-level reduced-motion preference suppresses it regardless of
    /// this, and that check lives in the UI, where the media query is.
    pub celebrations_enabled: Option<bool>,
    /// Prime sessions the user has filed out of the main history list.
    ///
    /// Session ids, not paths — the id is Prime's own and survives a file
    /// moving. Kept here rather than as a change to the log on disk because
    /// `~/.prime/agent/sessions` belongs to Prime and is shared with its CLI
    /// and any other client: archiving is Rhizome's view of the list, and must
    /// not alter what anyone else sees. See `docs/adr/0165-archiving-prime-sessions.md`.
    pub archived_prime_sessions: Option<Vec<String>>,
    /// The models the chat picker shows, as `"provider/id"` keys.
    ///
    /// `None` — the default — means no curation: show the whole catalog. A
    /// non-empty list means the user has chosen a shortlist, and everything
    /// else moves behind a disclosure rather than disappearing, the same way
    /// unconnected providers do. An empty list normalizes back to `None`,
    /// because a list that hides every model is a trap, not a preference.
    ///
    /// Rhizome's own view, like [`Self::archived_prime_sessions`]: nothing
    /// under `~/.prime/agent` is touched, so Prime's CLI and every other
    /// client still see the full catalog.
    pub prime_model_allow_list: Option<Vec<String>>,
    /// Shared secret a browser extension presents to the MCP tool bridge.
    /// Generated once per install by [`ensure_bridge_token`] and never shown
    /// to anyone but the user. See `docs/adr/0159-bridge-token-auth.md`.
    pub bridge_token: Option<String>,
}

/// Return the persisted bridge token, generating and saving one the first
/// time. Split from [`ensure_bridge_token`] so the generate-once-then-stable
/// behavior can be tested without touching the real settings file.
fn ensure_bridge_token_at(path: &PathBuf) -> Result<String, String> {
    let mut settings = get_settings_at(path)?;
    if let Some(token) = settings.bridge_token.clone().filter(|t| !t.is_empty()) {
        return Ok(token);
    }
    let token = uuid::Uuid::new_v4().simple().to_string();
    settings.bridge_token = Some(token.clone());
    save_settings_at(path, settings)?;
    Ok(token)
}

/// The shared secret the ws-bridge hands to browser-extension clients as the
/// price of admission. Stable across restarts once generated.
pub fn ensure_bridge_token() -> Result<String, String> {
    ensure_bridge_token_at(&preferred_app_config_path("settings.json")?)
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
}

/// Trim, drop blanks, and de-duplicate the picker's allow-list.
///
/// Order is the caller's — the settings editor writes catalog order — so this
/// preserves first-seen position rather than sorting. An empty result becomes
/// `None`: "curated down to nothing" and "not curated" must not be two states,
/// or a stray save would empty the chat model menu with no way back to it
/// from the menu itself.
pub fn normalize_prime_model_allow_list(value: Option<Vec<String>>) -> Option<Vec<String>> {
    let mut seen = std::collections::BTreeSet::new();
    let keys = value?
        .into_iter()
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty() && seen.insert(key.clone()))
        .collect::<Vec<_>>();
    (!keys.is_empty()).then_some(keys)
}

fn normalize_optional_positive_u32(value: Option<u32>) -> Option<u32> {
    value.filter(|candidate| *candidate > 0)
}

pub fn normalize_release_channel(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(channel) if channel == "alpha" => Some(channel),
        _ => None,
    }
}

pub fn effective_release_channel(value: Option<&str>) -> &'static str {
    if normalize_release_channel(value).is_some() {
        "alpha"
    } else {
        "stable"
    }
}

pub fn normalize_default_ai_agent(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(agent) if agent == "gemini" => Some("antigravity".to_string()),
        Some(agent) if SUPPORTED_DEFAULT_AI_AGENTS.contains(&agent.as_str()) => Some(agent),
        _ => None,
    }
}

pub fn normalize_theme_mode(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(mode) if mode == "light" || mode == "dark" || mode == "system" => Some(mode),
        _ => None,
    }
}

pub fn normalize_color_theme(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(theme) if SUPPORTED_COLOR_THEMES.contains(&theme.as_str()) => Some(theme),
        _ => None,
    }
}

pub fn normalize_accent_color(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(color) if SUPPORTED_ACCENT_COLORS.contains(&color.as_str()) => Some(color),
        _ => None,
    }
}

pub fn normalize_note_width_mode(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(mode) if SUPPORTED_NOTE_WIDTH_MODES.contains(&mode.as_str()) => Some(mode),
        _ => None,
    }
}

pub fn normalize_date_display_format(value: Option<&str>) -> Option<String> {
    match value.map(|candidate| candidate.trim().to_ascii_lowercase()) {
        Some(format) if SUPPORTED_DATE_DISPLAY_FORMATS.contains(&format.as_str()) => Some(format),
        _ => None,
    }
}

pub fn should_hide_gitignored_files(settings: &Settings) -> bool {
    settings
        .hide_gitignored_files
        .unwrap_or(DEFAULT_HIDE_GITIGNORED_FILES)
}

pub fn hide_gitignored_files_enabled() -> bool {
    get_settings()
        .map(|settings| should_hide_gitignored_files(&settings))
        .unwrap_or(DEFAULT_HIDE_GITIGNORED_FILES)
}

/// Gate for the automatic-consolidation spike.
pub fn automatic_consolidation_enabled(settings: &Settings) -> bool {
    settings
        .automatic_consolidation_enabled
        .unwrap_or(DEFAULT_AUTOMATIC_CONSOLIDATION_ENABLED)
}

fn canonical_language_code(value: &str) -> Option<String> {
    let code = value.trim().replace('_', "-").to_ascii_lowercase();
    if code.is_empty() {
        None
    } else {
        Some(code)
    }
}

pub fn normalize_ui_language(value: Option<&str>) -> Option<String> {
    let language = canonical_language_code(value?)?;
    SUPPORTED_UI_LANGUAGE_ALIASES
        .iter()
        .find_map(|(alias, canonical)| (*alias == language).then(|| (*canonical).to_string()))
}

fn normalize_settings(settings: Settings) -> Settings {
    Settings {
        // Passed through untouched: an id is Prime's own uuid, and there is no
        // normalising to do to a set of them.
        archived_prime_sessions: settings.archived_prime_sessions,
        prime_model_allow_list: normalize_prime_model_allow_list(settings.prime_model_allow_list),
        keep_sessions_running_on_quit: settings.keep_sessions_running_on_quit,
        celebrations_enabled: settings.celebrations_enabled,
        auto_pull_interval_minutes: settings.auto_pull_interval_minutes,
        git_enabled: settings.git_enabled,
        autogit_enabled: settings.autogit_enabled,
        autogit_idle_threshold_seconds: normalize_optional_positive_u32(
            settings.autogit_idle_threshold_seconds,
        ),
        autogit_inactive_threshold_seconds: normalize_optional_positive_u32(
            settings.autogit_inactive_threshold_seconds,
        ),
        auto_advance_inbox_after_organize: settings.auto_advance_inbox_after_organize,
        telemetry_consent: settings.telemetry_consent,
        crash_reporting_enabled: settings.crash_reporting_enabled,
        analytics_enabled: settings.analytics_enabled,
        anonymous_id: normalize_optional_string(settings.anonymous_id),
        bridge_token: normalize_optional_string(settings.bridge_token),
        release_channel: normalize_release_channel(settings.release_channel.as_deref()),
        automatic_update_checks_enabled: settings.automatic_update_checks_enabled,
        theme_mode: normalize_theme_mode(settings.theme_mode.as_deref()),
        color_theme: normalize_color_theme(settings.color_theme.as_deref()),
        accent_color: normalize_accent_color(settings.accent_color.as_deref()),
        ui_language: normalize_ui_language(settings.ui_language.as_deref()),
        date_display_format: normalize_date_display_format(settings.date_display_format.as_deref()),
        note_width_mode: normalize_note_width_mode(settings.note_width_mode.as_deref()),
        sidebar_type_pluralization_enabled: settings.sidebar_type_pluralization_enabled,
        initial_h1_auto_rename_enabled: settings.initial_h1_auto_rename_enabled,
        automatic_consolidation_enabled: settings.automatic_consolidation_enabled,
        default_ai_agent: normalize_default_ai_agent(settings.default_ai_agent.as_deref()),
        default_ai_target: normalize_optional_string(settings.default_ai_target),
        agent_memory_vault_path: normalize_optional_string(settings.agent_memory_vault_path),
        ai_model_providers: normalize_ai_model_providers(settings.ai_model_providers),
        ai_workspace_conversations: normalize_ai_workspace_conversations(
            settings.ai_workspace_conversations,
        ),
        hide_gitignored_files: settings.hide_gitignored_files,
        all_notes_show_pdfs: settings.all_notes_show_pdfs,
        all_notes_show_images: settings.all_notes_show_images,
        all_notes_show_unsupported: settings.all_notes_show_unsupported,
        multi_workspace_enabled: settings.multi_workspace_enabled,
    }
}

fn normalize_ai_workspace_conversations(
    conversations: Option<Vec<AiWorkspaceConversationSetting>>,
) -> Option<Vec<AiWorkspaceConversationSetting>> {
    let normalized: Vec<AiWorkspaceConversationSetting> = conversations
        .unwrap_or_default()
        .into_iter()
        .filter_map(|conversation| {
            let id = conversation.id.trim().to_string();
            let title = conversation.title.trim().to_string();
            if id.is_empty() || title.is_empty() {
                return None;
            }

            Some(AiWorkspaceConversationSetting {
                archived: conversation.archived,
                id,
                target_id: normalize_optional_string(conversation.target_id),
                title,
            })
        })
        .take(100)
        .collect();

    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

pub(crate) fn preferred_app_config_path(file_name: &str) -> Result<PathBuf, String> {
    crate::app_config::preferred_app_config_path(file_name)
}

fn resolve_existing_or_preferred_app_config_path(file_name: &str) -> Result<PathBuf, String> {
    crate::app_config::resolve_existing_or_preferred_app_config_path(file_name)
}

fn settings_path() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("settings.json")
}

fn get_settings_at(path: &PathBuf) -> Result<Settings, String> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read settings: {}", e))?;
    let settings =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))?;
    Ok(normalize_settings(settings))
}

fn save_settings_at(path: &Path, settings: Settings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let cleaned = normalize_settings(settings);

    let json = serde_json::to_string_pretty(&cleaned)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    crate::secure_fs::write_owner_only_atomic(path, &json)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

/// The picker's allow-list, from a settings file that may not exist yet.
///
/// An unreadable file answers "no curation" rather than propagating an error:
/// not knowing what the user curated is a reason to show the whole catalog,
/// never a reason to show nothing. Same refusal the frontend makes.
fn prime_model_allow_list_at(path: &PathBuf) -> Vec<String> {
    get_settings_at(path)
        .ok()
        .and_then(|settings| settings.prime_model_allow_list)
        .unwrap_or_default()
}

/// Replace the picker's allow-list, leaving every other setting alone.
fn set_prime_model_allow_list_at(path: &PathBuf, models: Vec<String>) -> Result<(), String> {
    let mut settings = get_settings_at(path)?;
    settings.prime_model_allow_list = normalize_prime_model_allow_list(Some(models));
    save_settings_at(path, settings)
}

/// See [`prime_model_allow_list_at`].
pub fn prime_model_allow_list() -> Vec<String> {
    settings_path()
        .map(|path| prime_model_allow_list_at(&path))
        .unwrap_or_default()
}

/// See [`set_prime_model_allow_list_at`].
pub fn set_prime_model_allow_list(models: Vec<String>) -> Result<(), String> {
    set_prime_model_allow_list_at(&settings_path()?, models)
}

pub fn get_settings() -> Result<Settings, String> {
    get_settings_at(&settings_path()?)
}

pub fn save_settings(settings: Settings) -> Result<(), String> {
    save_settings_at(&preferred_app_config_path("settings.json")?, settings)
}

fn ai_workspace_sessions_path() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("ai-workspace-sessions.json")
}

fn get_ai_workspace_sessions_at(path: &PathBuf) -> Result<serde_json::Value, String> {
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read AI workspace sessions: {}", e))?;
    let sessions: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse AI workspace sessions: {}", e))?;
    if sessions.is_object() {
        Ok(sessions)
    } else {
        Ok(serde_json::json!({}))
    }
}

fn save_ai_workspace_sessions_at(
    path: &PathBuf,
    sessions: serde_json::Value,
) -> Result<(), String> {
    if !sessions.is_object() {
        return Err("AI workspace sessions must be a JSON object".to_string());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(&sessions)
        .map_err(|e| format!("Failed to serialize AI workspace sessions: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write AI workspace sessions: {}", e))
}

pub fn get_ai_workspace_sessions() -> Result<serde_json::Value, String> {
    get_ai_workspace_sessions_at(&ai_workspace_sessions_path()?)
}

pub fn save_ai_workspace_sessions(sessions: serde_json::Value) -> Result<(), String> {
    save_ai_workspace_sessions_at(
        &preferred_app_config_path("ai-workspace-sessions.json")?,
        sessions,
    )
}

fn last_vault_file() -> Result<PathBuf, String> {
    resolve_existing_or_preferred_app_config_path("last-vault.txt")
}

fn get_last_vault_at(path: &PathBuf) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn set_last_vault_at(path: &PathBuf, vault_path: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    fs::write(path, vault_path.trim())
        .map_err(|e| format!("Failed to write last vault path: {}", e))
}

pub fn get_last_vault() -> Option<String> {
    last_vault_file().ok().and_then(|p| get_last_vault_at(&p))
}

pub fn set_last_vault(vault_path: &str) -> Result<(), String> {
    set_last_vault_at(&preferred_app_config_path("last-vault.txt")?, vault_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_empty_settings(settings: &Settings) {
        assert_eq!(settings, &Settings::default());
    }

    /// Helper: save settings to a temp file and reload them.
    fn save_and_reload(settings: Settings) -> Settings {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_at(&path, settings).unwrap();
        get_settings_at(&path).unwrap()
    }

    #[test]
    fn bridge_token_is_generated_once_and_then_stable() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");

        let first = ensure_bridge_token_at(&path).unwrap();
        assert!(!first.is_empty());
        // A token an attacker could guess is not a token.
        assert_eq!(first.len(), 32, "expected a 32-hex uuid: {first}");
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));

        // Stable across calls, and actually persisted rather than re-derived.
        assert_eq!(ensure_bridge_token_at(&path).unwrap(), first);
        assert_eq!(
            get_settings_at(&path).unwrap().bridge_token.as_deref(),
            Some(first.as_str())
        );
    }

    #[test]
    fn bridge_token_crosses_the_ipc_boundary_under_the_name_the_frontend_reads() {
        // `BridgeTokenRow` reads `settings.bridge_token` off `get_settings`.
        // Nothing else pins that spelling — adding a serde rename_all here
        // would silently blank the Settings panel's token field.
        let json = serde_json::to_value(Settings {
            bridge_token: Some("abc".to_string()),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(json["bridge_token"], "abc");
    }

    #[test]
    fn automatic_consolidation_defaults_off_when_unset() {
        // A spike behind a flag: unlike ai_features, unset means OFF.
        let settings = Settings {
            automatic_consolidation_enabled: None,
            ..Default::default()
        };
        assert!(!automatic_consolidation_enabled(&settings));
    }

    #[test]
    fn automatic_consolidation_survives_save_and_reload() {
        let saved = save_and_reload(Settings {
            automatic_consolidation_enabled: Some(true),
            ..Default::default()
        });
        assert_eq!(saved.automatic_consolidation_enabled, Some(true));
    }

    #[test]
    fn automatic_consolidation_crosses_the_ipc_boundary_under_the_name_the_frontend_reads() {
        let json = serde_json::to_value(Settings {
            automatic_consolidation_enabled: Some(true),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(json["automatic_consolidation_enabled"], true);
    }

    #[test]
    fn bridge_token_replaces_a_blank_stored_value() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_at(
            &path,
            Settings {
                bridge_token: Some("   ".to_string()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(ensure_bridge_token_at(&path).unwrap().len(), 32);
    }

    fn create_last_vault_path(path_parts: &[&str]) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::TempDir::new().unwrap();
        let path = path_parts
            .iter()
            .fold(dir.path().to_path_buf(), |acc, part| acc.join(part));
        (dir, path)
    }

    fn write_and_assert_last_vault(path: &PathBuf, value: &str) {
        set_last_vault_at(path, value).unwrap();
        assert_eq!(get_last_vault_at(path).as_deref(), Some(value));
    }

    #[test]
    fn an_empty_allow_list_means_no_curation_rather_than_an_empty_menu() {
        // The dangerous state: a user unticks the last model, or a bad write
        // lands `[]`. If that persisted as a real filter the chat picker would
        // be empty and offer no way to undo itself.
        assert_eq!(normalize_prime_model_allow_list(Some(Vec::new())), None);
        assert_eq!(
            normalize_prime_model_allow_list(Some(vec!["   ".into(), "".into()])),
            None
        );
        assert_eq!(normalize_prime_model_allow_list(None), None);
    }

    #[test]
    fn allow_list_keys_are_trimmed_deduped_and_left_in_catalog_order() {
        assert_eq!(
            normalize_prime_model_allow_list(Some(vec![
                " xai/grok-4.5 ".into(),
                "anthropic/claude-opus-5".into(),
                "xai/grok-4.5".into(),
            ])),
            Some(vec![
                "xai/grok-4.5".to_string(),
                "anthropic/claude-opus-5".to_string(),
            ])
        );
    }

    #[test]
    fn saving_settings_normalizes_the_allow_list_on_the_way_to_disk() {
        let reloaded = save_and_reload(Settings {
            prime_model_allow_list: Some(vec!["  xai/grok-4.5  ".into(), " ".into()]),
            ..Default::default()
        });
        assert_eq!(
            reloaded.prime_model_allow_list,
            Some(vec!["xai/grok-4.5".to_string()])
        );
    }

    #[test]
    fn allow_list_crosses_the_ipc_boundary_under_the_name_the_frontend_reads() {
        // `useSettings` and the picker both read `prime_model_allow_list` off
        // `get_settings`; nothing else pins that spelling.
        let json = serde_json::to_value(Settings {
            prime_model_allow_list: Some(vec!["xai/grok-4.5".to_string()]),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(json["prime_model_allow_list"][0], "xai/grok-4.5");
    }

    #[test]
    fn an_absent_settings_file_reads_as_an_uncurated_model_menu() {
        let dir = tempfile::TempDir::new().unwrap();
        assert!(prime_model_allow_list_at(&dir.path().join("settings.json")).is_empty());
    }

    #[test]
    fn setting_the_allow_list_normalizes_and_leaves_other_settings_alone() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_at(
            &path,
            Settings {
                accent_color: Some("purple".to_string()),
                ..Default::default()
            },
        )
        .unwrap();

        set_prime_model_allow_list_at(&path, vec![" xai/grok-4.5 ".into(), "  ".into()]).unwrap();

        assert_eq!(
            prime_model_allow_list_at(&path),
            vec!["xai/grok-4.5".to_string()]
        );
        assert_eq!(
            get_settings_at(&path).unwrap().accent_color.as_deref(),
            Some("purple")
        );
    }

    #[test]
    fn clearing_the_allow_list_restores_the_whole_catalog() {
        // "Show all" writes an empty list, which must land as *no curation*
        // rather than a filter that matches nothing.
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        set_prime_model_allow_list_at(&path, vec!["xai/grok-4.5".into()]).unwrap();

        set_prime_model_allow_list_at(&path, Vec::new()).unwrap();

        assert!(prime_model_allow_list_at(&path).is_empty());
        assert_eq!(get_settings_at(&path).unwrap().prime_model_allow_list, None);
    }

    #[test]
    fn test_default_settings_all_none() {
        assert_empty_settings(&Settings::default());
    }

    #[test]
    fn test_settings_json_roundtrip() {
        let settings = Settings {
            archived_prime_sessions: Some(vec!["01a0252e-filed".to_string()]),
            prime_model_allow_list: Some(vec!["opencode/hy3-free".to_string()]),
            keep_sessions_running_on_quit: Some(true),
            celebrations_enabled: Some(false),
            auto_pull_interval_minutes: Some(10),
            git_enabled: Some(false),
            autogit_enabled: Some(true),
            autogit_idle_threshold_seconds: Some(90),
            autogit_inactive_threshold_seconds: Some(30),
            auto_advance_inbox_after_organize: Some(true),
            telemetry_consent: Some(true),
            crash_reporting_enabled: Some(true),
            analytics_enabled: Some(false),
            anonymous_id: Some("abc-123-uuid".to_string()),
            release_channel: Some("alpha".to_string()),
            automatic_update_checks_enabled: Some(false),
            theme_mode: Some("dark".to_string()),
            color_theme: Some("tokyo-night".to_string()),
            accent_color: Some("purple".to_string()),
            ui_language: Some("zh-Hans".to_string()),
            date_display_format: Some("iso".to_string()),
            note_width_mode: Some("wide".to_string()),
            sidebar_type_pluralization_enabled: Some(false),
            initial_h1_auto_rename_enabled: Some(false),
            automatic_consolidation_enabled: Some(true),
            default_ai_agent: Some("codex".to_string()),
            default_ai_target: Some("agent:codex".to_string()),
            agent_memory_vault_path: Some("/Users/x/Rhizome Vault".to_string()),
            ai_model_providers: None,
            ai_workspace_conversations: None,
            hide_gitignored_files: Some(false),
            multi_workspace_enabled: Some(true),
            all_notes_show_pdfs: Some(true),
            all_notes_show_images: Some(true),
            all_notes_show_unsupported: Some(false),
            bridge_token: Some("deadbeefdeadbeefdeadbeefdeadbeef".to_string()),
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, settings);
    }

    #[test]
    fn test_get_settings_returns_default_for_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");
        let result = get_settings_at(&path).unwrap();
        assert!(result.auto_pull_interval_minutes.is_none());
    }

    #[test]
    fn test_save_and_load_preserves_values() {
        let loaded = save_and_reload(Settings {
            auto_pull_interval_minutes: Some(10),
            git_enabled: Some(false),
            autogit_enabled: Some(true),
            autogit_idle_threshold_seconds: Some(90),
            autogit_inactive_threshold_seconds: Some(30),
            auto_advance_inbox_after_organize: Some(true),
            release_channel: Some("alpha".to_string()),
            automatic_update_checks_enabled: Some(false),
            theme_mode: Some("dark".to_string()),
            color_theme: Some("tokyo-night".to_string()),
            accent_color: Some("purple".to_string()),
            ui_language: Some("zh-Hans".to_string()),
            date_display_format: Some("european".to_string()),
            note_width_mode: Some("wide".to_string()),
            sidebar_type_pluralization_enabled: Some(false),
            initial_h1_auto_rename_enabled: Some(false),
            default_ai_agent: Some("codex".to_string()),
            agent_memory_vault_path: Some("  /Users/x/Rhizome Vault  ".to_string()),
            hide_gitignored_files: Some(false),
            multi_workspace_enabled: Some(true),
            all_notes_show_pdfs: Some(true),
            all_notes_show_images: Some(false),
            all_notes_show_unsupported: Some(true),
            ..Default::default()
        });
        assert_eq!(loaded.auto_pull_interval_minutes, Some(10));
        assert_eq!(loaded.git_enabled, Some(false));
        assert_eq!(loaded.autogit_enabled, Some(true));
        assert_eq!(loaded.autogit_idle_threshold_seconds, Some(90));
        assert_eq!(loaded.autogit_inactive_threshold_seconds, Some(30));
        assert_eq!(loaded.auto_advance_inbox_after_organize, Some(true));
        assert_eq!(loaded.release_channel.as_deref(), Some("alpha"));
        assert_eq!(loaded.automatic_update_checks_enabled, Some(false));
        assert_eq!(loaded.theme_mode.as_deref(), Some("dark"));
        assert_eq!(loaded.ui_language.as_deref(), Some("zh-CN"));
        assert_eq!(loaded.date_display_format.as_deref(), Some("european"));
        assert_eq!(loaded.note_width_mode.as_deref(), Some("wide"));
        assert_eq!(loaded.sidebar_type_pluralization_enabled, Some(false));
        assert_eq!(loaded.initial_h1_auto_rename_enabled, Some(false));
        assert_eq!(loaded.default_ai_agent.as_deref(), Some("codex"));
        assert_eq!(
            loaded.agent_memory_vault_path.as_deref(),
            Some("/Users/x/Rhizome Vault")
        );
        assert_eq!(loaded.hide_gitignored_files, Some(false));
        assert_eq!(loaded.multi_workspace_enabled, Some(true));
        assert_eq!(loaded.all_notes_show_pdfs, Some(true));
        assert_eq!(loaded.all_notes_show_images, Some(false));
        assert_eq!(loaded.all_notes_show_unsupported, Some(true));
    }

    #[test]
    fn test_gitignored_files_are_hidden_by_default() {
        assert!(should_hide_gitignored_files(&Settings::default()));
        assert!(should_hide_gitignored_files(&Settings {
            hide_gitignored_files: Some(true),
            ..Default::default()
        }));
        assert!(!should_hide_gitignored_files(&Settings {
            hide_gitignored_files: Some(false),
            ..Default::default()
        }));
    }

    #[test]
    fn test_save_trims_whitespace() {
        let loaded = save_and_reload(Settings {
            anonymous_id: Some("  test-uuid  ".to_string()),
            release_channel: Some("  alpha  ".to_string()),
            theme_mode: Some("  dark  ".to_string()),
            ui_language: Some("  zh-cn  ".to_string()),
            date_display_format: Some("  ISO  ".to_string()),
            note_width_mode: Some("  WIDE  ".to_string()),
            default_ai_agent: Some("  codex  ".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.anonymous_id.as_deref(), Some("test-uuid"));
        assert_eq!(loaded.release_channel.as_deref(), Some("alpha"));
        assert_eq!(loaded.theme_mode.as_deref(), Some("dark"));
        assert_eq!(loaded.ui_language.as_deref(), Some("zh-CN"));
        assert_eq!(loaded.date_display_format.as_deref(), Some("iso"));
        assert_eq!(loaded.note_width_mode.as_deref(), Some("wide"));
        assert_eq!(loaded.default_ai_agent.as_deref(), Some("codex"));
    }

    #[test]
    fn test_save_filters_empty_and_whitespace_only() {
        let loaded = save_and_reload(Settings {
            release_channel: Some("".to_string()),
            ..Default::default()
        });
        assert!(loaded.release_channel.is_none());
    }

    #[test]
    fn test_non_positive_autogit_thresholds_are_filtered() {
        let loaded = save_and_reload(Settings {
            autogit_idle_threshold_seconds: Some(0),
            autogit_inactive_threshold_seconds: Some(0),
            ..Default::default()
        });
        assert!(loaded.autogit_idle_threshold_seconds.is_none());
        assert!(loaded.autogit_inactive_threshold_seconds.is_none());
    }

    #[test]
    fn test_non_alpha_release_channels_normalize_to_stable() {
        let loaded = save_and_reload(Settings {
            release_channel: Some("beta".to_string()),
            ..Default::default()
        });
        assert!(loaded.release_channel.is_none());
    }

    #[test]
    fn test_invalid_default_ai_agent_is_filtered() {
        let loaded = save_and_reload(Settings {
            default_ai_agent: Some("cursor".to_string()),
            ..Default::default()
        });
        assert!(loaded.default_ai_agent.is_none());
    }

    #[test]
    fn test_opencode_default_ai_agent_is_preserved() {
        let loaded = save_and_reload(Settings {
            default_ai_agent: Some("opencode".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.default_ai_agent.as_deref(), Some("opencode"));
    }

    #[test]
    fn test_pi_default_ai_agent_is_preserved() {
        let loaded = save_and_reload(Settings {
            default_ai_agent: Some("pi".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.default_ai_agent.as_deref(), Some("pi"));
    }

    #[test]
    fn test_antigravity_default_ai_agent_is_preserved() {
        let loaded = save_and_reload(Settings {
            default_ai_agent: Some("antigravity".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.default_ai_agent.as_deref(), Some("antigravity"));
    }

    #[test]
    fn test_legacy_gemini_default_ai_agent_migrates_to_antigravity() {
        let loaded = save_and_reload(Settings {
            default_ai_agent: Some("gemini".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.default_ai_agent.as_deref(), Some("antigravity"));
    }

    #[test]
    fn test_color_theme_roundtrips_and_trims() {
        let loaded = save_and_reload(Settings {
            color_theme: Some("  Dracula  ".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.color_theme.as_deref(), Some("dracula"));
    }

    #[test]
    fn test_every_supported_color_theme_is_preserved() {
        for slug in SUPPORTED_COLOR_THEMES {
            let loaded = save_and_reload(Settings {
                color_theme: Some((*slug).to_string()),
                ..Default::default()
            });
            assert_eq!(loaded.color_theme.as_deref(), Some(*slug));
        }
    }

    #[test]
    fn test_invalid_color_theme_is_filtered() {
        let loaded = save_and_reload(Settings {
            color_theme: Some("hotdog-stand".to_string()),
            ..Default::default()
        });
        assert!(loaded.color_theme.is_none());
    }

    #[test]
    fn test_accent_color_roundtrips_and_filters() {
        let loaded = save_and_reload(Settings {
            accent_color: Some("Green".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.accent_color.as_deref(), Some("green"));

        let invalid = save_and_reload(Settings {
            accent_color: Some("magenta-ish".to_string()),
            ..Default::default()
        });
        assert!(invalid.accent_color.is_none());
    }

    #[test]
    fn test_hermes_default_ai_agent_is_preserved() {
        let loaded = save_and_reload(Settings {
            default_ai_agent: Some("hermes".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.default_ai_agent.as_deref(), Some("hermes"));
    }

    #[test]
    fn test_system_theme_mode_is_preserved() {
        let loaded = save_and_reload(Settings {
            theme_mode: Some("system".to_string()),
            ..Default::default()
        });
        assert_eq!(loaded.theme_mode.as_deref(), Some("system"));
    }

    #[test]
    fn test_invalid_theme_mode_is_filtered() {
        let loaded = save_and_reload(Settings {
            theme_mode: Some("sepia".to_string()),
            ..Default::default()
        });
        assert!(loaded.theme_mode.is_none());
    }

    #[test]
    fn test_invalid_note_width_mode_is_filtered() {
        let loaded = save_and_reload(Settings {
            note_width_mode: Some("expanded".to_string()),
            ..Default::default()
        });
        assert!(loaded.note_width_mode.is_none());
    }

    #[test]
    fn test_invalid_date_display_format_is_filtered() {
        let loaded = save_and_reload(Settings {
            date_display_format: Some("relative".to_string()),
            ..Default::default()
        });
        assert!(loaded.date_display_format.is_none());
    }

    #[test]
    fn test_invalid_ui_language_is_filtered() {
        let loaded = save_and_reload(Settings {
            ui_language: Some("xx-ZZ".to_string()),
            ..Default::default()
        });
        assert!(loaded.ui_language.is_none());
    }

    #[test]
    fn test_supported_ui_languages_are_saved_and_reloaded() {
        let expected_languages = [
            ("it-IT", "it-IT"),
            ("fr-FR", "fr-FR"),
            ("de-DE", "de-DE"),
            ("ru-RU", "ru-RU"),
            ("es-ES", "es-ES"),
            ("pt-BR", "pt-BR"),
            ("pt-PT", "pt-PT"),
            ("es-419", "es-419"),
            ("zh-CN", "zh-CN"),
            ("zh-TW", "zh-TW"),
            ("ja-JP", "ja-JP"),
            ("ko-KR", "ko-KR"),
            ("vi", "vi"),
            ("pl-PL", "pl-PL"),
            ("be-BY", "be-BY"),
            ("be-Latn", "be-Latn"),
            ("id-ID", "id-ID"),
        ];

        for (input, expected) in expected_languages {
            let loaded = save_and_reload(Settings {
                ui_language: Some(input.to_string()),
                ..Default::default()
            });
            assert_eq!(loaded.ui_language.as_deref(), Some(expected));
        }
    }

    #[test]
    fn test_ui_language_aliases_are_canonicalized() {
        assert_eq!(normalize_ui_language(Some("en-US")).as_deref(), Some("en"));
        assert_eq!(
            normalize_ui_language(Some("zh_CN")).as_deref(),
            Some("zh-CN")
        );
        assert_eq!(
            normalize_ui_language(Some("zh-Hant")).as_deref(),
            Some("zh-TW")
        );
        assert_eq!(normalize_ui_language(Some("pl")).as_deref(), Some("pl-PL"));
        assert_eq!(normalize_ui_language(Some("be")).as_deref(), Some("be-BY"));
        assert_eq!(
            normalize_ui_language(Some("be-latn")).as_deref(),
            Some("be-Latn")
        );
        assert_eq!(normalize_ui_language(Some("id")).as_deref(), Some("id-ID"));
    }

    #[test]
    fn test_get_settings_normalizes_legacy_beta_channel() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, r#"{"release_channel":"beta"}"#).unwrap();

        let loaded = get_settings_at(&path).unwrap();
        assert!(loaded.release_channel.is_none());
    }

    #[test]
    fn test_save_creates_parent_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nested").join("dir").join("settings.json");

        save_settings_at(
            &path,
            Settings {
                anonymous_id: Some("test-uuid".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
        assert!(path.exists());
        assert_eq!(
            get_settings_at(&path).unwrap().anonymous_id.as_deref(),
            Some("test-uuid")
        );
    }

    #[test]
    fn test_get_settings_malformed_json() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("bad.json");
        fs::write(&path, "not valid json{{{").unwrap();

        let err = get_settings_at(&path).unwrap_err();
        assert!(err.contains("Failed to parse settings"));
    }

    #[test]
    fn test_telemetry_fields_roundtrip() {
        let loaded = save_and_reload(Settings {
            telemetry_consent: Some(true),
            crash_reporting_enabled: Some(true),
            analytics_enabled: Some(false),
            anonymous_id: Some("test-uuid-v4".to_string()),
            ..Default::default()
        });
        assert_eq!(
            loaded,
            Settings {
                telemetry_consent: Some(true),
                crash_reporting_enabled: Some(true),
                analytics_enabled: Some(false),
                anonymous_id: Some("test-uuid-v4".to_string()),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_old_settings_json_missing_telemetry_fields() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        // Simulate an old settings.json that still contains removed GitHub auth fields.
        let legacy_token = ["gho", "test"].join("_");
        let legacy_settings = serde_json::json!({
            "github_token": legacy_token,
            "github_username": "lucaong",
        });
        fs::write(&path, legacy_settings.to_string()).unwrap();
        let loaded = get_settings_at(&path).unwrap();
        assert_empty_settings(&loaded);
    }

    #[test]
    fn test_settings_path_returns_ok() {
        let result = settings_path();
        assert!(result.is_ok());
        let path = result.unwrap();
        let path = path.to_str().unwrap();
        assert!(
            path.contains("com.rhizome.app")
                || path.contains("com.tolaria.app")
                || path.contains("com.laputa.app")
        );
    }

    #[test]
    fn test_preferred_settings_path_uses_rhizome_namespace() {
        let result = preferred_app_config_path("settings.json");
        assert!(result.is_ok());
        assert!(result
            .unwrap()
            .to_str()
            .unwrap()
            .contains("com.rhizome.app"));
    }

    #[test]
    fn test_ai_workspace_sessions_roundtrip() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("ai-workspace-sessions.json");
        let sessions = serde_json::json!({
            "chat-1": {
                "messages": [
                    {
                        "userMessage": "Hello",
                        "actions": [],
                        "response": "Hi"
                    }
                ],
                "status": "done"
            }
        });

        save_ai_workspace_sessions_at(&path, sessions.clone()).unwrap();

        assert_eq!(get_ai_workspace_sessions_at(&path).unwrap(), sessions);
    }

    #[test]
    fn test_ai_workspace_sessions_missing_file_returns_empty_object() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("ai-workspace-sessions.json");

        assert_eq!(
            get_ai_workspace_sessions_at(&path).unwrap(),
            serde_json::json!({})
        );
    }

    #[test]
    fn test_ai_workspace_sessions_rejects_non_object_payload() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("ai-workspace-sessions.json");

        assert!(save_ai_workspace_sessions_at(&path, serde_json::json!([])).is_err());
    }

    #[test]
    fn test_get_last_vault_returns_none_for_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("last-vault.txt");
        assert!(get_last_vault_at(&path).is_none());
    }

    #[test]
    fn test_set_and_get_last_vault_roundtrip() {
        let (_dir, path) = create_last_vault_path(&["last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/MyVault");
    }

    #[test]
    fn test_set_last_vault_trims_whitespace() {
        let (_dir, path) = create_last_vault_path(&["last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/Vault");
    }

    #[test]
    fn test_get_last_vault_returns_none_for_empty_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("last-vault.txt");
        fs::write(&path, "   \n  ").unwrap();
        assert!(get_last_vault_at(&path).is_none());
    }

    #[test]
    fn test_set_last_vault_creates_parent_directories() {
        let (_dir, path) = create_last_vault_path(&["nested", "dir", "last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/Vault");
        assert!(path.exists());
    }

    #[test]
    fn test_set_last_vault_overwrites_previous() {
        let (_dir, path) = create_last_vault_path(&["last-vault.txt"]);
        write_and_assert_last_vault(&path, "/Users/test/OldVault");
        write_and_assert_last_vault(&path, "/Users/test/NewVault");
    }

    #[cfg(unix)]
    #[test]
    fn save_settings_creates_an_owner_only_file() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_at(
            &path,
            Settings {
                bridge_token: Some("fixture-bridge-token-32chars!!".into()),
                ..Default::default()
            },
        )
        .unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        assert_eq!(
            get_settings_at(&path).unwrap().bridge_token.as_deref(),
            Some("fixture-bridge-token-32chars!!")
        );
    }

    #[cfg(unix)]
    #[test]
    fn save_settings_tightens_an_existing_permissive_file() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, "{}").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();

        save_settings_at(
            &path,
            Settings {
                anonymous_id: Some("fixture-anon".into()),
                ..Default::default()
            },
        )
        .unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        assert_eq!(
            get_settings_at(&path).unwrap().anonymous_id.as_deref(),
            Some("fixture-anon")
        );
    }

    #[cfg(unix)]
    #[test]
    fn save_settings_replaces_a_symlink_instead_of_writing_through_it() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::TempDir::new().unwrap();
        let outside = dir.path().join("outside.json");
        let path = dir.path().join("settings.json");
        fs::write(&outside, "{\"marker\":\"RHIZOME_R2_OUTSIDE\"}\n").unwrap();
        symlink(&outside, &path).unwrap();

        save_settings_at(
            &path,
            Settings {
                anonymous_id: Some("inside-fixture".into()),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(
            fs::read_to_string(&outside).unwrap(),
            "{\"marker\":\"RHIZOME_R2_OUTSIDE\"}\n"
        );
        assert!(!path.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(
            get_settings_at(&path).unwrap().anonymous_id.as_deref(),
            Some("inside-fixture")
        );
    }
}
