//! Provider API keys in the OS keychain (ADR-0182 decision 4, ADR-0183).
//!
//! One key per provider, stored under the service `ai.rhizome.agent` with
//! the provider id as the account. Cloudflare also stores its account id,
//! under `<provider id>:account`.
//!
//! **Legacy file.** Keys used to sit in `ai-provider-secrets.json` in the app
//! config folder. That file exists on real machines, so it is read as a
//! compatibility path, and each key moves into the keychain the first time it
//! is read: write, read back, then remove it from the file. The file is
//! deleted when it holds no keys. A crash between those steps is safe: the
//! next read finds the same value in both places and finishes the removal.
//! If the write or the read-back fails, the file copy stays and still works.
//! A save that does not read back restores the previous keychain value when
//! it can. A previous entry that cannot be read does not block the new key.
//!
//! A legacy file that cannot be read is logged once per provider and ignored, so a key
//! already in the keychain still works. Key values never appear in an error
//! message or that log line. Errors and `MigrationReport` name the provider
//! id only.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::rhizome_routing::{Credential, KeyStore};

/// The keychain service every provider key is stored under.
pub const KEYCHAIN_SERVICE: &str = "ai.rhizome.agent";

/// The legacy key file name in the app config folder.
pub const LEGACY_FILE_NAME: &str = "ai-provider-secrets.json";

/// Where secrets are kept. The OS keychain in the app. A map in tests.
pub trait SecretBackend: Send + Sync {
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn set(&self, account: &str, value: &str) -> Result<(), String>;
    /// Deleting an account that does not exist is not an error.
    fn delete(&self, account: &str) -> Result<(), String>;
    /// Counts a save, delete, or restore on this store. The process-wide
    /// cache bump is separate; this one is per backend so a test can see
    /// exactly how many times its own store changed.
    fn note_change(&self) {}
    fn change_count(&self) -> u64 {
        0
    }
}

/// The legacy file shape: `{ "provider_api_keys": { "<id>": "<key>" } }`.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct LegacySecrets {
    pub(crate) provider_api_keys: BTreeMap<String, String>,
}

/// What one migration pass did, by provider id. Never holds key values.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MigrationReport {
    pub moved: Vec<String>,
    /// Provider ids whose file copy stays, with the reason.
    pub kept: Vec<(String, String)>,
}

pub struct ProviderKeys {
    backend: Box<dyn SecretBackend>,
    legacy: LegacyFile,
    /// Credentials already read, so the router does not read the keychain
    /// for every provider and model on every message. Emptied when any key
    /// is saved, deleted, or moved (`KEY_GENERATION`), and after
    /// `CACHE_TTL`, so a key changed outside Rhizome is picked up too.
    credentials: Mutex<CredentialCache>,
}

#[derive(Default)]
struct CredentialCache {
    generation: u64,
    loaded_at: Option<Instant>,
    entries: BTreeMap<String, Option<Credential>>,
}

impl ProviderKeys {
    pub fn new(backend: Box<dyn SecretBackend>, legacy_file: PathBuf) -> Self {
        Self {
            backend,
            legacy: LegacyFile { path: legacy_file },
            credentials: Mutex::new(CredentialCache::default()),
        }
    }

    /// The app's store: the OS keychain and the real legacy file.
    ///
    /// Test builds get an in-memory backend and a legacy path that never
    /// exists, so no test can read or change a real key.
    pub fn for_app() -> Result<Self, String> {
        Ok(Self::new(app_backend(), app_legacy_file()?))
    }

    /// The key for `provider_id`, from the keychain, or from the legacy file
    /// (moving it into the keychain on the way). `None` when neither has one.
    pub fn get(&self, provider_id: &str) -> Result<Option<String>, String> {
        let id = normalize_id(provider_id)?;
        let stored = match self.backend.get(&id) {
            Ok(stored) => stored.filter(|key| !key.trim().is_empty()),
            // A locked or missing keychain must not break a key that still
            // sits in the legacy file. A legacy file that cannot be read
            // must not hide that keychain failure.
            Err(error) => {
                return match self.legacy.key(&id) {
                    Ok(key) => Ok(key),
                    Err(_legacy_error) => {
                        note_legacy(&id);
                        Err(keychain_error(&id, &error))
                    }
                };
            }
        };
        match self.migrate_one(&id, stored.as_deref())? {
            Step::Moved(key) | Step::Kept(key, _) => Ok(Some(key)),
            Step::NoFileKey => Ok(stored),
        }
    }

    /// Saves a key, checks it reads back, then drops any legacy file copy so
    /// an old key cannot shadow the new one.
    pub fn save(&self, provider_id: &str, api_key: &str) -> Result<(), String> {
        let id = normalize_id(provider_id)?;
        let key = api_key.trim();
        if key.is_empty() {
            return Err("API key cannot be empty.".into());
        }
        let previous = match self.backend.get(&id) {
            Ok(value) => Previous::Known(value),
            Err(_error) => {
                log::warn!(
                    "The previous keychain entry could not be read. The new key will still be saved if it reads back."
                );
                Previous::Unknown
            }
        };
        self.backend.set(&id, key)?;
        self.bump_keys();
        if keychain_holds(&self.backend.get(&id), Some(key)) {
            return self.drop_legacy_copy(&id);
        }
        let outcome = self.restore_after_mismatch(&id, &previous);
        // A try_credential between the first set and this restore can cache
        // the unverified value. Bump again so that cache entry is dropped.
        self.bump_keys();
        Err(read_back_message(&id, outcome))
    }

    fn restore_after_mismatch(&self, id: &str, previous: &Previous) -> ReadBack {
        match previous {
            Previous::Unknown => ReadBack::Unconfirmed {
                previous_unknown: true,
            },
            Previous::Known(Some(old)) => {
                if self.backend.set(id, old).is_err() {
                    return ReadBack::NotRestored { had_previous: true };
                }
                if keychain_holds(&self.backend.get(id), Some(old.as_str())) {
                    ReadBack::RestoredPrevious
                } else {
                    ReadBack::Unconfirmed {
                        previous_unknown: false,
                    }
                }
            }
            Previous::Known(None) => {
                if self.backend.delete(id).is_err() {
                    return ReadBack::NotRestored {
                        had_previous: false,
                    };
                }
                if keychain_holds(&self.backend.get(id), None) {
                    ReadBack::RemovedNew
                } else {
                    ReadBack::Unconfirmed {
                        previous_unknown: false,
                    }
                }
            }
        }
    }

    /// Removes the key from the keychain and from the legacy file. A
    /// provider's account id (`<id>:account`) goes with its key: it is no
    /// use alone.
    pub fn delete(&self, provider_id: &str) -> Result<(), String> {
        let id = normalize_id(provider_id)?;
        self.backend.delete(&id)?;
        if !id.ends_with(ACCOUNT_SUFFIX) {
            self.backend.delete(&format!("{id}{ACCOUNT_SUFFIX}"))?;
        }
        self.bump_keys();
        self.drop_legacy_copy(&id)
    }

