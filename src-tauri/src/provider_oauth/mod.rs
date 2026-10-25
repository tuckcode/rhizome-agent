//! Browser sign-in for one account per provider (ADR-0186).
//!
//! ChatGPT uses OpenAI's published dynamic-client flow. Tokens live in the
//! OS keychain under `<provider>:oauth`, next to the API key, not in it.
//! The on/off switch is `oauth-sign-in.json` in the app config folder, not
//! `settings.json`, because the app saves `Settings` as one object.
//!
//! Access tokens, refresh tokens, and ID tokens stay out of logs, errors,
//! Sentry, and analytics. This module does not call Sentry or PostHog.

mod loopback;
mod openai;
mod pkce;

use std::collections::BTreeMap;
use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::provider_keys::ProviderKeys;

const SETTINGS_FILE: &str = "oauth-sign-in.json";
const SIGN_IN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5 * 60);
const REFRESH_WINDOW_SECS: i64 = 300;

pub(crate) const SIGN_IN_AGAIN: &str = "Sign in again";
pub(crate) const NOT_USABLE: &str = "Sign in with ChatGPT is not usable.";
pub(crate) const TURNED_OFF: &str = "Sign in with ChatGPT is turned off.";

/// What the UI can show. No token fields.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct OauthStatus {
    pub provider: String,
    pub enabled: bool,
    pub signed_in: bool,
    pub usable: bool,
    pub email: Option<String>,
    /// False when sign-out deleted the local record but remote revoke failed.
    pub revoked: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct Record {
    #[serde(default)]
    pub(crate) email: Option<String>,
    pub(crate) issuer: String,
    pub(crate) subject: String,
    pub(crate) client_id: String,
    pub(crate) ext_agent_host_id: String,
    #[serde(default)]
    pub(crate) id_token: String,
    #[serde(default)]
    pub(crate) access_token: String,
    #[serde(default)]
    pub(crate) refresh_token: String,
    #[serde(default)]
    pub(crate) token_type: String,
    pub(crate) expires_at: i64,
    #[serde(default)]
    pub(crate) scopes: Vec<String>,
    pub(crate) usable: bool,
    pub(crate) saved_at: i64,
}

impl std::fmt::Debug for Record {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Record")
            .field("email", &self.email)
            .field("client_id", &self.client_id)
            .field("usable", &self.usable)
            .field("access_token", &"[redacted]")
            .field("refresh_token", &"[redacted]")
            .field("id_token", &"[redacted]")
            .finish()
    }
}

impl Record {
    fn cleared(&self) -> Self {
        Self {
            access_token: String::new(),
            refresh_token: String::new(),
            id_token: String::new(),
            usable: false,
            ..self.clone()
        }
    }

    fn cleared_client(&self) -> Self {
        Self {
            client_id: String::new(),
            ..self.cleared()
        }
    }
}

#[derive(Default, Serialize, Deserialize)]
struct SignInSettings {
    #[serde(default)]
    enabled: BTreeMap<String, bool>,
}

pub(super) struct Env {
    keys: ProviderKeys,
    settings_path: PathBuf,
    lock_path: PathBuf,
    endpoints: openai::Endpoints,
    http: reqwest::blocking::Client,
    attempt: Mutex<Option<Arc<std::sync::atomic::AtomicBool>>>,
    refresh: Mutex<()>,
}

pub(crate) struct RefreshLock<'a> {
    _guard: MutexGuard<'a, ()>,
    _file: File,
}

/// Starts ChatGPT sign-in for `provider`. `open_url` opens the system browser.
/// `false` means the page did not open.
pub fn oauth_sign_in(
    provider: &str,
    open_url: impl FnOnce(&str) -> bool,
) -> Result<OauthStatus, String> {
    let env = current()?;
    openai::sign_in(&env, provider, open_url, SIGN_IN_TIMEOUT)
}

/// Email and flags for the saved sign-in. Tokens stay in the keychain.
pub fn oauth_status(provider: &str) -> Result<OauthStatus, String> {
    let env = current()?;
    status_of(&env, provider)
}

