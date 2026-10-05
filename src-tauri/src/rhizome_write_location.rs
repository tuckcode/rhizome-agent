//! Single source of truth for Rhizome artifact placement inside a vault.
//! See `docs/VAULT_CONTRACT.md`. The Library scanner and every future
//! writer resolve paths through this table so they cannot drift apart.

use std::path::{Path, PathBuf};

/// Kind of research artifact that lives under a vault's `wiki/` tree.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactKind {
    RepoWiki,
    Document,
    Entity,
    Concept,
}

impl ArtifactKind {
    pub const ALL: [ArtifactKind; 4] = [
        ArtifactKind::RepoWiki,
        ArtifactKind::Document,
        ArtifactKind::Entity,
        ArtifactKind::Concept,
    ];

    /// Directory (relative to the vault root) this kind's files live in.
    pub fn dir(self) -> &'static str {
        match self {
            ArtifactKind::RepoWiki => "wiki/sources/repos",
            ArtifactKind::Document => "wiki/sources/documents",
            ArtifactKind::Entity => "wiki/entities",
            ArtifactKind::Concept => "wiki/concepts",
        }
    }

    /// Library-panel item type (`LibraryItem.type` in the frontend).
    pub fn item_type(self) -> &'static str {
        match self {
            ArtifactKind::RepoWiki => "wiki",
            ArtifactKind::Document => "source",
            ArtifactKind::Entity | ArtifactKind::Concept => "card",
        }
    }

    /// Library-panel item tag (`LibraryItem.tag` in the frontend).
    pub fn tag(self) -> &'static str {
        match self {
            ArtifactKind::RepoWiki => "Repo Wiki",
            ArtifactKind::Document => "Document",
            ArtifactKind::Entity => "Entity",
            ArtifactKind::Concept => "Concept",
        }
    }

    /// `type:` frontmatter value.
    pub fn frontmatter_type(self) -> &'static str {
        match self {
            ArtifactKind::RepoWiki => "wiki",
            ArtifactKind::Document => "source",
            ArtifactKind::Entity => "entity",
            ArtifactKind::Concept => "concept",
        }
    }

    /// This kind's directory in a pre-`wiki/` flat-layout vault (same
    /// relative shape, minus the `wiki/` wrapper). See `vault_uses_flat_layout`.
    pub fn flat_dir(self) -> &'static str {
        match self {
            ArtifactKind::RepoWiki => "sources/repos",
            ArtifactKind::Document => "sources/documents",
            ArtifactKind::Entity => "entities",
            ArtifactKind::Concept => "concepts",
        }
    }
}

/// True when a vault already uses the flat, pre-`wiki/` layout the original
/// Python `rhizome` CLI produced (`concepts/`, `entities/`, `sources/...` at
/// vault root) rather than this app's documented nested `wiki/` contract.
/// Detected by: no `wiki/` directory yet, but recognizable as a dedicated
/// Rhizome wiki vault (`RHIZOME_VAULT.md` or `.rhizome/` present). New or
/// unmarked vaults get the nested contract by default.
pub fn vault_uses_flat_layout(vault_path: &Path) -> bool {
    !vault_path.join("wiki").is_dir()
        && (vault_path.join("RHIZOME_VAULT.md").is_file() || vault_path.join(".rhizome").is_dir())
}

/// Is `vault_path` a dedicated Rhizome wiki vault (vs. a personal notes
/// vault)? Same marker files as `vault_uses_flat_layout`
/// (`RHIZOME_VAULT.md` / `.rhizome/`), but this answers "what nav mode
/// should the sidebar use" — a distinct concern from write layout, kept as
/// a separate fn so the two can diverge later without renaming call
/// sites. Unlike `vault_uses_flat_layout`, this is true even after a vault
/// has migrated to the nested `wiki/` layout — a migrated vault is still a
/// wiki vault.
pub fn is_wiki_vault(vault_path: &Path) -> bool {
    vault_path.join("RHIZOME_VAULT.md").is_file() || vault_path.join(".rhizome").is_dir()
}

/// This kind's directory (relative to the vault root) for the given vault —
/// nested `wiki/...` by default, or the flat equivalent when
/// `vault_uses_flat_layout` is true.
pub fn artifact_dir(vault_path: &Path, kind: ArtifactKind) -> &'static str {
    if vault_uses_flat_layout(vault_path) {
        kind.flat_dir()
    } else {
        kind.dir()
    }
}

