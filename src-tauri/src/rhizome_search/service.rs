//! Tauri-managed lifecycle for the resident search index: lazily builds and
//! keeps warm one index+embedder pair per vault, reused across Ask-tab
//! searches so the ONNX model loads once per vault per app session rather
//! than once per query (see One Brain step 3b).

use super::embedder::{FastEmbedTextEmbedder, TextEmbedder};
use super::{index_dir_for_vault, RhizomeSearchIndex, SearchHit};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

struct VaultHandle {
    index: RhizomeSearchIndex,
    embedder: Box<dyn TextEmbedder + Send>,
}

#[derive(Default)]
pub struct RhizomeSearchService {
    handles: Mutex<HashMap<PathBuf, VaultHandle>>,
    /// Vaults written to outside the search path (Distill/Import/Generate)
    /// since their index was last built — forces a reindex on the next
    /// `search` call for that vault instead of serving stale results.
    dirty: Mutex<HashSet<PathBuf>>,
}

impl RhizomeSearchService {
    /// Search `vault_path` for `query`, building the index on first use for
    /// this vault, and forcing a full reindex first if `invalidate` marked
    /// it dirty since the last search (post-write freshness — see
    /// docs/plans/2026-07-08-step3-absorb-search-scope.md).
    pub fn search(
        &self,
        vault_path: &Path,
        query: &str,
        limit: usize,
    ) -> Result<Vec<SearchHit>, String> {
        self.search_with_embedder_factory(vault_path, query, limit, || {
            let cache_dir = index_dir_for_vault(vault_path)?.join("model");
            Ok(Box::new(FastEmbedTextEmbedder::new(&cache_dir)?) as Box<dyn TextEmbedder + Send>)
        })
    }

    /// Mark `vault_path`'s index stale after a write that didn't go through
    /// this service (Distill/Import/Generate all write files directly, not
    /// via the search index). The next `search` call for this vault does a
    /// full reindex before serving results, so Ask sees the new page
    /// without an app restart. A blunt "drop the warm handle" wouldn't be
    /// enough here — the lazy-build path only reindexes a vault whose index
    /// is completely empty, so a vault with existing content would silently
    /// keep serving stale results after a drop-and-reopen.
    pub fn invalidate(&self, vault_path: &Path) {
        if let Ok(mut dirty) = self.dirty.lock() {
            dirty.insert(vault_path.to_path_buf());
        }
    }

    /// Same as `search`, but with the embedder construction pulled out
    /// behind a factory closure so tests can inject a deterministic fake
    /// instead of loading the real ~130MB ONNX model.
    fn search_with_embedder_factory(
        &self,
        vault_path: &Path,
        query: &str,
        limit: usize,
        build_embedder: impl FnOnce() -> Result<Box<dyn TextEmbedder + Send>, String>,
    ) -> Result<Vec<SearchHit>, String> {
        let mut handles = self
            .handles
            .lock()
            .map_err(|_| "Search index lock poisoned".to_string())?;

        let handle = match handles.entry(vault_path.to_path_buf()) {
            std::collections::hash_map::Entry::Occupied(entry) => entry.into_mut(),
            std::collections::hash_map::Entry::Vacant(entry) => {
                let embedder = build_embedder()?;
                let index = RhizomeSearchIndex::open_or_create(vault_path)?;
                entry.insert(VaultHandle { index, embedder })
            }
        };

        let was_dirty = self
            .dirty
            .lock()
            .map(|mut dirty| dirty.remove(vault_path))
            .unwrap_or(false);

        if was_dirty || handle.index.is_empty() {
            handle.index.reindex_all(handle.embedder.as_mut())?;
        }

        handle.index.search(query, limit, handle.embedder.as_mut())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use tempfile::TempDir;

    struct FakeEmbedder;

    impl TextEmbedder for FakeEmbedder {
        fn embed_batch(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
            Ok(texts
                .iter()
                .map(|t| {
                    let mut hasher = DefaultHasher::new();
                    t.hash(&mut hasher);
                    let seed = hasher.finish();
                    (0..8)
                        .map(|i| (((seed >> (i * 8)) & 0xff) as f32 / 255.0) - 0.5)
                        .collect()
                })
                .collect())
        }
    }

    fn fake_factory() -> Result<Box<dyn TextEmbedder + Send>, String> {
        Ok(Box::new(FakeEmbedder))
    }

    fn write_note(vault: &Path, relative: &str, content: &str) {
        let path = vault.join(relative);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, content).unwrap();
    }