    /// One keychain account, with no legacy-file migration. OAuth records
    /// live beside the API key (`<provider>:oauth`) and must not move through
    /// the key file.
    pub(crate) fn read_account(&self, account: &str) -> Result<Option<String>, String> {
        let account = normalize_id(account)?;
        self.backend.get(&account)
    }

    /// Replaces one keychain account and bumps the scrub cache. The caller
    /// checks the read-back before it uses a rotated token.
    pub(crate) fn write_account(&self, account: &str, value: &str) -> Result<(), String> {
        let account = normalize_id(account)?;
        if value.is_empty() {
            return Err("The sign-in could not be saved.".into());
        }
        self.backend.set(&account, value)?;
        self.bump_keys();
        Ok(())
    }

    /// Removes one keychain account. Deleting an API key does not call this
    /// for `<provider>:oauth`, so sign-in and the pasted key stay independent.
    pub(crate) fn delete_account(&self, account: &str) -> Result<(), String> {
        let account = normalize_id(account)?;
        self.backend.delete(&account)?;
        self.bump_keys();
        Ok(())
    }

    /// Drops the file copy after the keychain write already stuck. A file
    /// that cannot be read is logged and left in place; the keychain copy
    /// is the one the user just saved or deleted.
    fn drop_legacy_copy(&self, id: &str) -> Result<(), String> {
        match self.legacy.remove(id) {
            Ok(()) => Ok(()),
            Err(LegacyError::Read(_) | LegacyError::Parse(_)) => {
                note_legacy(id);
                Ok(())
            }
            Err(error) => Err(error.to_string()),
        }
    }

    fn bump_keys(&self) {
        keys_changed();
        self.backend.note_change();
    }

    /// Reads one credential without the cache. A keychain that cannot be
    /// read is an error, unless the legacy file still holds the key.
    fn read_credential(&self, provider_id: &str) -> Result<Option<Credential>, String> {
        let id = normalize_id(provider_id)?;
        if let Err(error) = self.backend.get(&id) {
            match self.legacy.key(&id) {
                Ok(Some(_)) => {}
                Ok(None) => return Err(keychain_error(&id, &error)),
                Err(_legacy_error) => {
                    note_legacy(&id);
                    return Err(keychain_error(&id, &error));
                }
            }
        }
        let Some(api_key) = self.get(&id)? else {
            return Ok(None);
        };
        let account_id = self
            .backend
            .get(&format!("{id}{ACCOUNT_SUFFIX}"))
            .map_err(|error| keychain_error(&id, &error))?
            .filter(|value| !value.trim().is_empty());
        Ok(Some(Credential {
            api_key,
            account_id,
        }))
    }

    /// Every saved key value for `ids`, plus any key still in the legacy
    /// file, for scrubbing logs. Reads only: nothing moves.
    pub fn saved_key_values(&self, ids: impl IntoIterator<Item = String>) -> Vec<String> {
        let mut values: Vec<String> = Vec::new();
        let mut keep = |value: String| {
            let value = value.trim().to_string();
            if !value.is_empty() && !values.contains(&value) {
                values.push(value);
            }
        };
        for id in ids {
            if let Ok(id) = normalize_id(&id) {
                if let Ok(Some(value)) = self.backend.get(&id) {
                    keep(value);
                }
                if let Ok(Some(value)) = self.backend.get(&format!("{id}:oauth")) {
                    for secret in oauth_token_values(&value) {
                        keep(secret);
                    }
                }
            }
        }
        match self.legacy.ids() {
            Ok(ids) => {
                for id in ids {
                    match self.legacy.key(&id) {
                        Ok(Some(value)) => keep(value),
                        Ok(None) => {}
                        Err(_error) => note_legacy(&id),
                    }
                }
            }
            Err(_error) => note_legacy("legacy"),
        }
        values
    }

    /// Moves every legacy file key into the keychain.
    pub fn migrate_all(&self) -> Result<MigrationReport, String> {
        let mut report = MigrationReport::default();
        for id in self.legacy.ids()? {
            let stored = match self.backend.get(&id) {
                Ok(stored) => stored,
                Err(error) => {
                    report.kept.push((id, error));
                    continue;
                }
            };
            match self.migrate_one(&id, stored.as_deref())? {
                Step::Moved(_) => report.moved.push(id),
                Step::Kept(_, reason) => report.kept.push((id, reason)),
                Step::NoFileKey => {}
            }
        }
        Ok(report)
    }

    /// One key: write, read back, then remove the file copy (ADR-0183).
    /// `stored` is what the keychain holds for `id` now.
    fn migrate_one(&self, id: &str, stored: Option<&str>) -> Result<Step, String> {
        let file_key = match self.legacy.key(id) {
            Ok(Some(key)) => key,
            Ok(None) => return Ok(Step::NoFileKey),
            Err(_error) => {
                note_legacy(id);
                return Ok(Step::NoFileKey);
            }
        };
        match stored {
            // The crash case: the write landed, the file update did not.
            Some(stored) if stored == file_key => {
                self.legacy.remove(id).map_err(|error| error.to_string())?;
                return Ok(Step::Moved(file_key));
            }
            Some(stored) => {
                return Ok(Step::Kept(
                    stored.to_string(),
                    "The keychain holds a different key. The file copy stays.".into(),
                ));
            }
            None => {}
        }
        if let Err(error) = self.backend.set(id, &file_key) {
            return Ok(Step::Kept(file_key, error));
        }
        match self.backend.get(id) {
            Ok(Some(read_back)) if read_back == file_key => {
                self.legacy.remove(id).map_err(|error| error.to_string())?;
                Ok(Step::Moved(file_key))
            }
            Ok(_) => Ok(Step::Kept(
                file_key,
                "The keychain did not return the key just written.".into(),
            )),
            Err(error) => Ok(Step::Kept(file_key, error)),
        }
    }
}

/// The legacy `ai-provider-secrets.json` file: a compatibility path that
/// only ever loses keys (ADR-0183, ADR-0185).
struct LegacyFile {
    path: PathBuf,
}

impl LegacyFile {
    fn ids(&self) -> Result<Vec<String>, String> {
        Ok(read_legacy(&self.path)
            .map_err(|error| error.to_string())?
            .provider_api_keys
            .into_keys()
            .collect())
    }

