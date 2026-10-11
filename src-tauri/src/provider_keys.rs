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
//!
//! Nothing here writes to a log. Key values never appear in an error
//! message. Errors and `MigrationReport` name the provider id only.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

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
}

impl ProviderKeys {
    pub fn new(backend: Box<dyn SecretBackend>, legacy_file: PathBuf) -> Self {
        Self {
            backend,
            legacy: LegacyFile { path: legacy_file },
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
            // sits in the legacy file. Nothing is logged: this module never
            // writes provider data to a log.
            Err(_) => return self.legacy.key(&id),
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
        self.backend.set(&id, key)?;
        keys_changed();
        if self.backend.get(&id)?.as_deref() != Some(key) {
            return Err(format!(
                "The keychain did not return the key just saved for {id}. Nothing else changed."
            ));
        }
        self.legacy.remove(&id)
    }

    /// Removes the key from the keychain and from the legacy file.
    pub fn delete(&self, provider_id: &str) -> Result<(), String> {
        let id = normalize_id(provider_id)?;
        self.backend.delete(&id)?;
        keys_changed();
        self.legacy.remove(&id)
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
            }
        }
        for id in self.legacy.ids().unwrap_or_default() {
            if let Ok(Some(value)) = self.legacy.key(&id) {
                keep(value);
            }
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
        let Some(file_key) = self.legacy.key(id)? else {
            return Ok(Step::NoFileKey);
        };
        match stored {
            // The crash case: the write landed, the file update did not.
            Some(stored) if stored == file_key => {
                self.legacy.remove(id)?;
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
                self.legacy.remove(id)?;
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
/// only ever loses keys (ADR-0183, ADR-0184).
struct LegacyFile {
    path: PathBuf,
}

impl LegacyFile {
    fn ids(&self) -> Result<Vec<String>, String> {
        Ok(read_legacy(&self.path)?
            .provider_api_keys
            .into_keys()
            .collect())
    }

    fn key(&self, id: &str) -> Result<Option<String>, String> {
        Ok(read_legacy(&self.path)?
            .provider_api_keys
            .get(id)
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty()))
    }

    /// Deletes the file when the last key leaves it.
    fn remove(&self, id: &str) -> Result<(), String> {
        let mut secrets = read_legacy(&self.path)?;
        if secrets.provider_api_keys.remove(id).is_none() {
            return Ok(());
        }
        keys_changed();
        if secrets.provider_api_keys.is_empty() {
            return std::fs::remove_file(&self.path)
                .map_err(|error| format!("Failed to remove the legacy key file: {error}"));
        }
        write_legacy(&self.path, &secrets)
    }
}

enum Step {
    Moved(String),
    /// The key to use, and why the file copy stays.
    Kept(String, String),
    NoFileKey,
}

impl KeyStore for ProviderKeys {
    fn credential(&self, provider_id: &str) -> Option<Credential> {
        let api_key = self.get(provider_id).ok().flatten()?;
        let account = format!("{}:account", normalize_id(provider_id).ok()?);
        let account_id = self
            .backend
            .get(&account)
            .ok()
            .flatten()
            .filter(|value| !value.trim().is_empty());
        Some(Credential {
            api_key,
            account_id,
        })
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

pub(crate) fn read_legacy(path: &Path) -> Result<LegacySecrets, String> {
    if !path.exists() {
        return Ok(LegacySecrets::default());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|error| format!("Failed to read the legacy key file: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse the legacy key file: {error}"))
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
/// key is saved, deleted, or moved, or the id list changes (a provider
/// saved in Settings after its key).
pub fn cached_saved_key_values(ids: Vec<String>) -> Vec<String> {
    type Cached = (u64, Vec<String>, Vec<String>);
    static CACHE: Mutex<Option<Cached>> = Mutex::new(None);
    let generation = KEY_GENERATION.load(Ordering::SeqCst);
    let mut cache = CACHE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some((cached_generation, cached_ids, values)) = cache.as_ref() {
        if *cached_generation == generation && *cached_ids == ids {
            return values.clone();
        }
    }
    let values = ProviderKeys::for_app()
        .map(|keys| keys.saved_key_values(ids.clone()))
        .unwrap_or_default();
    *cache = Some((generation, ids, values.clone()));
    values
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
    Box::new(test_backend::MemoryOnly::default())
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
    }

    impl SecretBackend for MemoryBackend {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            if self.fail_get {
                return Err(format!("keychain locked for {account}"));
            }
            let value = self.values.lock().unwrap().get(account).cloned();
            Ok(if self.corrupt_read_back {
                value.map(|value| format!("{value}-corrupt"))
            } else {
                value
            })
        }

        fn set(&self, account: &str, value: &str) -> Result<(), String> {
            if self.fail_set {
                return Err(format!("keychain refused {account}"));
            }
            self.values
                .lock()
                .unwrap()
                .insert(account.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), String> {
            self.values.lock().unwrap().remove(account);
            Ok(())
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
            !error.contains("gsk-secret-value"),
            "a key value leaked: {error}"
        );
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
