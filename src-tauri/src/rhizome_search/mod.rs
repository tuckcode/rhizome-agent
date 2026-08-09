//! Resident Rust search index for the Rhizome `wiki/` tree — replaces the
//! Python `rhizome-search` (DuckDB + fastembed) subprocess. See
//! `docs/plans/2026-07-08-step3-absorb-search-scope.md` (One Brain step 3a).
//!
//! Mirrors the Python contract exactly so ranking stays comparable:
//! - same wiki-dir resolution (`<vault>/wiki` if present, else `<vault>`)
//! - same operational-dir exclusions (`.rhizome/`, `raw/`, `.obsidian/`, `governance/`)
//! - same searchable-header composition (title/type/scope/project/context/tags + body)
//! - same fusion weights (0.7 vector cosine + 0.3 BM25)
//!
//! BM25 is scored across every matching document (not just a pre-filtered
//! top-N) and vectors are brute-force cosine over every embedded document —
//! same approach DuckDB's default (non-turbovec) backend takes. This is fine
//! at wiki scale (hundreds of documents); an ANN index would be premature.

pub mod embedder;
pub mod service;

use embedder::{cosine_similarity, TextEmbedder};
use gray_matter::engine::YAML;
use gray_matter::Matter;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::query::QueryParser;
use tantivy::schema::{Field, Schema, Value, STORED, STRING, TEXT};
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument, Term};

const OPERATIONAL_DIRS: &[&str] = &[".rhizome", "raw", ".obsidian", "governance"];
const WRITER_MEMORY_BUDGET: usize = 50_000_000;
const VECTOR_WEIGHT: f32 = 0.7;
const BM25_WEIGHT: f32 = 0.3;
const HEADER_KEYS: &[&str] = &["title", "type", "scope", "project", "context", "tags"];

#[derive(Debug, Clone, PartialEq)]
pub struct SearchHit {
    pub id: String,
    pub path: String,
    pub title: String,
    pub score: f32,
}

/// Resolve the directory that actually holds wiki pages, matching Python's
/// `rhizome.config.wiki_dir`: nested `<vault>/wiki` if present, else the
/// vault root itself (flat layout).
pub fn wiki_root(vault_path: &Path) -> PathBuf {
    let nested = vault_path.join("wiki");
    if nested.is_dir() {
        nested
    } else {
        vault_path.to_path_buf()
    }
}

/// The vault-root-relative prefix that must be reattached to a path already
/// resolved relative to [`wiki_root`] (as indexed `SearchHit::id`s are)
/// before it leaves Rust to a caller that expects vault-root-relative paths
/// — e.g. the Library panel's `scan_vault_library`, via
/// `rhizome_write_location::artifact_dir`. `"wiki/"` when the vault uses
/// the nested layout, `""` when flat, so `format!("{prefix}{id}")` produces
/// the same vault-root-relative string both codepaths agree on. See C17 in
/// `docs/HANDOFF.md`.
pub fn wiki_root_prefix(vault_path: &Path) -> &'static str {
    if wiki_root(vault_path) == vault_path {
        ""
    } else {
        "wiki/"
    }
}

fn is_operational_path(relative: &Path) -> bool {
    relative
        .components()
        .any(|c| OPERATIONAL_DIRS.contains(&c.as_os_str().to_string_lossy().as_ref()))
}

/// Stable, filesystem-safe cache key for a vault path, used to keep each
/// vault's index in its own directory under the app cache dir.
fn vault_cache_key(vault_path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    vault_path.to_string_lossy().hash(&mut hasher);
    let slug = vault_path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let safe_slug: String = slug
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    format!("{safe_slug}-{:016x}", hasher.finish())
}

/// `<cache-dir>/com.tolaria.app/search/<vault-key>/`, per the step-3 decision
/// to keep the index out of the vault and out of git.
pub fn index_dir_for_vault(vault_path: &Path) -> Result<PathBuf, String> {
    let cache_dir = dirs::cache_dir().ok_or("Could not resolve OS cache directory")?;
    Ok(cache_dir
        .join("com.tolaria.app")
        .join("search")
        .join(vault_cache_key(vault_path)))
}

fn collect_documents(wiki_root: &Path) -> Vec<PathBuf> {
    walkdir::WalkDir::new(wiki_root)
        .into_iter()
        .filter_map(|e| e.ok())
        .map(|e| e.into_path())
        .filter(|path| path.is_file() && path.extension().is_some_and(|ext| ext == "md"))
        .filter(|path| {
            let relative = path.strip_prefix(wiki_root).unwrap_or(path);
            !is_operational_path(relative)
        })
        .collect()
}