    /// Each test's `TempDir` path hashes to its own cache dir under the
    /// real OS cache root (by design — the index lives outside the vault).
    /// Clean it up so repeated local/CI runs don't litter that real dir.
    fn cleanup_index_dir(vault_path: &Path) {
        if let Ok(dir) = index_dir_for_vault(vault_path) {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    #[test]
    fn search_builds_index_lazily_on_first_call() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "wiki/entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );

        let service = RhizomeSearchService::default();
        let hits = service
            .search_with_embedder_factory(dir.path(), "distributed systems", 10, fake_factory)
            .unwrap();

        assert!(hits.iter().any(|h| h.id == "entities/alice.md"));
        cleanup_index_dir(dir.path());
    }

    #[test]
    fn search_reuses_the_warm_handle_across_calls_for_the_same_vault() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "wiki/entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );

        let service = RhizomeSearchService::default();
        service
            .search_with_embedder_factory(dir.path(), "distributed", 10, fake_factory)
            .unwrap();

        // Second call must not rebuild the index (factory would be invoked
        // again on a fresh handle) — assert via handle-count, not a spy,
        // since the closure itself is FnOnce and can't be called twice here.
        assert_eq!(service.handles.lock().unwrap().len(), 1);

        let hits = service
            .search_with_embedder_factory(dir.path(), "distributed", 10, fake_factory)
            .unwrap();
        assert!(hits.iter().any(|h| h.id == "entities/alice.md"));
        assert_eq!(service.handles.lock().unwrap().len(), 1);
        cleanup_index_dir(dir.path());
    }

    /// The bug `invalidate` fixes: a warm index already has content, a page
    /// gets written by Distill/Import/Generate (outside this service, so
    /// the warm index doesn't know), and Ask must find it on the very next
    /// search — not after a restart.
    #[test]
    fn invalidate_forces_a_reindex_that_picks_up_a_write_made_after_warming() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "wiki/entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );

        let service = RhizomeSearchService::default();
        service
            .search_with_embedder_factory(dir.path(), "distributed", 10, fake_factory)
            .unwrap();

        // A write happens outside the search path (like run_distill_via_agent
        // does) after the index is already warm.
        write_note(
            dir.path(),
            "wiki/concepts/newly-written.md",
            "---\ntitle: Newly Written\n---\n\nA freshly distilled concept.",
        );
        service.invalidate(dir.path());

        let hits = service
            .search_with_embedder_factory(dir.path(), "freshly distilled", 10, fake_factory)
            .unwrap();
        assert!(
            hits.iter().any(|h| h.id == "concepts/newly-written.md"),
            "expected the post-warm write to be found after invalidate: {hits:?}"
        );
        cleanup_index_dir(dir.path());
    }

    #[test]
    fn search_without_invalidate_does_not_pick_up_a_write_made_after_warming() {
        let dir = TempDir::new().unwrap();
        write_note(
            dir.path(),
            "wiki/entities/alice.md",
            "---\ntitle: Alice\n---\n\nAlice works on distributed systems.",
        );

        let service = RhizomeSearchService::default();
        service
            .search_with_embedder_factory(dir.path(), "distributed", 10, fake_factory)
            .unwrap();

        write_note(
            dir.path(),
            "wiki/concepts/newly-written.md",
            "---\ntitle: Newly Written\n---\n\nA freshly distilled concept.",
        );
        // No invalidate() call this time.

        let hits = service
            .search_with_embedder_factory(dir.path(), "freshly distilled", 10, fake_factory)
            .unwrap();
        assert!(
            !hits.iter().any(|h| h.id == "concepts/newly-written.md"),
            "control case: without invalidate, the warm index stays stale"
        );
        cleanup_index_dir(dir.path());
    }
}