    fn key(&self, id: &str) -> Result<Option<String>, String> {
        Ok(read_legacy(&self.path)
            .map_err(|error| error.to_string())?
            .provider_api_keys
            .get(id)
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty()))
    }

    /// Deletes the file when the last key leaves it.
    fn remove(&self, id: &str) -> Result<(), LegacyError> {
        let mut secrets = read_legacy(&self.path)?;
        if secrets.provider_api_keys.remove(id).is_none() {
            return Ok(());
        }
        keys_changed();
        if secrets.provider_api_keys.is_empty() {
            return std::fs::remove_file(&self.path).map_err(|error| {
                LegacyError::Update(format!("Failed to remove the legacy key file: {error}"))
            });
        }
        write_legacy(&self.path, &secrets).map_err(LegacyError::Update)
    }
}

#[derive(Debug)]
pub(crate) enum LegacyError {
    Read(std::io::Error),
    Parse(serde_json::Error),
    /// The file was readable, and replacing or deleting it failed.
    Update(String),
}

impl std::fmt::Display for LegacyError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Read(error) => write!(formatter, "Failed to read the legacy key file: {error}"),
            Self::Parse(error) => {
                write!(formatter, "Failed to parse the legacy key file: {error}")
            }
            Self::Update(error) => formatter.write_str(error),
        }
    }
}

enum Step {
    Moved(String),
    /// The key to use, and why the file copy stays.
    Kept(String, String),
    NoFileKey,
}

/// The keychain account suffix for a provider's account id (Cloudflare).
const ACCOUNT_SUFFIX: &str = ":account";

/// Access, refresh, and ID tokens inside an `<provider>:oauth` record.
/// A value that is not JSON is treated as one secret. Email and client id
/// are not tokens and stay out of the scrub list.
fn oauth_token_values(raw: &str) -> Vec<String> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else {
        let raw = raw.trim().to_string();
        return (!raw.is_empty()).then_some(raw).into_iter().collect();
    };
    ["access_token", "refresh_token", "id_token"]
        .into_iter()
        .filter_map(|key| value.get(key).and_then(|item| item.as_str()))
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect()
}

/// Names the provider and the keychain failure. Never holds a key value.
fn keychain_error(id: &str, error: &str) -> String {
    format!(
        "The keychain could not be read for {id}. It may be locked, or access was denied. {error}"
    )
}

/// True when `got` is the value we expected to read back.
fn keychain_holds(got: &Result<Option<String>, String>, expected: Option<&str>) -> bool {
    match (got, expected) {
        (Ok(Some(value)), Some(expected)) => value == expected,
        (Ok(None), None) => true,
        _ => false,
    }
}

enum Previous {
    Known(Option<String>),
    Unknown,
}

enum ReadBack {
    RestoredPrevious,
    RemovedNew,
    /// The restore write landed, or there was nothing safe to write back,
    /// and a following read did not confirm which value is stored.
    Unconfirmed {
        previous_unknown: bool,
    },
    /// The restore write itself failed.
    NotRestored {
        had_previous: bool,
    },
}

/// The read-back failed after the keychain write. The wording matches what
/// restore managed to do.
fn read_back_message(id: &str, outcome: ReadBack) -> String {
    let lead = format!("The keychain did not return the key just saved for {id}.");
    match outcome {
        ReadBack::RestoredPrevious => format!("{lead} The previous key was restored."),
        ReadBack::RemovedNew => format!("{lead} The new key was removed."),
        ReadBack::Unconfirmed { previous_unknown } => {
            let unread = if previous_unknown {
                " The previous key could not be read."
            } else {
                ""
            };
            format!("{lead}{unread} The keychain may hold the new key or the old one.")
        }
        ReadBack::NotRestored { had_previous: true } => {
            format!("{lead} The keychain value was replaced and could not be restored.")
        }
        ReadBack::NotRestored {
            had_previous: false,
        } => {
            format!("{lead} The new key was added and could not be removed.")
        }
    }
}

/// Logs a legacy-file problem once per provider. The line does not name the
/// provider or the key. `id` only decides whether this provider was already
/// logged.
fn note_legacy(id: &str) {
    use std::collections::HashSet;
    use std::sync::OnceLock;
    static SEEN: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    let seen = SEEN.get_or_init(|| Mutex::new(HashSet::new()));
    let mut seen = seen.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if seen.insert(id.to_string()) {
        log::warn!("The legacy provider key file could not be read.");
    }
}

impl KeyStore for ProviderKeys {
    fn credential(&self, provider_id: &str) -> Option<Credential> {
        self.try_credential(provider_id).ok().flatten()
    }

    /// Cached. Errors are not cached, so an unlocked keychain is read again.
    fn try_credential(&self, provider_id: &str) -> Result<Option<Credential>, String> {
        let id = normalize_id(provider_id)?;
        let generation = KEY_GENERATION.load(Ordering::SeqCst);
        let now = Instant::now();
        {
            let mut cache = self
                .credentials
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let fresh = cache.generation == generation
                && cache
                    .loaded_at
                    .is_some_and(|loaded| now.duration_since(loaded) < CACHE_TTL);
            if !fresh {
                *cache = CredentialCache {
                    generation,
                    loaded_at: Some(now),
                    entries: BTreeMap::new(),
                };
            }
            if let Some(entry) = cache.entries.get(&id) {
                return Ok(entry.clone());
            }
        }
        let credential = self.read_credential(&id)?;
        let mut cache = self
            .credentials
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if cache.generation == KEY_GENERATION.load(Ordering::SeqCst) {
            cache.entries.insert(id, credential.clone());
        }
        Ok(credential)
    }
}

fn normalize_id(provider_id: &str) -> Result<String, String> {
    let id = provider_id.trim().to_ascii_lowercase();
    if id.is_empty() {
        Err("Provider ID cannot be empty.".into())
    } else {
        Ok(id)
    }
}

pub(crate) fn read_legacy(path: &Path) -> Result<LegacySecrets, LegacyError> {
    if !path.exists() {
        return Ok(LegacySecrets::default());
    }
    let content = std::fs::read_to_string(path).map_err(LegacyError::Read)?;
    serde_json::from_str(&content).map_err(LegacyError::Parse)
}

pub(crate) fn write_legacy(path: &Path, secrets: &LegacySecrets) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create the key file folder: {error}"))?;
    }
    let json = serde_json::to_string_pretty(secrets)
        .map_err(|error| format!("Failed to serialize the legacy key file: {error}"))?;
    crate::secure_fs::write_owner_only_atomic(path, &json)
        .map_err(|error| format!("Failed to write the legacy key file: {error}"))
}

/// Saved key values for the session-log filter (ADR-0183). Cached until a
/// key is saved, deleted, or moved here, the id list changes, or
/// `CACHE_TTL` passes, so a key changed outside Rhizome is picked up too.
pub fn cached_saved_key_values(ids: Vec<String>) -> Vec<String> {
    static CACHE: Mutex<ValueCache> = Mutex::new(ValueCache { entry: None });
    let generation = KEY_GENERATION.load(Ordering::SeqCst);
    CACHE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get(generation, ids, Instant::now(), CACHE_TTL, |ids| {
            ProviderKeys::for_app()
                .map(|keys| keys.saved_key_values(ids.to_vec()))
                .unwrap_or_default()
        })
}