/// Frontmatter header + body, mirroring Python's `index_folder`
/// searchable-header composition exactly (title/type/scope/project/context/tags).
fn searchable_text(content: &str) -> String {
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(content);

    let header_line = |key: &str| -> Option<String> {
        let gray_matter::Pod::Hash(map) = parsed.data.clone()? else {
            return None;
        };
        match map.get(key)? {
            gray_matter::Pod::String(s) if !s.is_empty() => Some(s.clone()),
            gray_matter::Pod::Array(items) => {
                let joined = items
                    .iter()
                    .filter_map(|item| match item {
                        gray_matter::Pod::String(s) => Some(s.clone()),
                        _ => None,
                    })
                    .collect::<Vec<_>>()
                    .join(", ");
                (!joined.is_empty()).then_some(joined)
            }
            _ => None,
        }
    };

    let header = HEADER_KEYS
        .iter()
        .filter_map(|key| header_line(key))
        .collect::<Vec<_>>()
        .join("\n");

    if header.is_empty() {
        parsed.content
    } else {
        format!("{header}\n\n{}", parsed.content)
    }
}

fn document_title(content: &str, filename: &str) -> String {
    crate::vault::derive_markdown_title_from_content(content, filename)
}

fn build_schema() -> (Schema, Field, Field, Field) {
    let mut builder = Schema::builder();
    let id_field = builder.add_text_field("id", STRING | STORED);
    let title_field = builder.add_text_field("title", TEXT | STORED);
    let content_field = builder.add_text_field("content", TEXT);
    (builder.build(), id_field, title_field, content_field)
}

fn fields_from_index(index: &Index) -> Result<(Field, Field, Field), String> {
    let schema = index.schema();
    let id_field = schema
        .get_field("id")
        .map_err(|_| "Search index schema missing field 'id'".to_string())?;
    let title_field = schema
        .get_field("title")
        .map_err(|_| "Search index schema missing field 'title'".to_string())?;
    let content_field = schema
        .get_field("content")
        .map_err(|_| "Search index schema missing field 'content'".to_string())?;
    Ok((id_field, title_field, content_field))
}