/// Revokes the refresh token, then deletes the keychain record.
pub fn oauth_sign_out(provider: &str) -> Result<OauthStatus, String> {
    let env = current()?;
    sign_out_with(&env, provider)
}

/// Ends the sign-in that is waiting for the browser.
pub fn oauth_cancel() {
    if let Ok(env) = current() {
        env.cancel();
    }
}

/// A fresh access token, refreshing when it is inside five minutes of expiry.
pub(crate) fn fresh_access_token(provider: &str) -> Result<String, String> {
    let env = current()?;
    fresh_access_token_with(&env, provider)
}

/// Refreshes even when the saved access token is still inside its window.
/// The same access token coming back is a failure: the caller must not
/// retry a request with the token that just expired.
pub(crate) fn force_refresh(provider: &str) -> Result<String, String> {
    let env = current()?;
    access_token_with(&env, provider, true)
}

fn current() -> Result<Arc<Env>, String> {
    if let Some(env) = override_env()
        .lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .clone()
    {
        return Ok(env);
    }
    process_env()
}

fn process_env() -> Result<Arc<Env>, String> {
    static SLOT: Mutex<Option<Arc<Env>>> = Mutex::new(None);
    let mut slot = SLOT.lock().unwrap_or_else(|poison| poison.into_inner());
    if let Some(env) = slot.clone() {
        return Ok(env);
    }
    let env = Arc::new(Env::process()?);
    *slot = Some(Arc::clone(&env));
    Ok(env)
}

fn override_env() -> &'static Mutex<Option<Arc<Env>>> {
    static OVERRIDE: OnceLock<Mutex<Option<Arc<Env>>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

impl Env {
    fn process() -> Result<Self, String> {
        let dir = config_dir()?;
        Ok(Self {
            keys: ProviderKeys::for_app()?,
            settings_path: dir.join(SETTINGS_FILE),
            lock_path: dir.join("oauth-refresh.lock"),
            endpoints: openai::Endpoints::production(),
            http: http_client(),
            attempt: Mutex::new(None),
            refresh: Mutex::new(()),
        })
    }

    fn cancel(&self) {
        if let Some(flag) = self
            .attempt
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
            .as_ref()
        {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }
}

fn http_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new())
}

fn config_dir() -> Result<PathBuf, String> {
    #[cfg(test)]
    {
        static DIR: OnceLock<PathBuf> = OnceLock::new();
        let path = DIR.get_or_init(|| tempfile::tempdir().expect("oauth temp dir").keep());
        Ok(path.clone())
    }
    #[cfg(not(test))]
    {
        let file = crate::settings::preferred_app_config_path(SETTINGS_FILE)?;
        file.parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "The sign-in setting folder is missing.".to_string())
    }
}

pub(crate) fn fresh_access_token_with(env: &Env, provider: &str) -> Result<String, String> {
    access_token_with(env, provider, false)
}

#[cfg(test)]
pub(crate) fn force_refresh_with(env: &Env, provider: &str) -> Result<String, String> {
    access_token_with(env, provider, true)
}

