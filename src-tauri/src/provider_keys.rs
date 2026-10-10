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
//! Key values are never logged or put in an error message. Messages name the
//! provider id only.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

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
    legacy_file: PathBuf,
}

impl ProviderKeys {
    pub fn new(backend: Box<dyn SecretBackend>, legacy_file: PathBuf) -> Self {
        Self {
            backend,
            legacy_file,
        }
    }

    /// The app's store: the OS keychain and the real legacy file.
    pub fn for_app() -> Result<Self, String> {
        Err("not built".into())
    }

    /// The key for `provider_id`, from the keychain, or from the legacy file
    /// (moving it into the keychain on the way). `None` when neither has one.
    pub fn get(&self, _provider_id: &str) -> Result<Option<String>, String> {
        Err("not built".into())
    }

    /// Saves a key, checks it reads back, then drops any legacy file copy so
    /// an old key cannot shadow the new one.
    pub fn save(&self, _provider_id: &str, _api_key: &str) -> Result<(), String> {
        Err("not built".into())
    }

    /// Removes the key from the keychain and from the legacy file.
    pub fn delete(&self, _provider_id: &str) -> Result<(), String> {
        Err("not built".into())
    }

    /// Moves every legacy file key into the keychain.
    pub fn migrate_all(&self) -> Result<MigrationReport, String> {
        Err("not built".into())
    }
}

impl KeyStore for ProviderKeys {
    fn credential(&self, _provider_id: &str) -> Option<Credential> {
        None
    }
}

pub(crate) fn read_legacy(path: &Path) -> Result<LegacySecrets, String> {
    let _ = path;
    Err("not built".into())
}

pub(crate) fn write_legacy(path: &Path, secrets: &LegacySecrets) -> Result<(), String> {
    let _ = (path, secrets);
    Err("not built".into())
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
        assert_eq!(fixture.file_keys(), None, "save must not create the legacy file");
    }

    #[test]
    fn a_file_key_moves_into_the_keychain_on_first_read() {
        let fixture = Fixture::with_file(&[("open_ai_compatible-a", "sk-a")]);
        let backend = MemoryBackend::default();
        let keys = fixture.keys(backend);

        assert_eq!(keys.get("open_ai_compatible-a").unwrap().as_deref(), Some("sk-a"));

        assert_eq!(keys.backend.get("open_ai_compatible-a").unwrap().as_deref(), Some("sk-a"));
        assert_eq!(fixture.file_keys(), None, "an emptied legacy file is deleted");
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
        assert_eq!(fixture.file_keys().unwrap().get("a").map(String::as_str), Some("sk-a"));
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
        assert_eq!(fixture.file_keys().unwrap().get("a").map(String::as_str), Some("sk-a"));
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
        assert_eq!(fixture.file_keys().unwrap().get("a").map(String::as_str), Some("sk-old"));
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
        assert!(!error.contains("gsk-secret-value"), "a key value leaked: {error}");
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
        let secrets = LegacySecrets {
            provider_api_keys: BTreeMap::from([("a".into(), "fixture-only".into())]),
        };

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

    #[test]
    fn tests_can_never_reach_the_real_keychain_or_key_file() {
        let keys = ProviderKeys::for_app().unwrap();

        assert!(
            !keys.legacy_file.ends_with(Path::new("com.rhizome.app").join(LEGACY_FILE_NAME)),
            "test builds must not point at the real key file: {}",
            keys.legacy_file.display()
        );
        keys.save("groq", "gsk-test").unwrap();
        assert_eq!(keys.get("groq").unwrap().as_deref(), Some("gsk-test"));
    }
}