/// How long scrub values may be reused before the keychain is read again.
pub const CACHE_TTL: Duration = Duration::from_secs(60);

struct CachedValues {
    generation: u64,
    ids: Vec<String>,
    loaded_at: Instant,
    values: Vec<String>,
}

/// The cache rule, with time passed in so tests can move it.
struct ValueCache {
    entry: Option<CachedValues>,
}

impl ValueCache {
    fn get(
        &mut self,
        generation: u64,
        ids: Vec<String>,
        now: Instant,
        ttl: Duration,
        load: impl FnOnce(&[String]) -> Vec<String>,
    ) -> Vec<String> {
        if let Some(entry) = &self.entry {
            let fresh = now.saturating_duration_since(entry.loaded_at) < ttl;
            if fresh && entry.generation == generation && entry.ids == ids {
                return entry.values.clone();
            }
        }
        let values = load(&ids);
        self.entry = Some(CachedValues {
            generation,
            ids,
            loaded_at: now,
            values: values.clone(),
        });
        values
    }
}

/// Bumped whenever a key is saved, deleted, or moved, so cached values
/// are never stale.
static KEY_GENERATION: AtomicU64 = AtomicU64::new(0);

fn keys_changed() {
    KEY_GENERATION.fetch_add(1, Ordering::SeqCst);
}

/// The OS keychain: macOS Keychain, Windows Credential Manager, or the
/// Secret Service on Linux.
struct OsKeychain;

impl SecretBackend for OsKeychain {
    fn get(&self, account: &str) -> Result<Option<String>, String> {
        match keychain_entry(account)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(format!("Keychain read failed for {account}: {error}")),
        }
    }

    fn set(&self, account: &str, value: &str) -> Result<(), String> {
        keychain_entry(account)?
            .set_password(value)
            .map_err(|error| format!("Keychain write failed for {account}: {error}"))
    }

    fn delete(&self, account: &str) -> Result<(), String> {
        match keychain_entry(account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("Keychain delete failed for {account}: {error}")),
        }
    }
}

fn keychain_entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, account)
        .map_err(|error| format!("Keychain entry for {account} is not usable: {error}"))
}

#[cfg(not(test))]
fn app_backend() -> Box<dyn SecretBackend> {
    Box::new(OsKeychain)
}

#[cfg(not(test))]
fn app_legacy_file() -> Result<PathBuf, String> {
    crate::settings::preferred_app_config_path(LEGACY_FILE_NAME)
}

#[cfg(test)]
fn app_backend() -> Box<dyn SecretBackend> {
    Box::new(test_backend::MemoryOnly)
}

#[cfg(test)]
fn app_legacy_file() -> Result<PathBuf, String> {
    // A unique folder that is deleted when `dir` drops, so the path is
    // unpredictable and never exists. Nothing at a fixed temp path can feed
    // keys into a test.
    let dir = tempfile::tempdir().map_err(|error| format!("No temp folder for tests: {error}"))?;
    Ok(dir.path().join(LEGACY_FILE_NAME))
}

#[cfg(test)]
mod test_backend {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    /// The backend `ProviderKeys::for_app` gets in test builds: one
    /// in-memory keychain shared by the test process, so a test can save a
    /// key and then see it scrubbed from a session log.
    #[derive(Default)]
    pub(super) struct MemoryOnly;