fn access_token_with(env: &Env, provider: &str, force: bool) -> Result<String, String> {
    let provider = normalize_provider(provider)?;
    let _lock = lock_refresh(env)?;
    let Some(record) = load_record(env, &provider)? else {
        return Err(SIGN_IN_AGAIN.into());
    };
    if record.refresh_token.is_empty() {
        return Err(SIGN_IN_AGAIN.into());
    }
    if !record.usable
        || !record
            .scopes
            .iter()
            .any(|scope| scope == openai::DIRECT_SCOPE)
    {
        return Err(NOT_USABLE.into());
    }
    if !provider_enabled(env, &provider) {
        return Err(turned_off(&provider));
    }
    let previous_access = record.access_token.clone();
    let remaining = record.expires_at.saturating_sub(unix_now());
    if !force && !previous_access.is_empty() && remaining > REFRESH_WINDOW_SECS {
        return Ok(previous_access);
    }
    let parsed = match openai::refresh(env, &record) {
        Ok(parsed) => parsed,
        Err(openai::RefreshFail::Again(cleared)) => {
            let _ = save_rotated(env, &provider, &cleared);
            return Err(SIGN_IN_AGAIN.into());
        }
        Err(openai::RefreshFail::Temporary) => return Err("The token request failed.".into()),
    };
    let mut updated = record.clone();
    if parsed.access_token.is_empty() {
        updated.access_token.clear();
        updated.expires_at = 0;
    } else {
        updated.access_token = parsed.access_token.clone();
        updated.expires_at = unix_now() + parsed.expires_in.unwrap_or(3600).max(0);
    }
    updated.refresh_token = parsed
        .refresh_token
        .filter(|token| !token.is_empty())
        .unwrap_or_else(|| record.refresh_token.clone());
    updated.saved_at = unix_now();
    if let Some(scope) = parsed.scope.as_deref() {
        updated.scopes = openai::split_scopes(scope);
        updated.usable = updated
            .scopes
            .iter()
            .any(|scope| scope == openai::DIRECT_SCOPE);
    }
    // The server may already have burned the previous refresh token.
    save_rotated(env, &provider, &updated)?;
    if updated.access_token.is_empty() {
        return Err("The token request failed.".into());
    }
    if !parsed.id_token.is_empty() {
        match openai::check_id_token(env, &parsed.id_token, &updated.client_id) {
            Ok(openai::IdCheck::Match(identity)) if identity.subject == updated.subject => {
                updated.email = identity.email.or(updated.email);
                updated.id_token = parsed.id_token;
                if let Err(error) = save_rotated(env, &provider, &updated) {
                    log::warn!("could not store the refreshed ChatGPT profile: {error}");
                }
            }
            Ok(openai::IdCheck::Match(_)) => {
                let _ = openai::revoke(env, &updated);
                let _ = save_rotated(env, &provider, &record.cleared());
                return Err(SIGN_IN_AGAIN.into());
            }
            Ok(openai::IdCheck::Failed) | Err(_) => {}
        }
    }
    if !updated.usable {
        return Err(NOT_USABLE.into());
    }
    if force && updated.access_token == previous_access {
        return Err(SIGN_IN_AGAIN.into());
    }
    Ok(updated.access_token)
}

/// Retries a rotated record so a single keychain miss does not drop it.
fn save_rotated(env: &Env, provider: &str, record: &Record) -> Result<(), String> {
    let mut last = String::new();
    for attempt in 0..3 {
        match save_record(env, provider, record) {
            Ok(()) => return Ok(()),
            Err(error) => {
                last = error;
                if attempt < 2 {
                    log::warn!("keychain write failed after rotation");
                }
            }
        }
    }
    Err(last)
}

pub(crate) fn sign_out_with(env: &Env, provider: &str) -> Result<OauthStatus, String> {
    let provider = normalize_provider(provider)?;
    let _lock = lock_refresh(env)?;
    let record = load_record(env, &provider)?;
    let revoke_ok = match record.as_ref() {
        Some(record) if !record.refresh_token.is_empty() => openai::revoke(env, record).is_ok(),
        _ => true,
    };
    env.keys.delete_account(&oauth_account(&provider))?;
    set_provider_enabled(env, &provider, false)?;
    let mut status = status_of(env, &provider)?;
    status.revoked = revoke_ok;
    Ok(status)
}

pub(crate) fn status_of(env: &Env, provider: &str) -> Result<OauthStatus, String> {
    let provider = normalize_provider(provider)?;
    let record = load_record(env, &provider).unwrap_or(None);
    let signed_in = record
        .as_ref()
        .is_some_and(|record| !record.access_token.is_empty() && !record.refresh_token.is_empty());
    let usable = signed_in && record.as_ref().is_some_and(|record| record.usable);
    Ok(OauthStatus {
        enabled: provider_enabled(env, &provider),
        provider,
        signed_in,
        usable,
        email: record.and_then(|record| record.email),
        revoked: true,
    })
}