/// Embeddings are kept in a flat sidecar file rather than a tantivy stored
/// field: at wiki scale (hundreds of docs) a full in-memory HashMap loaded
/// once per search is simpler than wiring tantivy's byte-field retrieval for
/// every candidate, and it matches what DuckDB's default vector backend does
/// (brute-force cosine over every row).
fn load_embeddings(path: &Path) -> HashMap<String, Vec<f32>> {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn save_embeddings(path: &Path, embeddings: &HashMap<String, Vec<f32>>) -> Result<(), String> {
    let bytes = serde_json::to_vec(embeddings)
        .map_err(|e| format!("Failed to serialize embeddings: {e}"))?;
    std::fs::write(path, bytes).map_err(|e| format!("Failed to write embeddings cache: {e}"))
}

pub struct RhizomeSearchIndex {
    vault_path: PathBuf,
    index: Index,
    /// `None` when opened reader-only (sidecar / multi-process search).
    /// Writer holds exclusive `.tantivy-writer.lock` — only the GUI warm
    /// path and short-lived index builds should take it (ADR-0152).
    writer: Option<IndexWriter>,
    reader: IndexReader,
    id_field: Field,
    title_field: Field,
    content_field: Field,
    embeddings_path: PathBuf,
    embeddings: HashMap<String, Vec<f32>>,
}

impl RhizomeSearchIndex {
    /// Open the on-disk index for `vault_path`, creating it (empty) if this
    /// is the first time this vault has been indexed. Takes the exclusive
    /// writer lock — use [`open_reader`] for concurrent query processes.
    pub fn open_or_create(vault_path: &Path) -> Result<Self, String> {
        let dir = index_dir_for_vault(vault_path)?;
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create index dir {}: {e}", dir.display()))?;

        let (schema, id_field, title_field, content_field) = build_schema();
        let mmap_dir = MmapDirectory::open(&dir)
            .map_err(|e| format!("Failed to open index directory: {e}"))?;
        let index = Index::open_or_create(mmap_dir, schema)
            .map_err(|e| format!("Failed to open/create tantivy index: {e}"))?;
        let writer = index
            .writer(WRITER_MEMORY_BUDGET)
            .map_err(|e| format!("Failed to create index writer: {e}"))?;
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| format!("Failed to create index reader: {e}"))?;

        let embeddings_path = dir.join("embeddings.json");
        let embeddings = load_embeddings(&embeddings_path);

        Ok(Self {
            vault_path: vault_path.to_path_buf(),
            index,
            writer: Some(writer),
            reader,
            id_field,
            title_field,
            content_field,
            embeddings_path,
            embeddings,
        })
    }

    /// Open an existing on-disk index **without** acquiring the writer lock.
    /// Safe while Rhizome Desktop holds a warm writer for the same vault
    /// (MCP sidecar / multi-process search — ADR-0152).
    ///
    /// Errors if the index directory does not exist yet (caller may attempt
    /// a short-lived [`open_or_create`] build, or surface "index not built").
    pub fn open_reader(vault_path: &Path) -> Result<Self, String> {
        let dir = index_dir_for_vault(vault_path)?;
        if !dir.is_dir() {
            return Err(format!(
                "Search index not built yet for vault {} (no index dir at {})",
                vault_path.display(),
                dir.display()
            ));
        }

        let mmap_dir = MmapDirectory::open(&dir)
            .map_err(|e| format!("Failed to open index directory: {e}"))?;
        let index =
            Index::open(mmap_dir).map_err(|e| format!("Failed to open tantivy index: {e}"))?;
        let (id_field, title_field, content_field) = fields_from_index(&index)?;
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| format!("Failed to create index reader: {e}"))?;

        let embeddings_path = dir.join("embeddings.json");
        let embeddings = load_embeddings(&embeddings_path);

        Ok(Self {
            vault_path: vault_path.to_path_buf(),
            index,
            writer: None,
            reader,
            id_field,
            title_field,
            content_field,
            embeddings_path,
            embeddings,
        })
    }

    /// True when this handle can mutate the index (GUI / build path).
    pub fn is_writable(&self) -> bool {
        self.writer.is_some()
    }

    fn writer_mut(&mut self) -> Result<&mut IndexWriter, String> {
        self.writer.as_mut().ok_or_else(|| {
            "Search index opened reader-only; cannot mutate (sidecar query path)".to_string()
        })
    }

    fn doc_id(&self, path: &Path) -> String {
        let root = wiki_root(&self.vault_path);
        crate::vault::path_identity::vault_relative_path_string(&root, path)
            .unwrap_or_else(|_| path.to_string_lossy().to_string())
    }

    /// True if this index has never been built (fresh vault, first use).
    /// Callers use this to decide whether a lazy `reindex_all` is needed.
    pub fn is_empty(&self) -> bool {
        self.reader.searcher().num_docs() == 0
    }

    /// Full rebuild: clears the index and embeddings, then re-walks and
    /// re-embeds every document under `wiki_root`. Returns the count indexed.
    pub fn reindex_all(&mut self, embedder: &mut dyn TextEmbedder) -> Result<usize, String> {
        self.writer_mut()?
            .delete_all_documents()
            .map_err(|e| format!("Failed to clear index: {e}"))?;
        self.embeddings.clear();

        let root = wiki_root(&self.vault_path);
        let paths = collect_documents(&root);
        let count = self.index_paths(&paths, embedder)?;
        self.commit()?;
        Ok(count)
    }

    /// Incrementally re-index the given paths (added or changed) and drop
    /// any that no longer exist on disk. Call after the vault watcher
    /// reports changes under `wiki/` (not wired yet).
    pub fn update_paths(
        &mut self,
        changed_or_new: &[PathBuf],
        embedder: &mut dyn TextEmbedder,
    ) -> Result<(), String> {
        let id_field = self.id_field;
        for path in changed_or_new {
            let id = self.doc_id(path);
            self.writer_mut()?
                .delete_term(Term::from_field_text(id_field, &id));
            self.embeddings.remove(&id);
        }
        self.index_paths(changed_or_new, embedder)?;
        self.commit()
    }

    /// Remove documents whose files no longer exist (deleted or moved out
    /// of `wiki/`).
    pub fn remove_paths(&mut self, removed: &[PathBuf]) -> Result<(), String> {
        let id_field = self.id_field;
        for path in removed {
            let id = self.doc_id(path);
            self.writer_mut()?
                .delete_term(Term::from_field_text(id_field, &id));
            self.embeddings.remove(&id);
        }
        self.commit()
    }

    fn index_paths(
        &mut self,
        paths: &[PathBuf],
        embedder: &mut dyn TextEmbedder,
    ) -> Result<usize, String> {
        let mut ids = Vec::with_capacity(paths.len());
        let mut titles = Vec::with_capacity(paths.len());
        let mut bodies = Vec::with_capacity(paths.len());

        for path in paths {
            let Ok(content) = std::fs::read_to_string(path) else {
                continue;
            };
            let filename = path
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();

            ids.push(self.doc_id(path));
            titles.push(document_title(&content, &filename));
            bodies.push(searchable_text(&content));
        }

        if bodies.is_empty() {
            return Ok(0);
        }

        let vectors = embedder.embed_batch(&bodies)?;
        let count = bodies.len();
        for (((id, title), body), vector) in ids.into_iter().zip(titles).zip(bodies).zip(vectors) {
            let mut tantivy_doc = TantivyDocument::default();
            tantivy_doc.add_text(self.id_field, &id);
            tantivy_doc.add_text(self.title_field, &title);
            tantivy_doc.add_text(self.content_field, &body);
            self.writer_mut()?
                .add_document(tantivy_doc)
                .map_err(|e| format!("Failed to add document {id}: {e}"))?;
            self.embeddings.insert(id, vector);
        }

        Ok(count)
    }

    fn commit(&mut self) -> Result<(), String> {
        self.writer_mut()?
            .commit()
            .map_err(|e| format!("Failed to commit index: {e}"))?;
        self.reader
            .reload()
            .map_err(|e| format!("Failed to reload index reader: {e}"))?;
        save_embeddings(&self.embeddings_path, &self.embeddings)
    }

    /// Hybrid search: 0.7 vector cosine + 0.3 BM25, matching the Python
    /// fusion weights. Vector scores are brute-force cosine over every
    /// embedded document; BM25 scores every document tantivy considers a
    /// match (not pre-limited), so both halves see the full candidate set
    /// before fusion — same shape as DuckDB's default (non-turbovec) query.
    pub fn search(
        &self,
        query: &str,
        limit: usize,
        embedder: &mut dyn TextEmbedder,
    ) -> Result<Vec<SearchHit>, String> {
        let searcher = self.reader.searcher();
        let mut fused: HashMap<String, (f32, String, String)> = HashMap::new();

        let query_parser =
            QueryParser::for_index(&self.index, vec![self.title_field, self.content_field]);
        if let Ok(parsed_query) = query_parser.parse_query(query) {
            let doc_count = searcher.num_docs().max(1) as usize;
            let top_docs = searcher
                .search(&parsed_query, &TopDocs::with_limit(doc_count))
                .map_err(|e| format!("BM25 search failed: {e}"))?;
            for (score, address) in top_docs {
                let retrieved: TantivyDocument = searcher
                    .doc(address)
                    .map_err(|e| format!("Failed to fetch matched document: {e}"))?;
                let id = text_value(&retrieved, self.id_field);
                let title = text_value(&retrieved, self.title_field);
                fused.insert(id.clone(), (score * BM25_WEIGHT, id, title));
            }
        }

        let query_vector = embedder.embed_one(query)?;
        if !query_vector.is_empty() {
            for (id, vector) in &self.embeddings {
                let similarity = cosine_similarity(&query_vector, vector);
                if similarity <= 0.0 {
                    continue;
                }
                let contribution = similarity * VECTOR_WEIGHT;
                fused
                    .entry(id.clone())
                    .and_modify(|(score, _, _)| *score += contribution)
                    .or_insert_with(|| (contribution, id.clone(), String::new()));
            }
        }

        // Vector-only hits never got a title from the BM25 pass above.
        let mut hits: Vec<SearchHit> = fused
            .into_values()
            .map(|(score, id, title)| {
                let title = if title.is_empty() {
                    self.title_for_id(&searcher, &id)
                        .unwrap_or_else(|| id.clone())
                } else {
                    title
                };
                SearchHit {
                    path: id.clone(),
                    id,
                    title,
                    score,
                }
            })
            .collect();

        hits.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        hits.truncate(limit);
        Ok(hits)
    }

    fn title_for_id(&self, searcher: &tantivy::Searcher, id: &str) -> Option<String> {
        let term = Term::from_field_text(self.id_field, id);
        let query = tantivy::query::TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic);
        let top = searcher.search(&query, &TopDocs::with_limit(1)).ok()?;
        let (_, address) = top.first()?;
        let retrieved: TantivyDocument = searcher.doc(*address).ok()?;
        Some(text_value(&retrieved, self.title_field))
    }
}

