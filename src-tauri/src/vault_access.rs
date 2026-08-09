//! Vault access tiers — see `docs/adr/0160-vault-access-tiers.md`.
//!
//! A path's tier is a property of the path, not of whoever is writing.
//! Every previous attempt to express this as "which agent may write" went
//! stale the moment the agent lineup changed; a file's sensitivity does
//! not.
//!
//! Only [`AccessTier::ReadOnly`] is implemented here. `Hidden` already
//! exists as index exclusion (`rhizome_search::OPERATIONAL_DIRS`) and
//! `ReadWrite` is the default, so neither needs representing.
//!
//! **Enforcement is partial and that is deliberate.** This binds agents
//! writing through the product's own paths — the Tauri note commands and
//! the frontmatter editor. It does not bind an agent shelling out to a
//! generic file-writing tool. The ADR records that gap rather than
//! implying full coverage; git makes such edits detectable even when they
//! are not preventable.

use std::path::Path;

/// What an agent may do with a path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccessTier {
    /// Default: agents read and write freely.
    ReadWrite,
    /// Agents read; writes are refused through the product's write paths.
    ReadOnly,
}

/// Repo-relative paths that define a contract rather than participate in
/// one, or whose value comes from not being casually rewritten.
///
/// A trailing `/` marks a directory prefix; everything else is an exact
/// repo-relative match.
const READ_ONLY_REPO_PATHS: &[&str] = &[
    "docs/VAULT_CONTRACT.md",
    "docs/CROSS-MODEL-HANDOFF.md",
    // Already governed by "never edit, supersede instead" — this makes an
    // existing convention real rather than advisory.
    "docs/adr/",
];

/// Vault-relative paths that are read-only inside a *vault* (as opposed to
/// this repo): the vault identity marker and the Portent type definitions,
/// which are schema — changed deliberately or not at all.
const READ_ONLY_VAULT_PATHS: &[&str] = &[
    "RHIZOME_VAULT.md",
    "person.md",
    "project.md",
    "task.md",
    "topic.md",
    "event.md",
    "operation.md",
    "responsibility.md",
];

/// Does `relative` match a read-only entry (exact file, or under a
/// directory prefix ending in `/`)?
fn matches(relative: &str, entries: &[&str]) -> bool {
    let normalized = relative.replace('\\', "/");
    let normalized = normalized.trim_start_matches("./");
    entries.iter().any(|entry| {
        if let Some(dir) = entry.strip_suffix('/') {
            normalized == dir || normalized.starts_with(&format!("{dir}/"))
        } else {
            normalized == *entry
        }
    })
}

/// Tier for `path` relative to `root`.
///
/// `root` is whichever tree the path was resolved against — a vault root
/// for note writes, the repo root for docs. Both tables are checked, since
/// a vault and the repo can be the same directory during development and
/// the entries do not collide.
pub fn tier_for(root: &Path, path: &Path) -> AccessTier {
    let Ok(relative) = path.strip_prefix(root) else {
        // Outside the root entirely — the caller's boundary check owns
        // that case; nothing to say about tiers here.
        return AccessTier::ReadWrite;
    };
    let relative = relative.to_string_lossy();
    if matches(&relative, READ_ONLY_REPO_PATHS) || matches(&relative, READ_ONLY_VAULT_PATHS) {
        AccessTier::ReadOnly
    } else {
        AccessTier::ReadWrite
    }
}

/// `Err` with a human-readable reason when `path` is read-only.
///
/// The message names the tier and the escape hatch, because "set in stone"
/// must not mean "unchangeable" — an unlock that is impossible is an
/// unlock that gets worked around. Changing one of these is a deliberate
/// act: edit `READ_ONLY_*` in its own commit.
pub fn ensure_writable(root: &Path, path: &Path) -> Result<(), String> {
    match tier_for(root, path) {
        AccessTier::ReadWrite => Ok(()),
        AccessTier::ReadOnly => Err(format!(
            "{} is read-only (ADR-0160). It defines a contract rather than \
             participating in one. To change it deliberately, update \
             READ_ONLY_REPO_PATHS / READ_ONLY_VAULT_PATHS in \
             src-tauri/src/vault_access.rs in its own commit.",
            path.display()
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn root() -> PathBuf {
        PathBuf::from("/vault")
    }

    #[test]
    fn contract_and_gotcha_docs_are_read_only() {
        for p in [
            "docs/VAULT_CONTRACT.md",
            "docs/CROSS-MODEL-HANDOFF.md",
            "RHIZOME_VAULT.md",
        ] {
            assert_eq!(
                tier_for(&root(), &root().join(p)),
                AccessTier::ReadOnly,
                "{p} should be read-only"
            );
        }
    }

    #[test]
    fn every_adr_is_read_only_including_ones_not_written_yet() {
        // Directory prefix, not an enumeration — a new ADR is protected the
        // moment it lands, without anyone remembering to list it.
        for p in [
            "docs/adr/0001-whatever.md",
            "docs/adr/0160-vault-access-tiers.md",
            "docs/adr/9999-future.md",
        ] {
            assert_eq!(tier_for(&root(), &root().join(p)), AccessTier::ReadOnly);
        }
    }

    #[test]
    fn portent_type_definitions_are_read_only() {
        for p in [
            "person.md",
            "project.md",
            "task.md",
            "topic.md",
            "event.md",
            "operation.md",
            "responsibility.md",
        ] {
            assert_eq!(
                tier_for(&root(), &root().join(p)),
                AccessTier::ReadOnly,
                "{p} is Portent schema"
            );
        }
    }

    #[test]
    fn ordinary_wiki_content_stays_writable() {
        // The tier list must not creep into normal knowledge content —
        // an over-broad read-only set is its own failure mode.
        for p in [
            "concepts/recursion.md",
            "entities/alice.md",
            "sources/documents/paper.md",
            "research/notes.md",
            "projects/rhizome/index.md",
            "docs/HANDOFF.md",
            "docs/ARCHITECTURE.md",
        ] {
            assert_eq!(
                tier_for(&root(), &root().join(p)),
                AccessTier::ReadWrite,
                "{p} should stay writable"
            );
        }
    }

    #[test]
    fn a_similarly_named_file_is_not_caught_by_the_directory_prefix() {
        // "docs/adr/" must not match "docs/adrenaline.md".
        assert_eq!(
            tier_for(&root(), &root().join("docs/adrenaline.md")),
            AccessTier::ReadWrite
        );
        // ...and a nested type-definition name is content, not schema.
        assert_eq!(
            tier_for(&root(), &root().join("concepts/person.md")),
            AccessTier::ReadWrite
        );
    }

    #[test]
    fn ensure_writable_explains_itself_and_names_the_unlock() {
        let err = ensure_writable(&root(), &root().join("docs/adr/0160-x.md")).unwrap_err();
        assert!(err.contains("read-only"), "got: {err}");
        assert!(err.contains("ADR-0160"), "should cite the decision: {err}");
        assert!(
            err.contains("vault_access.rs"),
            "an unlock that isn't findable gets worked around: {err}"
        );
        assert!(ensure_writable(&root(), &root().join("concepts/x.md")).is_ok());
    }

    #[test]
    fn paths_outside_the_root_are_left_to_the_boundary_check() {
        assert_eq!(
            tier_for(&root(), Path::new("/elsewhere/docs/VAULT_CONTRACT.md")),
            AccessTier::ReadWrite
        );
    }
}
