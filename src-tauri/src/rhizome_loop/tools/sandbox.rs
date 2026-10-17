//! Canonical path lock for native read tools.
//!
//! A path must resolve inside the current workspace or another mounted
//! vault root. `..` and symlinks are followed first. Anything outside
//! those roots is refused with a message the model can read.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

pub const OUTSIDE_ROOTS: &str = "Path is outside the allowed vault and workspace roots.";
pub const NO_ROOTS: &str = "No active vault or workspace is available.";
pub const BLOCKED_SECRET: &str = "blocked: secret file";

/// Canonical vault / workspace roots for one tool call.
#[derive(Debug, Clone)]
pub struct Roots {
    /// Canonical current workspace, when the loop set one.
    pub current: Option<PathBuf>,
    /// Allowed canonical roots. Current workspace first, then extras.
    pub all: Vec<PathBuf>,
}

pub fn allowed_roots(vault_path: Option<&str>, vault_paths: &[String]) -> Result<Roots, String> {
    let mut all = Vec::new();
    let current = match vault_path.map(str::trim).filter(|path| !path.is_empty()) {
        Some(path) => {
            let canonical = canonicalize_root(path)?;
            all.push(canonical.clone());
            Some(canonical)
        }
        None => None,
    };

    for extra in vault_paths {
        let trimmed = extra.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(canonical) = canonicalize_root(trimmed) else {
            continue;
        };
        if all.iter().any(|root| root == &canonical) {
            continue;
        }
        all.push(canonical);
    }

    if all.is_empty() {
        return Err(NO_ROOTS.to_string());
    }

    Ok(Roots { current, all })
}

/// Resolve `requested` against the current workspace, follow `..` and
/// symlinks, and refuse a result outside the allowed roots.
pub fn resolve(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    let roots = allowed_roots(vault_path, vault_paths)?;
    resolve_in(requested, &roots)
}

pub fn resolve_in(requested: &str, roots: &Roots) -> Result<PathBuf, String> {
    let trimmed = requested.trim();
    if trimmed.is_empty() {
        return Err("Path is required.".into());
    }
    let raw = PathBuf::from(trimmed);
    let joined = if raw.is_absolute() {
        raw
    } else {
        let base = roots
            .current
            .clone()
            .or_else(|| roots.all.first().cloned())
            .ok_or_else(|| NO_ROOTS.to_string())?;
        base.join(&raw)
    };
    let resolved = canonicalize_path(&joined)?;
    if !roots.all.iter().any(|root| is_within(&resolved, root)) {
        return Err(format!("{OUTSIDE_ROOTS} Requested path: {trimmed}"));
    }
    if is_secret(&resolved) {
        return Err(format!("{BLOCKED_SECRET} Requested path: {trimmed}"));
    }
    Ok(resolved)
}

pub fn resolve_file(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    let path = resolve(requested, vault_path, vault_paths)?;
    if path.is_dir() {
        return Err(format!("Not a file: {}", requested.trim()));
    }
    if !path.is_file() {
        return Err(format!("File not found: {}", requested.trim()));
    }
    Ok(path)
}

pub fn resolve_dir(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    let path = resolve(requested, vault_path, vault_paths)?;
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", requested.trim()));
    }
    Ok(path)
}

pub fn is_within(candidate: &Path, root: &Path) -> bool {
    candidate.strip_prefix(root).is_ok()
}

/// Deny `.env*`, anything under `.git/`, `*.pem`, and `id_*`.
/// Basename match is case-insensitive. Checked on the path as given
/// and on its canonical target so a symlink cannot hide a secret.
pub fn is_secret(path: &Path) -> bool {
    if looks_secret(path) {
        return true;
    }
    match path.canonicalize() {
        Ok(canonical) if canonical != path => looks_secret(&canonical),
        _ => false,
    }
}

fn looks_secret(path: &Path) -> bool {
    if path.components().any(component_is_git) {
        return true;
    }
    let Some(name) = path.file_name() else {
        return false;
    };
    let lower = name.to_string_lossy().to_ascii_lowercase();
    lower.starts_with(".env") || lower.ends_with(".pem") || lower.starts_with("id_")
}

fn component_is_git(component: std::path::Component<'_>) -> bool {
    match component {
        std::path::Component::Normal(name) => name.to_string_lossy().eq_ignore_ascii_case(".git"),
        _ => false,
    }
}