pub(crate) fn lock_refresh(env: &Env) -> Result<RefreshLock<'_>, String> {
    let guard = env
        .refresh
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    let file = lock_file(&env.lock_path)?;
    Ok(RefreshLock {
        _guard: guard,
        _file: file,
    })
}

fn lock_file(path: &Path) -> Result<File, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|_| "The sign-in lock could not be created.".to_string())?;
    }
    let file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .read(true)
        .write(true)
        .open(path)
        .map_err(|_| "The sign-in lock could not be opened.".to_string())?;
    fs4::FileExt::lock_exclusive(&file)
        .map_err(|_| "The sign-in lock could not be taken.".to_string())?;
    Ok(file)
}

fn provider_enabled(env: &Env, provider: &str) -> bool {
    read_settings(&env.settings_path)
        .enabled
        .get(provider)
        .copied()
        .unwrap_or(false)
}

fn set_provider_enabled(env: &Env, provider: &str, on: bool) -> Result<(), String> {
    let mut settings = read_settings(&env.settings_path);
    settings.enabled.insert(provider.to_string(), on);
    let json = serde_json::to_string(&settings)
        .map_err(|_| "The sign-in setting could not be saved.".to_string())?;
    crate::secure_fs::write_owner_only_atomic(&env.settings_path, &json)
        .map_err(|_| "The sign-in setting could not be saved.".to_string())
}