    fn store() -> &'static Mutex<HashMap<String, String>> {
        static STORE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
        STORE.get_or_init(Mutex::default)
    }

    impl super::SecretBackend for MemoryOnly {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            Ok(store().lock().expect("memory keys").get(account).cloned())
        }

        fn set(&self, account: &str, value: &str) -> Result<(), String> {
            store()
                .lock()
                .expect("memory keys")
                .insert(account.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), String> {
            store().lock().expect("memory keys").remove(account);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MemoryBackend {
        values: Mutex<HashMap<String, String>>,
        fail_set: bool,
        corrupt_read_back: bool,
        fail_get: bool,
        /// 0-based `get` index that returns a value other than the one stored.
        mismatch_on_read: Option<usize>,
        /// 0-based `get` index that fails.
        fail_read_on: Option<usize>,
        /// 0-based `set` index that fails.
        fail_set_on: Option<usize>,
        fail_delete: bool,
        reads: std::sync::Arc<std::sync::atomic::AtomicUsize>,
        sets: std::sync::atomic::AtomicUsize,
        changes: std::sync::atomic::AtomicU64,
    }

    impl SecretBackend for MemoryBackend {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            let index = self.reads.fetch_add(1, Ordering::SeqCst);
            if self.fail_get || self.fail_read_on == Some(index) {
                return Err(format!("keychain locked for {account}"));
            }
            let value = self.values.lock().unwrap().get(account).cloned();
            if self.mismatch_on_read == Some(index) {
                return Ok(Some(match &value {
                    Some(value) => format!("{value}-mismatch"),
                    None => "mismatch".into(),
                }));
            }
            Ok(if self.corrupt_read_back {
                value.map(|value| format!("{value}-corrupt"))
            } else {
                value
            })
        }

        fn set(&self, account: &str, value: &str) -> Result<(), String> {
            let index = self.sets.fetch_add(1, Ordering::SeqCst);
            if self.fail_set || self.fail_set_on == Some(index) {
                return Err(format!("keychain refused {account}"));
            }
            self.values
                .lock()
                .unwrap()
                .insert(account.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), String> {
            if self.fail_delete {
                return Err(format!("keychain refused delete for {account}"));
            }
            self.values.lock().unwrap().remove(account);
            Ok(())
        }

        fn note_change(&self) {
            self.changes.fetch_add(1, Ordering::SeqCst);
        }

        fn change_count(&self) -> u64 {
            self.changes.load(Ordering::SeqCst)
        }
    }

    impl MemoryBackend {
        fn with(values: &[(&str, &str)]) -> Self {
            let backend = Self::default();
            for (account, value) in values {
                backend
                    .values
                    .lock()
                    .unwrap()
                    .insert(account.to_string(), value.to_string());
            }
            backend
        }
    }

    fn demo_secrets() -> LegacySecrets {
        LegacySecrets {
            provider_api_keys: BTreeMap::from([("demo".into(), "fixture-only".into())]),
        }
    }

    struct Fixture {
        _dir: tempfile::TempDir,
        file: PathBuf,
    }

    impl Fixture {
        fn with_file(keys: &[(&str, &str)]) -> Self {
            let dir = tempfile::tempdir().unwrap();
            let file = dir.path().join(LEGACY_FILE_NAME);
            if !keys.is_empty() {
                let secrets = LegacySecrets {
                    provider_api_keys: keys
                        .iter()
                        .map(|(id, key)| (id.to_string(), key.to_string()))
                        .collect(),
                };
                std::fs::write(&file, serde_json::to_string(&secrets).unwrap()).unwrap();
            }
            Self { _dir: dir, file }
        }

        fn keys(&self, backend: MemoryBackend) -> ProviderKeys {
            ProviderKeys::new(Box::new(backend), self.file.clone())
        }

        fn file_keys(&self) -> Option<BTreeMap<String, String>> {
            self.file.exists().then(|| {
                let raw = std::fs::read_to_string(&self.file).unwrap();
                serde_json::from_str::<LegacySecrets>(&raw)
                    .unwrap()
                    .provider_api_keys
            })
        }
    }

    /// Stops a legacy rewrite, then puts the permissions back on drop so the
    /// temp directory can be removed.
    struct LegacyUpdateLock {
        parent: PathBuf,
        #[cfg(unix)]
        mode: u32,
        #[cfg(not(unix))]
        permissions: std::fs::Permissions,
    }

    fn lock_legacy_updates(parent: &Path) -> LegacyUpdateLock {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(parent).unwrap().permissions().mode();
            let mut perms = std::fs::metadata(parent).unwrap().permissions();
            perms.set_mode(0o555);
            std::fs::set_permissions(parent, perms).unwrap();
            LegacyUpdateLock {
                parent: parent.to_path_buf(),
                mode,
            }
        }
        #[cfg(not(unix))]
        {
            let file = parent.join(LEGACY_FILE_NAME);
            let mut perms = std::fs::metadata(&file).unwrap().permissions();
            let permissions = perms.clone();
            perms.set_readonly(true);
            std::fs::set_permissions(&file, perms).unwrap();
            LegacyUpdateLock {
                parent: parent.to_path_buf(),
                permissions,
            }
        }
    }

    impl Drop for LegacyUpdateLock {
        fn drop(&mut self) {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = std::fs::metadata(&self.parent).unwrap().permissions();
                perms.set_mode(self.mode);
                let _ = std::fs::set_permissions(&self.parent, perms);
            }
            #[cfg(not(unix))]
            {
                let file = self.parent.join(LEGACY_FILE_NAME);
                let _ = std::fs::set_permissions(&file, self.permissions.clone());
            }
        }
    }

    #[test]
    fn a_saved_key_reads_back_from_the_keychain() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::default());

        keys.save("groq", "  gsk-test  ").unwrap();

        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-test"));
        assert_eq!(
            fixture.file_keys(),
            None,
            "save must not create the legacy file"
        );
    }

    #[test]
    fn a_file_key_moves_into_the_keychain_on_first_read() {
        let fixture = Fixture::with_file(&[("open_ai_compatible-a", "sk-a")]);
        let backend = MemoryBackend::default();
        let keys = fixture.keys(backend);

        assert_eq!(
            keys.get("open_ai_compatible-a").unwrap().as_deref(),
            Some("sk-a")
        );

        assert_eq!(
            keys.backend.get("open_ai_compatible-a").unwrap().as_deref(),
            Some("sk-a")
        );
        assert_eq!(
            fixture.file_keys(),
            None,
            "an emptied legacy file is deleted"
        );
    }

    #[test]
    fn moving_one_key_keeps_the_others_in_the_file() {
        let fixture = Fixture::with_file(&[("a", "sk-a"), ("b", "sk-b")]);
        let keys = fixture.keys(MemoryBackend::default());

        keys.get("a").unwrap();

        let left = fixture.file_keys().unwrap();
        assert_eq!(left.keys().collect::<Vec<_>>(), vec!["b"]);
    }

    #[test]
    fn a_failed_keychain_write_keeps_the_file_copy_working() {
        let fixture = Fixture::with_file(&[("a", "sk-a")]);
        let keys = fixture.keys(MemoryBackend {
            fail_set: true,
            ..Default::default()
        });

        assert_eq!(keys.get("a").unwrap().as_deref(), Some("sk-a"));
        assert_eq!(
            fixture.file_keys().unwrap().get("a").map(String::as_str),
            Some("sk-a")
        );
    }

    #[test]
    fn a_wrong_read_back_keeps_the_file_copy() {
        let fixture = Fixture::with_file(&[("a", "sk-a")]);
        let keys = fixture.keys(MemoryBackend {
            corrupt_read_back: true,
            ..Default::default()
        });

        let report = keys.migrate_all().unwrap();

        assert!(report.moved.is_empty());
        assert_eq!(report.kept.len(), 1);
        assert_eq!(report.kept[0].0, "a");
        assert_eq!(
            fixture.file_keys().unwrap().get("a").map(String::as_str),
            Some("sk-a")
        );
    }

    /// The crash case: the keychain write landed, the file update did not.
    #[test]
    fn a_crash_after_the_write_finishes_on_the_next_read() {
        let fixture = Fixture::with_file(&[("a", "sk-a")]);
        let keys = fixture.keys(MemoryBackend::with(&[("a", "sk-a")]));

        assert_eq!(keys.get("a").unwrap().as_deref(), Some("sk-a"));
        assert_eq!(fixture.file_keys(), None);
    }

    /// Something outside Rhizome changed the keychain entry. The keychain
    /// value is newer, but the file copy is not removed on a guess.
    #[test]
    fn a_different_keychain_value_wins_and_the_file_copy_stays() {
        let fixture = Fixture::with_file(&[("a", "sk-old")]);
        let keys = fixture.keys(MemoryBackend::with(&[("a", "sk-new")]));

        assert_eq!(keys.get("a").unwrap().as_deref(), Some("sk-new"));
        let report = keys.migrate_all().unwrap();
        assert_eq!(report.kept[0].0, "a");
        assert_eq!(
            fixture.file_keys().unwrap().get("a").map(String::as_str),
            Some("sk-old")
        );
    }

    #[test]
    fn migrate_all_moves_every_key_and_deletes_the_file() {
        let fixture = Fixture::with_file(&[("a", "sk-a"), ("b", "sk-b"), ("c", "sk-c")]);
        let keys = fixture.keys(MemoryBackend::default());

        let report = keys.migrate_all().unwrap();

        assert_eq!(report.moved, vec!["a", "b", "c"]);
        assert!(report.kept.is_empty());
        assert_eq!(fixture.file_keys(), None);
        assert_eq!(keys.get("b").unwrap().as_deref(), Some("sk-b"));
    }

    #[test]
    fn saving_a_new_key_drops_a_stale_file_copy() {
        let fixture = Fixture::with_file(&[("a", "sk-old"), ("b", "sk-b")]);
        let keys = fixture.keys(MemoryBackend::default());

        keys.save("a", "sk-new").unwrap();

        assert_eq!(keys.get("a").unwrap().as_deref(), Some("sk-new"));
        assert!(!fixture.file_keys().unwrap().contains_key("a"));
    }

    #[test]
    fn a_save_that_does_not_read_back_is_an_error() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            corrupt_read_back: true,
            ..Default::default()
        });

        let error = keys.save("groq", "gsk-secret-value").unwrap_err();

        assert!(error.contains("groq"), "{error}");
        assert!(
            error.contains("new key was removed"),
            "the message must match the keychain write: {error}"
        );
        assert!(!error.contains("Nothing else changed"), "{error}");
        assert!(
            !error.contains("gsk-secret-value"),
            "a key value leaked: {error}"
        );
        assert_eq!(keys.get("groq").unwrap(), None);
    }

    #[test]
    fn a_read_back_mismatch_restores_the_previous_key() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            mismatch_on_read: Some(1),
            ..MemoryBackend::with(&[("groq", "gsk-old")])
        });

        let error = keys.save("groq", "gsk-new").unwrap_err();

        assert!(error.contains("previous key was restored"), "{error}");
        assert!(!error.contains("Nothing else changed"), "{error}");
        assert!(!error.contains("gsk-new"), "a key value leaked: {error}");
        assert!(!error.contains("gsk-old"), "a key value leaked: {error}");
        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-old"));
    }

    #[test]
    fn a_broken_previous_entry_can_still_be_overwritten() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            fail_read_on: Some(0),
            ..MemoryBackend::with(&[("groq", "gsk-old")])
        });

        keys.save("groq", "gsk-new").unwrap();

        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-new"));
    }

    #[test]
    fn an_unread_previous_key_is_named_when_the_new_key_does_not_read_back() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            fail_read_on: Some(0),
            mismatch_on_read: Some(1),
            ..MemoryBackend::with(&[("groq", "gsk-old")])
        });

        let error = keys.save("groq", "gsk-new").unwrap_err();

        assert!(error.contains("previous key could not be read"), "{error}");
        assert!(
            error.contains("may hold the new key or the old one"),
            "{error}"
        );
        assert!(!error.contains("could not be restored"), "{error}");
        assert!(!error.contains("gsk-new"), "a key value leaked: {error}");
        assert_eq!(
            keys.backend.change_count(),
            2,
            "the unverified value must not stay cached"
        );
    }

    #[test]
    fn a_failed_restore_write_says_the_key_could_not_be_restored() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            mismatch_on_read: Some(1),
            fail_set_on: Some(1),
            ..MemoryBackend::with(&[("groq", "gsk-old")])
        });

        let error = keys.save("groq", "gsk-new").unwrap_err();

        assert!(error.contains("could not be restored"), "{error}");
        assert!(error.contains("replaced"), "{error}");
        assert!(!error.contains("may hold"), "{error}");
        assert_eq!(keys.backend.change_count(), 2);
    }

    #[test]
    fn a_new_key_that_cannot_be_removed_is_not_called_replaced() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            mismatch_on_read: Some(1),
            fail_delete: true,
            ..Default::default()
        });

        let error = keys.save("groq", "gsk-new").unwrap_err();

        assert!(error.contains("added"), "{error}");
        assert!(error.contains("could not be removed"), "{error}");
        assert!(!error.contains("replaced"), "{error}");
        assert_eq!(keys.backend.change_count(), 2);
    }

    #[test]
    fn a_restore_that_does_not_read_back_does_not_claim_failure() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            mismatch_on_read: Some(1),
            fail_read_on: Some(2),
            ..MemoryBackend::with(&[("groq", "gsk-old")])
        });

        let error = keys.save("groq", "gsk-new").unwrap_err();

        assert!(
            error.contains("may hold the new key or the old one"),
            "{error}"
        );
        assert!(!error.contains("could not be restored"), "{error}");
        assert!(!error.contains("previous key could not be read"), "{error}");
        assert_eq!(keys.backend.change_count(), 2);
    }

    #[test]
    fn a_corrupt_legacy_file_does_not_fail_a_key_that_was_saved() {
        let fixture = Fixture::with_file(&[]);
        std::fs::write(&fixture.file, "not json").unwrap();
        let keys = fixture.keys(MemoryBackend::default());

        keys.save("groq", "gsk-new").unwrap();

        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-new"));
        assert!(
            fixture.file.exists(),
            "a file that cannot be parsed stays on disk"
        );
    }

    #[test]
    fn an_empty_legacy_file_does_not_fail_a_key_that_was_deleted() {
        let fixture = Fixture::with_file(&[]);
        std::fs::write(&fixture.file, "").unwrap();
        let keys = fixture.keys(MemoryBackend::with(&[("groq", "gsk-old")]));

        keys.delete("groq").unwrap();

        assert_eq!(keys.get("groq").unwrap(), None);
    }

    #[test]
    fn a_failed_legacy_write_is_still_reported() {
        let fixture = Fixture::with_file(&[("groq", "gsk-old"), ("other", "sk-other")]);
        let parent = fixture.file.parent().unwrap().to_path_buf();
        let _restore = lock_legacy_updates(&parent);
        let keys = fixture.keys(MemoryBackend::default());
        let error = keys.save("groq", "gsk-new").unwrap_err();
        drop(_restore);
        assert!(
            error.contains("Failed to write the legacy key file"),
            "{error}"
        );
        assert!(!error.contains("Failed to parse"), "{error}");
        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-new"));
        assert_eq!(
            fixture.file_keys().unwrap().get("groq").map(String::as_str),
            Some("gsk-old"),
            "a failed rewrite must leave the file copy in place"
        );
    }

    #[test]
    fn a_corrupt_legacy_file_does_not_hide_a_keychain_key() {
        let fixture = Fixture::with_file(&[]);
        std::fs::write(&fixture.file, "not json").unwrap();
        let keys = fixture.keys(MemoryBackend::with(&[("groq", "gsk-kept")]));

        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-kept"));
        assert_eq!(
            keys.try_credential("groq").unwrap().unwrap().api_key,
            "gsk-kept"
        );
        assert!(
            fixture.file.exists(),
            "a file that cannot be parsed must stay until it can be read"
        );
    }

    #[test]
    fn an_empty_legacy_file_does_not_hide_a_keychain_key() {
        let fixture = Fixture::with_file(&[]);
        std::fs::write(&fixture.file, "").unwrap();
        let keys = fixture.keys(MemoryBackend::with(&[("groq", "gsk-kept")]));

        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-kept"));
    }

    #[test]
    fn an_unreadable_legacy_file_does_not_hide_a_keychain_key() {
        let fixture = Fixture::with_file(&[]);
        std::fs::create_dir(&fixture.file).unwrap();
        let keys = fixture.keys(MemoryBackend::with(&[("groq", "gsk-kept")]));

        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-kept"));
        assert_eq!(
            keys.try_credential("groq").unwrap().unwrap().api_key,
            "gsk-kept"
        );
    }

    #[test]
    fn a_locked_keychain_and_a_corrupt_legacy_file_names_the_keychain() {
        let fixture = Fixture::with_file(&[]);
        std::fs::write(&fixture.file, "{").unwrap();
        let keys = fixture.keys(MemoryBackend {
            fail_get: true,
            ..Default::default()
        });

        let error = keys.try_credential("groq").unwrap_err();

        assert!(error.contains("keychain could not be read"), "{error}");
        assert!(
            error.contains("locked") || error.contains("denied"),
            "{error}"
        );
        assert!(!error.contains("parse"), "{error}");
    }

    #[test]
    fn migration_writes_then_reads_back_then_removes_the_file_copy() {
        let fixture = Fixture::with_file(&[("a", "sk-a")]);
        let ops = std::sync::Arc::new(Mutex::new(Vec::new()));
        let recorded = std::sync::Arc::clone(&ops);

        struct Order {
            ops: std::sync::Arc<Mutex<Vec<String>>>,
            values: Mutex<HashMap<String, String>>,
        }

        impl SecretBackend for Order {
            fn get(&self, account: &str) -> Result<Option<String>, String> {
                self.ops.lock().unwrap().push(format!("get:{account}"));
                Ok(self.values.lock().unwrap().get(account).cloned())
            }

            fn set(&self, account: &str, value: &str) -> Result<(), String> {
                self.ops.lock().unwrap().push(format!("set:{account}"));
                self.values
                    .lock()
                    .unwrap()
                    .insert(account.to_string(), value.to_string());
                Ok(())
            }

            fn delete(&self, account: &str) -> Result<(), String> {
                self.ops.lock().unwrap().push(format!("delete:{account}"));
                self.values.lock().unwrap().remove(account);
                Ok(())
            }
        }

        let keys = ProviderKeys::new(
            Box::new(Order {
                ops,
                values: Mutex::new(HashMap::new()),
            }),
            fixture.file.clone(),
        );

        assert_eq!(keys.get("a").unwrap().as_deref(), Some("sk-a"));
        assert_eq!(
            recorded.lock().unwrap().as_slice(),
            ["get:a", "set:a", "get:a"]
        );
        assert_eq!(fixture.file_keys(), None);
    }

    #[test]
    fn delete_removes_both_copies() {
        let fixture = Fixture::with_file(&[("a", "sk-file"), ("b", "sk-b")]);
        let keys = fixture.keys(MemoryBackend::with(&[("a", "sk-file")]));

        keys.delete("a").unwrap();

        assert_eq!(keys.get("a").unwrap(), None);
        assert!(!fixture.file_keys().unwrap().contains_key("a"));
    }

    #[test]
    fn no_file_and_no_entry_is_none_not_an_error() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::default());

        assert_eq!(keys.get("groq").unwrap(), None);
        assert_eq!(keys.migrate_all().unwrap(), MigrationReport::default());
    }

    #[test]
    fn a_locked_keychain_still_reads_the_file_copy() {
        let fixture = Fixture::with_file(&[("a", "sk-a")]);
        let keys = fixture.keys(MemoryBackend {
            fail_get: true,
            ..Default::default()
        });

        assert_eq!(keys.get("a").unwrap().as_deref(), Some("sk-a"));
        assert!(fixture.file_keys().unwrap().contains_key("a"));
    }

    #[test]
    fn provider_ids_are_trimmed_and_lowercased() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::default());

        keys.save(" Groq ", "gsk").unwrap();

        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk"));
        assert!(keys.save("  ", "gsk").is_err());
        assert!(keys.save("groq", "   ").is_err());
    }

    fn counting_loader(calls: &std::cell::Cell<u32>) -> impl FnOnce(&[String]) -> Vec<String> + '_ {
        move |ids: &[String]| {
            calls.set(calls.get() + 1);
            ids.to_vec()
        }
    }

    #[test]
    fn the_value_cache_reuses_values_within_the_ttl_and_reloads_after() {
        let mut cache = ValueCache { entry: None };
        let calls = std::cell::Cell::new(0);
        let start = Instant::now();
        let ttl = Duration::from_secs(60);
        let ids = || vec!["groq".to_string()];

        cache.get(1, ids(), start, ttl, counting_loader(&calls));
        cache.get(
            1,
            ids(),
            start + Duration::from_secs(59),
            ttl,
            counting_loader(&calls),
        );
        assert_eq!(
            calls.get(),
            1,
            "inside the ttl the keychain is not read again"
        );

        cache.get(
            1,
            ids(),
            start + Duration::from_secs(61),
            ttl,
            counting_loader(&calls),
        );
        assert_eq!(
            calls.get(),
            2,
            "after the ttl an outside key change is picked up"
        );
    }

    #[test]
    fn the_value_cache_reloads_on_a_key_change_or_new_ids() {
        let mut cache = ValueCache { entry: None };
        let calls = std::cell::Cell::new(0);
        let now = Instant::now();
        let ttl = Duration::from_secs(60);

        cache.get(1, vec!["a".into()], now, ttl, counting_loader(&calls));
        cache.get(2, vec!["a".into()], now, ttl, counting_loader(&calls));
        cache.get(2, vec!["b".into()], now, ttl, counting_loader(&calls));

        assert_eq!(calls.get(), 3);
    }

    #[test]
    fn the_cache_refreshes_when_the_id_list_changes() {
        ProviderKeys::for_app()
            .unwrap()
            .save("cache-late-provider", "cache-late-key-value")
            .unwrap();
        let without = cached_saved_key_values(vec!["something-else".into()]);

        let with = cached_saved_key_values(vec!["cache-late-provider".into()]);

        assert!(!without.contains(&"cache-late-key-value".to_string()));
        assert!(with.contains(&"cache-late-key-value".to_string()));
    }

    #[test]
    fn saved_key_values_cover_the_keychain_and_the_legacy_file_without_moving_keys() {
        let fixture = Fixture::with_file(&[("old", "sk-file-only")]);
        let keys = fixture.keys(MemoryBackend::with(&[
            ("groq", "gsk-chain"),
            ("other", "not-asked"),
        ]));

        let mut values = keys.saved_key_values(["groq".to_string(), "mistral".to_string()]);
        values.sort();

        assert_eq!(values, ["gsk-chain", "sk-file-only"]);
        assert!(
            fixture.file_keys().unwrap().contains_key("old"),
            "scrubbing must not migrate"
        );
    }

    #[test]
    fn saved_key_values_include_oauth_tokens_and_not_the_email() {
        let record = r#"{"email":"ada@example.com","access_token":"oat-secret-access","refresh_token":"oat-secret-refresh","id_token":"oat-secret-id","client_id":"oaiapp_test"}"#;
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::with(&[("openai:oauth", record)]));

        let values = keys.saved_key_values(["openai".to_string()]);

        assert!(values.iter().any(|value| value == "oat-secret-access"));
        assert!(values.iter().any(|value| value == "oat-secret-refresh"));
        assert!(values.iter().any(|value| value == "oat-secret-id"));
        assert!(!values.iter().any(|value| value.contains("ada@example.com")));
        assert!(!values.iter().any(|value| value.contains("oaiapp_test")));
    }

    #[test]
    fn deleting_an_api_key_leaves_the_oauth_record() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::with(&[
            ("openai", "sk-pasted"),
            ("openai:oauth", "{\"access_token\":\"oat-secret-access\"}"),
        ]));

        keys.delete("openai").unwrap();

        assert_eq!(keys.get("openai").unwrap(), None);
        assert!(keys
            .read_account("openai:oauth")
            .unwrap()
            .unwrap()
            .contains("oat-secret-access"));
    }

    #[test]
    fn the_cache_refreshes_when_a_key_is_saved() {
        let ids = || vec!["cache-test-provider".to_string()];
        let before = cached_saved_key_values(ids());

        ProviderKeys::for_app()
            .unwrap()
            .save("cache-test-provider", "cache-test-key-value")
            .unwrap();

        assert!(!before.contains(&"cache-test-key-value".to_string()));
        assert!(cached_saved_key_values(ids()).contains(&"cache-test-key-value".to_string()));
    }

    #[test]
    fn the_key_store_gives_the_router_a_credential_with_an_account_id() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::with(&[
            ("cloudflare", "cf-key"),
            ("cloudflare:account", "acct-1"),
            ("groq", "gsk"),
        ]));

        assert_eq!(
            keys.credential("cloudflare"),
            Some(Credential {
                api_key: "cf-key".into(),
                account_id: Some("acct-1".into()),
            })
        );
        assert_eq!(keys.credential("groq").unwrap().account_id, None);
        assert_eq!(keys.credential("mistral"), None);
    }

    #[test]
    fn a_locked_keychain_is_an_error_not_no_key() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend {
            fail_get: true,
            ..Default::default()
        });

        let error = keys.try_credential("groq").unwrap_err();

        assert!(
            error.contains("keychain could not be read for groq"),
            "{error}"
        );
        assert_eq!(keys.credential("groq"), None);
    }

    #[test]
    fn deleting_a_key_also_deletes_its_account_id() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::with(&[
            ("cloudflare-ai", "cf-key"),
            ("cloudflare-ai:account", "acct"),
        ]));

        keys.delete("cloudflare-ai").unwrap();

        assert_eq!(keys.backend.get("cloudflare-ai:account").unwrap(), None);
        assert_eq!(keys.try_credential("cloudflare-ai").unwrap(), None);
    }

    #[test]
    fn an_account_id_can_be_deleted_alone() {
        let fixture = Fixture::with_file(&[]);
        let keys = fixture.keys(MemoryBackend::with(&[
            ("cloudflare-ai", "cf-key"),
            ("cloudflare-ai:account", "acct"),
        ]));

        keys.delete("cloudflare-ai:account").unwrap();

        let credential = keys.try_credential("cloudflare-ai").unwrap().unwrap();
        assert_eq!(credential.api_key, "cf-key");
        assert_eq!(credential.account_id, None);
    }

    #[test]
    fn credentials_are_read_once_until_a_key_changes() {
        let fixture = Fixture::with_file(&[]);
        let backend = MemoryBackend::with(&[("groq", "gsk")]);
        let reads = std::sync::Arc::clone(&backend.reads);
        let keys = fixture.keys(backend);

        keys.credential("groq");
        let after_first = reads.load(Ordering::SeqCst);
        keys.credential("groq");
        keys.credential("groq");
        assert_eq!(reads.load(Ordering::SeqCst), after_first);

        keys.save("groq", "gsk-new").unwrap();
        assert_eq!(keys.credential("groq").unwrap().api_key, "gsk-new");
    }

    #[test]
    fn the_legacy_file_round_trips_and_is_owner_only() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join(LEGACY_FILE_NAME);
        let secrets = demo_secrets();

        write_legacy(&path, &secrets).unwrap();

        assert_eq!(read_legacy(&path).unwrap(), secrets);
        assert_eq!(
            read_legacy(&dir.path().join("missing.json")).unwrap(),
            LegacySecrets::default()
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    /// Talks to the real OS keychain with a throwaway account, then
    /// deletes it. Ignored: CI has no login keychain, and a local run may
    /// show an OS prompt. Run by hand when changing `OsKeychain`.
    #[test]
    #[ignore]
    fn os_keychain_round_trips_a_throwaway_account() {
        let account = format!("rhizome-live-test-{}", uuid::Uuid::new_v4());
        let keychain = OsKeychain;

        keychain.set(&account, "throwaway-value").unwrap();
        let read = keychain.get(&account);
        keychain.delete(&account).unwrap();

        assert_eq!(read.unwrap().as_deref(), Some("throwaway-value"));
        assert_eq!(keychain.get(&account).unwrap(), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_legacy_write_does_not_follow_a_symlink() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let outside = dir.path().join("outside-secrets.json");
        let path = dir.path().join(LEGACY_FILE_NAME);
        std::fs::write(&outside, "{\"marker\":\"RHIZOME_R3_OUTSIDE\"}\n").unwrap();
        symlink(&outside, &path).unwrap();
        let secrets = demo_secrets();

        write_legacy(&path, &secrets).unwrap();

        assert_eq!(
            std::fs::read_to_string(&outside).unwrap(),
            "{\"marker\":\"RHIZOME_R3_OUTSIDE\"}\n"
        );
        assert!(!path.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(read_legacy(&path).unwrap(), secrets);
    }

    #[cfg(unix)]
    #[test]
    fn a_legacy_write_tightens_a_permissive_file() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(LEGACY_FILE_NAME);
        std::fs::write(&path, "{}").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        let secrets = demo_secrets();

        write_legacy(&path, &secrets).unwrap();

        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        assert_eq!(read_legacy(&path).unwrap(), secrets);
    }

    #[test]
    fn tests_can_never_reach_the_real_keychain_or_key_file() {
        let keys = ProviderKeys::for_app().unwrap();

        assert!(
            !keys
                .legacy
                .path
                .ends_with(Path::new("com.rhizome.app").join(LEGACY_FILE_NAME)),
            "test builds must not point at the real key file: {}",
            keys.legacy.path.display()
        );
        keys.save("groq", "gsk-test").unwrap();
        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-test"));
    }
}