fn text_value(doc: &TantivyDocument, field: Field) -> String {
    doc.get_first(field)
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// Deterministic fake embedder: same text always yields the same
    /// vector, distinct texts yield near-orthogonal vectors. No model
    /// download, no network — keeps these tests fast and isolated.
    struct FakeEmbedder;

    impl TextEmbedder for FakeEmbedder {
        fn embed_batch(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
            Ok(texts.iter().map(|t| fake_vector(t)).collect())
        }
    }

    fn fake_vector(text: &str) -> Vec<f32> {
        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let seed = hasher.finish();
        // 8-dim vector deterministically derived from the text's hash bits.
        (0..8)
            .map(|i| (((seed >> (i * 8)) & 0xff) as f32 / 255.0) - 0.5)
            .collect()
    }

    fn write_fixture_vault(dir: &TempDir) -> PathBuf {
        let wiki = dir.path().join("wiki");
        std::fs::create_dir_all(wiki.join("sources/repos")).unwrap();
        std::fs::create_dir_all(wiki.join("entities")).unwrap();
        std::fs::create_dir_all(dir.path().join("raw")).unwrap();
        std::fs::create_dir_all(dir.path().join("governance")).unwrap();

        std::fs::write(
            wiki.join("sources/repos/hyperframes.md"),
            "---\ntitle: HyperFrames\ntype: wiki\ncontext: video rendering engine\n---\n\nHyperFrames renders video from HTML compositions.",
        )
        .unwrap();
        std::fs::write(
            wiki.join("entities/alice.md"),
            "---\ntitle: Alice\ntype: entity\n---\n\nAlice works on memory systems and retrieval.",
        )
        .unwrap();
        std::fs::write(
            dir.path().join("raw/dump.md"),
            "# Raw dump\n\nShould never appear in search results.",
        )
        .unwrap();
        std::fs::write(
            dir.path().join("governance/AGENTS.md"),
            "# Governance\n\nShould never appear in search results.",
        )
        .unwrap();

        dir.path().to_path_buf()
    }

    #[test]
    fn wiki_root_prefers_nested_wiki_dir_over_flat_layout() {
        let dir = TempDir::new().unwrap();
        std::fs::create_dir_all(dir.path().join("wiki")).unwrap();
        assert_eq!(wiki_root(dir.path()), dir.path().join("wiki"));

        let flat = TempDir::new().unwrap();
        assert_eq!(wiki_root(flat.path()), flat.path().to_path_buf());
    }

    #[test]
    fn wiki_root_prefix_is_wiki_slash_for_nested_and_empty_for_flat() {
        let nested = TempDir::new().unwrap();
        std::fs::create_dir_all(nested.path().join("wiki")).unwrap();
        assert_eq!(wiki_root_prefix(nested.path()), "wiki/");

        let flat = TempDir::new().unwrap();
        assert_eq!(wiki_root_prefix(flat.path()), "");
    }

    #[test]
    fn collect_documents_excludes_operational_dirs() {
        let dir = TempDir::new().unwrap();
        let vault = write_fixture_vault(&dir);
        let root = wiki_root(&vault);
        let mut found: Vec<String> = collect_documents(&root)
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        found.sort();
        assert_eq!(found, vec!["alice.md", "hyperframes.md"]);
    }

    #[test]
    fn searchable_text_composes_header_then_body_like_python() {
        let content = "---\ntitle: Recursion\ntype: concept\ntags:\n  - cs\n  - math\n---\n\nA function calling itself.";
        let text = searchable_text(content);
        assert!(text.starts_with("Recursion\nconcept"));
        assert!(text.contains("cs, math"));
        assert!(text.ends_with("A function calling itself."));
    }

    #[test]
    fn reindex_all_finds_documents_by_bm25_and_excludes_operational_dirs() {
        let dir = TempDir::new().unwrap();
        let vault = write_fixture_vault(&dir);
        let mut index = RhizomeSearchIndex::open_or_create(&vault).unwrap();
        let mut embedder = FakeEmbedder;

        let count = index.reindex_all(&mut embedder).unwrap();
        assert_eq!(count, 2);

        let hits = index.search("video rendering", 10, &mut embedder).unwrap();
        assert!(hits.iter().any(|h| h.id == "sources/repos/hyperframes.md"));
        assert!(!hits
            .iter()
            .any(|h| h.id.contains("raw/") || h.id.contains("governance/")));
    }

    #[test]
    fn update_paths_replaces_a_single_document_without_full_reindex() {
        let dir = TempDir::new().unwrap();
        let vault = write_fixture_vault(&dir);
        let mut index = RhizomeSearchIndex::open_or_create(&vault).unwrap();
        let mut embedder = FakeEmbedder;
        index.reindex_all(&mut embedder).unwrap();

        let alice_path = wiki_root(&vault).join("entities/alice.md");
        std::fs::write(
            &alice_path,
            "---\ntitle: Alice\ntype: entity\n---\n\nAlice now specializes in distributed systems.",
        )
        .unwrap();
        index.update_paths(&[alice_path], &mut embedder).unwrap();

        let hits = index
            .search("distributed systems", 10, &mut embedder)
            .unwrap();
        assert!(hits.iter().any(|h| h.id == "entities/alice.md"));

        // Old content should no longer be indexed for this doc (single copy, not duplicated).
        let all_hits = index.search("Alice", 10, &mut embedder).unwrap();
        let alice_hits: Vec<_> = all_hits
            .iter()
            .filter(|h| h.id == "entities/alice.md")
            .collect();
        assert_eq!(alice_hits.len(), 1);
    }

    #[test]
    fn remove_paths_drops_document_from_search_results() {
        let dir = TempDir::new().unwrap();
        let vault = write_fixture_vault(&dir);
        let mut index = RhizomeSearchIndex::open_or_create(&vault).unwrap();
        let mut embedder = FakeEmbedder;
        index.reindex_all(&mut embedder).unwrap();

        let hyperframes_path = wiki_root(&vault).join("sources/repos/hyperframes.md");
        index.remove_paths(&[hyperframes_path]).unwrap();

        let hits = index.search("video rendering", 10, &mut embedder).unwrap();
        assert!(!hits.iter().any(|h| h.id == "sources/repos/hyperframes.md"));
    }

    #[test]
    fn vault_cache_key_is_stable_and_distinct_per_vault() {
        let a = vault_cache_key(Path::new("/Users/x/Vault A"));
        let b = vault_cache_key(Path::new("/Users/x/Vault B"));
        let a_again = vault_cache_key(Path::new("/Users/x/Vault A"));
        assert_eq!(a, a_again);
        assert_ne!(a, b);
    }

    #[test]
    fn index_dir_for_vault_is_scoped_under_app_cache_dir() {
        let dir = index_dir_for_vault(Path::new("/Users/x/SomeVault")).unwrap();
        let dir_str = dir.to_string_lossy();
        assert!(dir_str.contains("com.tolaria.app"));
        assert!(dir_str.contains("search"));
    }

    fn cleanup_index_dir(vault_path: &Path) {
        if let Ok(dir) = index_dir_for_vault(vault_path) {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    /// ADR-0152 gate: reader-only search must succeed while a writer holds
    /// the exclusive tantivy lock (GUI warm path + MCP sidecar).
    #[test]
    fn open_reader_works_while_writer_holds_lock() {
        let dir = TempDir::new().unwrap();
        let vault = write_fixture_vault(&dir);
        let mut writer_index = RhizomeSearchIndex::open_or_create(&vault).unwrap();
        let mut embedder = FakeEmbedder;
        writer_index.reindex_all(&mut embedder).unwrap();
        assert!(writer_index.is_writable());

        // Second writer open must fail while the first writer is alive —
        // this is the failure mode sidecar would hit without open_reader.
        let second_writer = RhizomeSearchIndex::open_or_create(&vault);
        assert!(
            second_writer.is_err(),
            "expected writer lock contention, got Ok"
        );

        let reader_index = RhizomeSearchIndex::open_reader(&vault).unwrap();
        assert!(!reader_index.is_writable());
        let hits = reader_index
            .search("video rendering", 10, &mut embedder)
            .unwrap();
        assert!(hits.iter().any(|h| h.id == "sources/repos/hyperframes.md"));

        // Mutating through a reader-only handle must fail cleanly.
        let mut reader_mut = reader_index;
        let err = reader_mut.reindex_all(&mut embedder).unwrap_err();
        assert!(
            err.contains("reader-only"),
            "expected reader-only mutate error, got: {err}"
        );

        drop(writer_index);
        cleanup_index_dir(&vault);
    }

    #[test]
    fn open_reader_rejects_missing_index_dir() {
        let dir = TempDir::new().unwrap();
        cleanup_index_dir(dir.path());
        let err = match RhizomeSearchIndex::open_reader(dir.path()) {
            Ok(_) => panic!("expected not-built error, got Ok"),
            Err(e) => e,
        };
        assert!(
            err.contains("not built"),
            "expected not-built error, got: {err}"
        );
    }
}