fn read_settings(path: &Path) -> SignInSettings {
    let Ok(text) = std::fs::read_to_string(path) else {
        return SignInSettings::default();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

pub(super) fn load_record(env: &Env, provider: &str) -> Result<Option<Record>, String> {
    let Some(raw) = env.keys.read_account(&oauth_account(provider))? else {
        return Ok(None);
    };
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|_| SIGN_IN_AGAIN.to_string())
}

pub(super) fn save_record(env: &Env, provider: &str, record: &Record) -> Result<(), String> {
    let json =
        serde_json::to_string(record).map_err(|_| "The sign-in could not be saved.".to_string())?;
    let account = oauth_account(provider);
    env.keys
        .write_account(&account, &json)
        .map_err(|_| "The sign-in could not be saved to the keychain.".to_string())?;
    match env.keys.read_account(&account)? {
        Some(stored) if stored == json => Ok(()),
        _ => Err("The sign-in could not be saved to the keychain.".into()),
    }
}

fn oauth_account(provider: &str) -> String {
    format!("{provider}:oauth")
}

pub(super) fn host_account(provider: &str) -> String {
    format!("{provider}:oauth-host")
}

pub(super) fn host_id(env: &Env, provider: &str) -> Result<String, String> {
    let account = host_account(provider);
    if let Some(existing) = env.keys.read_account(&account)? {
        let uuid = existing.trim_start_matches("urn:uuid:");
        if existing.starts_with("urn:uuid:") && uuid::Uuid::parse_str(uuid).is_ok() {
            return Ok(existing);
        }
    }
    let id = format!("urn:uuid:{}", uuid::Uuid::new_v4());
    env.keys.write_account(&account, &id)?;
    Ok(id)
}

pub(super) fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| i64::try_from(duration.as_secs()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

/// Built-in OpenAI row from the provider presets. ChatGPT sign-in is stored
/// under this id. A custom OpenAI-compatible provider keeps its API key.
pub const BUILTIN_OPENAI_PROVIDER_ID: &str = "openai";

/// True when `provider_id` is the built-in OpenAI provider, ChatGPT sign-in
/// is switched on, and the keychain holds a usable token. PR 2 calls this
/// to choose the Responses API. Custom providers never match.
pub fn provider_is_signed_in_chatgpt(provider_id: &str) -> bool {
    current()
        .map(|env| provider_is_signed_in_with(&env, provider_id))
        .unwrap_or(false)
}

pub(crate) fn provider_is_signed_in_with(env: &Env, provider_id: &str) -> bool {
    let Ok(id) = normalize_provider(provider_id) else {
        return false;
    };
    if id != BUILTIN_OPENAI_PROVIDER_ID || !provider_enabled(env, &id) {
        return false;
    }
    let Ok(Some(record)) = load_record(env, &id) else {
        return false;
    };
    !record.access_token.is_empty()
        && !record.refresh_token.is_empty()
        && record.usable
        && record
            .scopes
            .iter()
            .any(|scope| scope == openai::DIRECT_SCOPE)
}

fn normalize_provider(provider: &str) -> Result<String, String> {
    let id = provider.trim().to_ascii_lowercase();
    if id.is_empty() {
        Err("Provider ID cannot be empty.".into())
    } else {
        Ok(id)
    }
}

fn turned_off(provider: &str) -> String {
    if provider == "openai" {
        TURNED_OFF.to_string()
    } else {
        "Sign in for this provider is turned off.".into()
    }
}

/// Drops token material if a message ever contains it.
pub(super) fn scrub(message: &str, secrets: &[impl AsRef<str>]) -> String {
    let mut out = message.to_string();
    for secret in secrets {
        let secret = secret.as_ref();
        if secret.len() >= 8 {
            out = out.replace(secret, "[redacted]");
        }
    }
    out
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;

    #[derive(Default)]
    pub(crate) struct MemoryKeys {
        values: Mutex<std::collections::HashMap<String, String>>,
    }

    impl crate::provider_keys::SecretBackend for MemoryKeys {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            Ok(self.values.lock().expect("keys").get(account).cloned())
        }

        fn set(&self, account: &str, value: &str) -> Result<(), String> {
            self.values
                .lock()
                .expect("keys")
                .insert(account.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), String> {
            self.values.lock().expect("keys").remove(account);
            Ok(())
        }
    }

    impl Env {
        pub(crate) fn in_dir(dir: &Path, endpoints: openai::Endpoints) -> Self {
            Self::in_dir_with(dir, endpoints, Box::new(MemoryKeys::default()))
        }

        pub(crate) fn in_dir_with(
            dir: &Path,
            endpoints: openai::Endpoints,
            backend: Box<dyn crate::provider_keys::SecretBackend>,
        ) -> Self {
            Self {
                keys: ProviderKeys::new(backend, dir.join("legacy-unused.json")),
                settings_path: dir.join(SETTINGS_FILE),
                lock_path: dir.join("oauth-refresh.lock"),
                endpoints,
                http: http_client(),
                attempt: Mutex::new(None),
                refresh: Mutex::new(()),
            }
        }

        pub(crate) fn read_account(&self, account: &str) -> Result<Option<String>, String> {
            self.keys.read_account(account)
        }
    }

    pub(crate) struct TestSignIn {
        _dir: tempfile::TempDir,
    }

    impl Drop for TestSignIn {
        fn drop(&mut self) {
            *override_env()
                .lock()
                .unwrap_or_else(|poison| poison.into_inner()) = None;
        }
    }

    /// Installs one usable OpenAI sign-in for `fresh_access_token` tests.
    pub(crate) fn install_usable_sign_in(provider: &str, access_token: &str) -> TestSignIn {
        let dir = tempfile::tempdir().expect("dir");
        let env = Arc::new(Env::in_dir(dir.path(), openai::Endpoints::offline()));
        let record = Record {
            email: Some("ada@example.com".into()),
            issuer: openai::ISSUER.into(),
            subject: "subject-1".into(),
            client_id: "oaiapp_test".into(),
            ext_agent_host_id: "urn:uuid:00000000-0000-4000-8000-000000000001".into(),
            id_token: "id-token-not-used".into(),
            access_token: access_token.to_string(),
            refresh_token: "oat-secret-refresh".into(),
            token_type: "Bearer".into(),
            expires_at: unix_now() + 3600,
            scopes: vec![openai::DIRECT_SCOPE.into()],
            usable: true,
            saved_at: unix_now(),
        };
        save_record(&env, provider, &record).expect("save");
        set_provider_enabled(&env, provider, true).expect("enable");
        *override_env()
            .lock()
            .unwrap_or_else(|poison| poison.into_inner()) = Some(env);
        TestSignIn { _dir: dir }
    }
}