/// Where a given artifact should be written, relative to the vault root.
pub fn resolve_write_path(vault_path: &Path, kind: ArtifactKind, slug: &str) -> PathBuf {
    vault_path
        .join(artifact_dir(vault_path, kind))
        .join(format!("{slug}.md"))
}

/// A written artifact's path relative to its vault root, for `events.jsonl`'s
/// `artifact_path` field. Falls back to the absolute path if `path` isn't
/// actually under `vault_path` (shouldn't happen for writer-produced paths).
/// Separators are normalized to `/` so the JSONL field is stable across
/// platforms (Windows `strip_prefix` yields `\`).
pub fn relative_to_vault(vault_path: &Path, path: &Path) -> String {
    let relative = path.strip_prefix(vault_path).unwrap_or(path);
    relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

/// Frontmatter skeleton for a new artifact of this kind, per
/// `docs/VAULT_CONTRACT.md`. Callers fill in `title`/`context`/body.
pub fn default_frontmatter(kind: ArtifactKind, title: &str, last_updated: &str) -> String {
    format!(
        "---\ntitle: {title}\ntype: {ftype}\nstate: fleeting\nlast_updated: {last_updated}\ncontext: \n---\n",
        ftype = kind.frontmatter_type(),
    )
}

/// Add `key: value` to a frontmatter block built by [`default_frontmatter`],
/// inserting it *before* the closing `---`.
///
/// `default_frontmatter` returns a complete, already-closed block, so
/// `push_str`ing an extra key lands it in the note body instead of the
/// frontmatter — where no parser ever sees it. Every writer that adds
/// optional keys (`kind`, `project`, `source`) goes through here so that
/// mistake cannot be made once per writer.
pub fn push_frontmatter_field(frontmatter: &mut String, key: &str, value: &str) {
    let field = format!("{key}: {value}\n");
    match frontmatter.rfind("---\n") {
        Some(closing) => frontmatter.insert_str(closing, &field),
        None => frontmatter.push_str(&field),
    }
}

/// Find a free path for `slug` under the vault's directory for `kind`,
/// adding a numeric suffix (`-2`, `-3`, ...) on collision rather than
/// overwriting. Shared by every artifact writer (distill, import, repo
/// research) so dedupe behavior cannot drift per kind.
pub fn unique_slug_path(
    vault_path: &std::path::Path,
    kind: ArtifactKind,
    slug: &str,
) -> (String, PathBuf) {
    let mut candidate = slug.to_string();
    let mut n = 2;
    loop {
        let path = resolve_write_path(vault_path, kind, &candidate);
        if !path.exists() {
            return (candidate, path);
        }
        candidate = format!("{slug}-{n}");
        n += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_write_path_nests_under_wiki() {
        let vault = std::path::Path::new("/vault");
        assert_eq!(
            resolve_write_path(vault, ArtifactKind::RepoWiki, "my-repo"),
            std::path::PathBuf::from("/vault/wiki/sources/repos/my-repo.md")
        );
        assert_eq!(
            resolve_write_path(vault, ArtifactKind::Entity, "alice"),
            std::path::PathBuf::from("/vault/wiki/entities/alice.md")
        );
    }

    #[test]
    fn default_frontmatter_includes_contract_fields() {
        let fm = default_frontmatter(ArtifactKind::Concept, "Recursion", "2026-07-08");
        assert!(fm.contains("type: concept"));
        assert!(fm.contains("title: Recursion"));
        assert!(fm.contains("last_updated: 2026-07-08"));
    }

    /// Parse a frontmatter block and return its keys — the only assertion
    /// that can tell "inside the block" from "sitting in the body".
    fn frontmatter_keys(frontmatter: &str) -> Vec<String> {
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        match matter.parse(frontmatter).data {
            Some(gray_matter::Pod::Hash(map)) => {
                let mut keys: Vec<String> = map.into_keys().collect();
                keys.sort();
                keys
            }
            _ => Vec::new(),
        }
    }

    #[test]
    fn pushed_fields_land_inside_the_block_not_in_the_body() {
        let mut fm = default_frontmatter(ArtifactKind::Document, "My Article", "2026-07-25");
        push_frontmatter_field(&mut fm, "source", "https://example.com/a");
        push_frontmatter_field(&mut fm, "project", "rhizome");

        assert!(
            fm.trim_end().ends_with("---"),
            "the block must still be closed last: {fm}"
        );
        let keys = frontmatter_keys(&fm);
        assert!(keys.contains(&"source".to_string()), "keys: {keys:?}");
        assert!(keys.contains(&"project".to_string()), "keys: {keys:?}");
    }

    #[test]
    fn pushing_onto_a_block_with_no_closing_delimiter_still_keeps_the_field() {
        let mut fm = "title: Loose\n".to_string();
        push_frontmatter_field(&mut fm, "source", "x");
        assert_eq!(fm, "title: Loose\nsource: x\n");
    }

    #[test]
    fn unique_slug_path_dedupes_per_kind() {
        let dir = tempfile::tempdir().unwrap();
        for kind in ArtifactKind::ALL {
            let (slug, path) = unique_slug_path(dir.path(), kind, "same-slug");
            assert_eq!(slug, "same-slug");
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, "x").unwrap();
            let (slug2, path2) = unique_slug_path(dir.path(), kind, "same-slug");
            assert_eq!(slug2, "same-slug-2");
            assert!(path2.ends_with(format!("{}/same-slug-2.md", kind.dir())));
        }
    }

    #[test]
    fn relative_to_vault_strips_the_vault_prefix() {
        let vault = Path::new("/vault");
        let path = Path::new("/vault/wiki/concepts/recursion.md");
        assert_eq!(relative_to_vault(vault, path), "wiki/concepts/recursion.md");
    }

    #[test]
    fn every_kind_has_a_distinct_dir() {
        let dirs: std::collections::HashSet<_> =
            ArtifactKind::ALL.iter().map(|k| k.dir()).collect();
        assert_eq!(dirs.len(), ArtifactKind::ALL.len());
    }

    #[test]
    fn every_kind_has_a_distinct_flat_dir() {
        let dirs: std::collections::HashSet<_> =
            ArtifactKind::ALL.iter().map(|k| k.flat_dir()).collect();
        assert_eq!(dirs.len(), ArtifactKind::ALL.len());
    }

    #[test]
    fn plain_vault_is_not_flat_layout() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!vault_uses_flat_layout(dir.path()));
    }

    #[test]
    fn rhizome_vault_marker_without_wiki_dir_is_flat_layout() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        assert!(vault_uses_flat_layout(dir.path()));
    }

    #[test]
    fn rhizome_dotdir_without_wiki_dir_is_flat_layout() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".rhizome")).unwrap();
        assert!(vault_uses_flat_layout(dir.path()));
    }

    #[test]
    fn existing_wiki_dir_overrides_flat_markers() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        std::fs::create_dir_all(dir.path().join("wiki")).unwrap();
        assert!(!vault_uses_flat_layout(dir.path()));
    }

    #[test]
    fn plain_vault_is_not_a_wiki_vault() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_wiki_vault(dir.path()));
    }

    #[test]
    fn rhizome_vault_marker_is_a_wiki_vault() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        assert!(is_wiki_vault(dir.path()));
    }

    #[test]
    fn rhizome_dotdir_is_a_wiki_vault() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".rhizome")).unwrap();
        assert!(is_wiki_vault(dir.path()));
    }

    #[test]
    fn is_wiki_vault_stays_true_after_migrating_to_nested_wiki_layout() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        std::fs::create_dir_all(dir.path().join("wiki")).unwrap();
        // Unlike vault_uses_flat_layout, a migrated vault is still a wiki vault.
        assert!(is_wiki_vault(dir.path()));
        assert!(!vault_uses_flat_layout(dir.path()));
    }

    #[test]
    fn resolve_write_path_uses_flat_dirs_for_a_flat_layout_vault() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        assert_eq!(
            resolve_write_path(dir.path(), ArtifactKind::Concept, "recursion"),
            dir.path().join("concepts/recursion.md")
        );
        assert_eq!(
            resolve_write_path(dir.path(), ArtifactKind::RepoWiki, "my-repo"),
            dir.path().join("sources/repos/my-repo.md")
        );
    }

    #[test]
    fn unique_slug_path_dedupes_per_kind_in_flat_layout() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("RHIZOME_VAULT.md"), "# Rhizome Vault\n").unwrap();
        for kind in ArtifactKind::ALL {
            let (slug, path) = unique_slug_path(dir.path(), kind, "same-slug");
            assert_eq!(slug, "same-slug");
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, "x").unwrap();
            let (slug2, path2) = unique_slug_path(dir.path(), kind, "same-slug");
            assert_eq!(slug2, "same-slug-2");
            assert!(path2.ends_with(format!("{}/same-slug-2.md", kind.flat_dir())));
            assert!(
                !path2.starts_with(dir.path().join("wiki")),
                "flat-layout vault must never grow a wiki/ dir: {path2:?}"
            );
        }
    }
}