/// Path relative to the longest matching allowed root, with `/`.
pub fn relative_to_root(path: &Path, roots: &Roots) -> String {
    let root = roots
        .all
        .iter()
        .filter(|root| is_within(path, root))
        .max_by_key(|root| root.components().count());
    match root.and_then(|root| path.strip_prefix(root).ok()) {
        Some(rel) => {
            let text = rel.to_string_lossy().replace('\\', "/");
            if text.is_empty() {
                ".".into()
            } else {
                text
            }
        }
        None => path.to_string_lossy().replace('\\', "/"),
    }
}

fn canonicalize_root(raw: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw);
    let canonical = path
        .canonicalize()
        .map_err(|_| format!("Vault or workspace is not available: {raw}"))?;
    if !canonical.is_dir() {
        return Err(format!("Vault or workspace is not available: {raw}"));
    }
    Ok(canonical)
}

fn canonicalize_path(path: &Path) -> Result<PathBuf, String> {
    match path.canonicalize() {
        Ok(canonical) => Ok(canonical),
        Err(_) => canonicalize_missing(path),
    }
}

fn canonicalize_missing(path: &Path) -> Result<PathBuf, String> {
    let mut current = path.to_path_buf();
    let mut tail: Vec<OsString> = Vec::new();
    loop {
        if current.exists() {
            let mut resolved = current
                .canonicalize()
                .map_err(|_| format!("Cannot resolve path: {}", path.to_string_lossy()))?;
            for name in tail.into_iter().rev() {
                if name == "." {
                    continue;
                }
                if name == ".." {
                    resolved.pop();
                    continue;
                }
                resolved.push(name);
            }
            return Ok(resolved);
        }
        let Some(name) = current.file_name() else {
            return Err(format!("Cannot resolve path: {}", path.to_string_lossy()));
        };
        tail.push(name.to_os_string());
        let Some(parent) = current.parent() else {
            return Err(format!("Cannot resolve path: {}", path.to_string_lossy()));
        };
        current = parent.to_path_buf();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn vault() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().canonicalize().unwrap();
        fs::write(path.join("inside.md"), "ok\n").unwrap();
        (dir, path.to_string_lossy().into_owned())
    }

    #[test]
    fn relative_path_inside_the_current_workspace_resolves() {
        let (_dir, root) = vault();
        let resolved = resolve("inside.md", Some(&root), &[]).unwrap();
        assert_eq!(resolved, PathBuf::from(&root).join("inside.md"));
    }

    #[test]
    fn parent_traversal_is_refused() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        fs::write(parent.path().join("secret.md"), "no\n").unwrap();
        let root = vault.canonicalize().unwrap();
        let error = resolve("../secret.md", Some(root.to_str().unwrap()), &[]).unwrap_err();
        assert!(
            error.contains(OUTSIDE_ROOTS),
            "traversal must name the outside-roots error: {error}"
        );
        assert!(error.contains("../secret.md"), "{error}");
    }

    #[test]
    fn absolute_path_outside_the_roots_is_refused() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        let file = outside.path().join("passwd");
        fs::write(&file, "no\n").unwrap();
        let error = resolve(file.to_str().unwrap(), Some(&root), &[]).unwrap_err();
        assert!(error.contains(OUTSIDE_ROOTS), "{error}");
    }

    #[test]
    fn absolute_path_in_another_mounted_vault_is_allowed() {
        let (_a, root_a) = vault();
        let b = tempfile::tempdir().unwrap();
        let root_b = b.path().canonicalize().unwrap();
        fs::write(root_b.join("other.md"), "two\n").unwrap();
        let requested = root_b.join("other.md");
        let resolved = resolve(
            requested.to_str().unwrap(),
            Some(&root_a),
            &[root_b.to_string_lossy().into_owned()],
        )
        .unwrap();
        assert_eq!(resolved, requested);
    }

    #[cfg(unix)]
    #[test]
    fn symlink_pointing_outside_is_refused() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        let target = outside.path().join("escaped.md");
        fs::write(&target, "no\n").unwrap();
        let link = PathBuf::from(&root).join("out.link");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let error = resolve("out.link", Some(&root), &[]).unwrap_err();
        assert!(
            error.contains(OUTSIDE_ROOTS),
            "symlink-out must refuse: {error}"
        );
    }

    #[test]
    fn missing_roots_return_a_clear_error() {
        let error = resolve("a.md", None, &[]).unwrap_err();
        assert_eq!(error, NO_ROOTS);
    }

    #[test]
    fn sibling_root_prefix_collision_is_refused() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        let evil = parent.path().join("vault-evil");
        fs::create_dir(&vault).unwrap();
        fs::create_dir(&evil).unwrap();
        fs::write(evil.join("secret.md"), "no\n").unwrap();
        let root = vault.canonicalize().unwrap();
        let requested = evil.join("secret.md");
        let error = resolve(
            requested.to_str().unwrap(),
            Some(root.to_str().unwrap()),
            &[],
        )
        .unwrap_err();
        assert!(
            error.contains(OUTSIDE_ROOTS),
            "vault-evil must not match the vault prefix: {error}"
        );
        assert!(!is_within(&requested.canonicalize().unwrap(), &root));
    }

    #[test]
    fn missing_path_with_parent_dir_is_refused() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let root = vault.canonicalize().unwrap();
        let error = resolve("../no-such.md", Some(root.to_str().unwrap()), &[]).unwrap_err();
        assert!(
            error.contains(OUTSIDE_ROOTS),
            "missing .. path must name the outside-roots error, not file-not-found: {error}"
        );
        assert!(!error.to_lowercase().contains("not found"), "{error}");
    }

    fn plant(root: &Path, rel: &str) -> PathBuf {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, "secret-value\n").unwrap();
        path
    }

    fn assert_blocked(root: &str, requested: &str) {
        let error = resolve(requested, Some(root), &[]).unwrap_err();
        assert!(
            error.contains(BLOCKED_SECRET),
            "expected {BLOCKED_SECRET} for {requested}: {error}"
        );
        assert!(error.contains(requested), "{error}");
    }

    #[test]
    fn env_file_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), ".env");
        assert_blocked(&root, ".env");
        assert!(is_secret(&PathBuf::from(&root).join(".env")));
    }

    #[test]
    fn env_local_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), ".env.local");
        assert_blocked(&root, ".env.local");
        assert!(is_secret(&PathBuf::from(&root).join(".env.local")));
    }

    #[test]
    fn nested_git_config_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), "nested/.git/config");
        assert_blocked(&root, "nested/.git/config");
        assert!(is_secret(
            &PathBuf::from(&root)
                .join("nested")
                .join(".git")
                .join("config")
        ));
    }

    #[test]
    fn pem_file_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), "key.pem");
        assert_blocked(&root, "key.pem");
        assert!(is_secret(&PathBuf::from(&root).join("key.pem")));
    }

    #[test]
    fn id_prefix_file_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), "id_rsa");
        assert_blocked(&root, "id_rsa");
        assert!(is_secret(&PathBuf::from(&root).join("id_rsa")));
    }

    #[test]
    fn secret_match_is_case_insensitive() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, ".ENV.LOCAL");
        plant(root_path, "KEY.PEM");
        plant(root_path, "ID_ED25519");
        plant(root_path, "nested/.GIT/config");
        assert_blocked(&root, ".ENV.LOCAL");
        assert_blocked(&root, "KEY.PEM");
        assert_blocked(&root, "ID_ED25519");
        assert_blocked(&root, "nested/.GIT/config");
    }

    #[cfg(unix)]
    #[test]
    fn symlink_to_env_local_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), ".env.local");
        std::os::unix::fs::symlink(
            Path::new(&root).join(".env.local"),
            Path::new(&root).join("notes.md"),
        )
        .unwrap();
        assert_blocked(&root, "notes.md");
        assert!(is_secret(&PathBuf::from(&root).join("notes.md")));
    }

    #[test]
    fn ordinary_names_are_not_blocked() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, "env.md");
        plant(root_path, "identity.md");
        plant(root_path, "pem.txt");
        plant(root_path, "gitconfig.md");
        resolve("env.md", Some(&root), &[]).unwrap();
        resolve("identity.md", Some(&root), &[]).unwrap();
        resolve("pem.txt", Some(&root), &[]).unwrap();
        resolve("gitconfig.md", Some(&root), &[]).unwrap();
        assert!(!is_secret(&root_path.join("env.md")));
        assert!(!is_secret(&root_path.join("identity.md")));
    }
}
