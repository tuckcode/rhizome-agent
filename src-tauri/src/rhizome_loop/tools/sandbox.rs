//! Canonical path lock for native file tools.
//!
//! A path must resolve inside the current workspace or another mounted
//! vault root. `..` and symlinks are followed first. Anything outside
//! those roots is refused with a message the model can read.
//!
//! Read tools use [`resolve_for_read`], which honours `block_secret_files`.
//! Write tools must use [`resolve_for_write`]: that path always applies
//! the secret denylist and always refuses any `.git` component, even
//! when the setting is off. Callers pick read or write at compile time.

use std::cell::Cell;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

pub const OUTSIDE_ROOTS: &str = "Path is outside the allowed vault and workspace roots.";
pub const NO_ROOTS: &str = "No active vault or workspace is available.";
pub const BLOCKED_SECRET: &str = "blocked: secret file";

const PRIVATE_KEY_NAMES: &[&str] = &[
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ecdsa_sk",
    "id_ed25519",
    "id_ed25519_sk",
    "id_mldsa44_ed25519",
];
const SECRET_EXTENSIONS: &[&str] = &[".pem", ".key", ".p12", ".pfx"];

thread_local! {
    static BLOCK_SECRETS_OVERRIDE: Cell<Option<bool>> = const { Cell::new(None) };
}

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
///
/// Honours `block_secret_files`. Write tools must not call this.
pub fn resolve_for_read(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    let roots = allowed_roots(vault_path, vault_paths)?;
    resolve_in_with(requested, &roots, false)
}

/// Resolve a path for a write tool.
///
/// Always applies the full secret denylist, including any `.git` path
/// component, even when `block_secret_files` is off. Read tools must
/// keep using [`resolve_for_read`]. `edit_file` and `write_file` call this.
pub fn resolve_for_write(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    let roots = allowed_roots(vault_path, vault_paths)?;
    resolve_in_with(requested, &roots, true)
}

fn resolve_in_with(
    requested: &str,
    roots: &Roots,
    always_block_secrets: bool,
) -> Result<PathBuf, String> {
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
    let blocked = if always_block_secrets {
        is_secret(&resolved)
    } else {
        is_blocked_secret(&resolved)
    };
    if blocked {
        return Err(format!("{BLOCKED_SECRET} Requested path: {trimmed}"));
    }
    Ok(resolved)
}

/// Whether native tools refuse secret paths. Default on.
///
/// A test can pin the value for one thread. Production reads the
/// persisted setting. Root sandboxing still applies when this is off.
pub fn block_secret_files() -> bool {
    if let Some(forced) = BLOCK_SECRETS_OVERRIDE.with(Cell::get) {
        return forced;
    }
    crate::settings::block_secret_files_enabled()
}

/// Pin the secret-file block for the current test thread.
#[cfg(test)]
pub fn override_secret_block(block: bool) -> SecretBlockGuard {
    BLOCK_SECRETS_OVERRIDE.with(|cell| cell.set(Some(block)));
    SecretBlockGuard
}

/// Restores the secret-file override when dropped.
#[cfg(test)]
pub struct SecretBlockGuard;

#[cfg(test)]
impl Drop for SecretBlockGuard {
    fn drop(&mut self) {
        BLOCK_SECRETS_OVERRIDE.with(|cell| cell.set(None));
    }
}

pub fn resolve_file(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    require_existing_file(
        resolve_for_read(requested, vault_path, vault_paths)?,
        requested,
    )
}

/// Existing file for a write tool. Always applies the denylist.
pub fn resolve_file_for_write(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    require_existing_file(
        resolve_for_write(requested, vault_path, vault_paths)?,
        requested,
    )
}

pub fn resolve_dir(
    requested: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<PathBuf, String> {
    let path = resolve_for_read(requested, vault_path, vault_paths)?;
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", requested.trim()));
    }
    Ok(path)
}

fn require_existing_file(path: PathBuf, requested: &str) -> Result<PathBuf, String> {
    if path.is_dir() {
        return Err(format!("Not a file: {}", requested.trim()));
    }
    if !path.is_file() {
        return Err(format!("File not found: {}", requested.trim()));
    }
    Ok(path)
}

pub fn is_within(candidate: &Path, root: &Path) -> bool {
    candidate.strip_prefix(root).is_ok()
}

/// Deny `.env*` (except `.env.example`), anything under `.git/`,
/// `*.pem` / `*.key` / `*.p12` / `*.pfx` (including backup suffixes),
/// and known private-key basenames plus backups. Basename match is
/// case-insensitive. Checked on the path as given and on its
/// canonical target so a symlink cannot hide a secret.
///
/// This is the denylist. Read callers that honour the user override
/// should use [`is_blocked_secret`]. Write callers use
/// [`resolve_for_write`], which always consults this list.
pub fn is_secret(path: &Path) -> bool {
    if looks_secret(path) {
        return true;
    }
    match path.canonicalize() {
        Ok(canonical) if canonical != path => looks_secret(&canonical),
        _ => false,
    }
}

/// Same denylist as [`is_secret`], after resolving a missing leaf through
/// an existing symlink. `create_note` uses this so `gitlink/note.md` cannot
/// land inside `.git` when `gitlink` points there.
pub fn write_target_is_secret(path: &Path) -> bool {
    if is_secret(path) {
        return true;
    }
    match canonicalize_path(path) {
        Ok(resolved) => looks_secret(&resolved),
        Err(_) => false,
    }
}

/// Denylist match, gated by the persisted secret-file setting.
pub fn is_blocked_secret(path: &Path) -> bool {
    is_blocked_secret_with(path, block_secret_files())
}

pub fn is_blocked_secret_with(path: &Path, block: bool) -> bool {
    block && is_secret(path)
}

fn looks_secret(path: &Path) -> bool {
    if path.components().any(component_is_git) {
        return true;
    }
    let Some(name) = path.file_name() else {
        return false;
    };
    let lower = name.to_string_lossy().to_ascii_lowercase();
    if lower == ".env.example" {
        return false;
    }
    lower.starts_with(".env") || has_secret_extension(&lower) || is_private_key_basename(&lower)
}

fn is_private_key_basename(lower: &str) -> bool {
    let stripped = lower.trim_start_matches(['.', '#']);
    if stripped.ends_with(".pub") {
        return false;
    }
    PRIVATE_KEY_NAMES
        .iter()
        .any(|key| stripped.starts_with(key))
}

fn has_secret_extension(lower: &str) -> bool {
    SECRET_EXTENSIONS.iter().any(|ext| {
        let mut rest = lower;
        while let Some(idx) = rest.find(ext) {
            if is_backup_suffix(&rest[idx + ext.len()..]) {
                return true;
            }
            rest = &rest[idx + 1..];
        }
        false
    })
}

fn is_backup_suffix(rest: &str) -> bool {
    if rest.is_empty() || rest == "~" {
        return true;
    }
    let rest = rest.strip_suffix('~').unwrap_or(rest);
    matches!(rest, ".bak" | ".old" | ".orig" | ".backup" | ".1" | ".swp")
}

fn component_is_git(component: std::path::Component<'_>) -> bool {
    let std::path::Component::Normal(name) = component else {
        return false;
    };
    let name = name.to_string_lossy();
    if name.eq_ignore_ascii_case(".git") {
        return true;
    }
    // Windows keeps the short 8.3 name and a trailing-dot alias for `.git`.
    #[cfg(windows)]
    {
        name.eq_ignore_ascii_case(".git.")
            || name.eq_ignore_ascii_case(".git..")
            || name.eq_ignore_ascii_case(".git ")
            || name.eq_ignore_ascii_case("GIT~1")
    }
    #[cfg(not(windows))]
    false
}

/// Canonical relative path, plus `via <requested>` when that path is a symlink.
pub fn display_path(requested: &str, canonical: &Path, roots: &Roots) -> String {
    let target = relative_to_root(canonical, roots);
    let trimmed = requested.trim();
    let raw = PathBuf::from(trimmed);
    let candidate = if raw.is_absolute() {
        raw
    } else {
        roots
            .current
            .clone()
            .or_else(|| roots.all.first().cloned())
            .map(|base| base.join(&raw))
            .unwrap_or(raw)
    };
    match fs::symlink_metadata(&candidate) {
        Ok(meta) if meta.file_type().is_symlink() => {
            format!("{target} via {}", trimmed.replace('\\', "/"))
        }
        _ => target,
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
        if let Ok(meta) = fs::symlink_metadata(&current) {
            if meta.file_type().is_symlink() && current.canonicalize().is_err() {
                return Err(format!(
                    "Dangling symlink in path: {}",
                    path.to_string_lossy()
                ));
            }
        }
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
        let resolved = resolve_for_read("inside.md", Some(&root), &[]).unwrap();
        assert_eq!(resolved, PathBuf::from(&root).join("inside.md"));
    }

    #[test]
    fn parent_traversal_is_refused() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        fs::write(parent.path().join("secret.md"), "no\n").unwrap();
        let root = vault.canonicalize().unwrap();
        let error =
            resolve_for_read("../secret.md", Some(root.to_str().unwrap()), &[]).unwrap_err();
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
        let error = resolve_for_read(file.to_str().unwrap(), Some(&root), &[]).unwrap_err();
        assert!(error.contains(OUTSIDE_ROOTS), "{error}");
    }

    #[test]
    fn absolute_path_in_another_mounted_vault_is_allowed() {
        let (_a, root_a) = vault();
        let b = tempfile::tempdir().unwrap();
        let root_b = b.path().canonicalize().unwrap();
        fs::write(root_b.join("other.md"), "two\n").unwrap();
        let requested = root_b.join("other.md");
        let resolved = resolve_for_read(
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
        let error = resolve_for_read("out.link", Some(&root), &[]).unwrap_err();
        assert!(
            error.contains(OUTSIDE_ROOTS),
            "symlink-out must refuse: {error}"
        );
    }

    #[test]
    fn missing_roots_return_a_clear_error() {
        let error = resolve_for_read("a.md", None, &[]).unwrap_err();
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
        let error = resolve_for_read(
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
        let error =
            resolve_for_read("../no-such.md", Some(root.to_str().unwrap()), &[]).unwrap_err();
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
        let error = resolve_for_read(requested, Some(root), &[]).unwrap_err();
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
    fn each_private_key_basename_is_blocked() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        for name in [
            "id_rsa",
            "id_dsa",
            "id_ecdsa",
            "id_ecdsa_sk",
            "id_ed25519",
            "id_ed25519_sk",
            "id_mldsa44_ed25519",
        ] {
            plant(root_path, name);
            assert_blocked(&root, name);
            assert!(is_secret(&root_path.join(name)));
        }
    }

    #[test]
    fn nested_private_key_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), "ssh/keys/id_ed25519");
        assert_blocked(&root, "ssh/keys/id_ed25519");
        assert!(is_secret(
            &PathBuf::from(&root)
                .join("ssh")
                .join("keys")
                .join("id_ed25519")
        ));
    }

    #[test]
    fn public_key_and_id_card_are_allowed() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, "id_rsa.pub");
        plant(root_path, "id_ed25519.pub");
        plant(root_path, "id_card.md");
        plant(root_path, "notes/id_rsa.pub");
        resolve_for_read("id_rsa.pub", Some(&root), &[]).unwrap();
        resolve_for_read("id_ed25519.pub", Some(&root), &[]).unwrap();
        resolve_for_read("id_card.md", Some(&root), &[]).unwrap();
        resolve_for_read("notes/id_rsa.pub", Some(&root), &[]).unwrap();
        assert!(!is_secret(&root_path.join("id_rsa.pub")));
        assert!(!is_secret(&root_path.join("id_ed25519.pub")));
        assert!(!is_secret(&root_path.join("id_card.md")));
    }

    #[test]
    fn key_p12_and_pfx_are_blocked() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, "server.key");
        plant(root_path, "client.p12");
        plant(root_path, "cert.pfx");
        plant(root_path, "nested/tls/app.key");
        assert_blocked(&root, "server.key");
        assert_blocked(&root, "client.p12");
        assert_blocked(&root, "cert.pfx");
        assert_blocked(&root, "nested/tls/app.key");
    }

    #[test]
    fn env_example_is_allowed_and_env_local_stays_blocked() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, ".env.example");
        plant(root_path, ".env.local");
        plant(root_path, "nested/.env.example");
        resolve_for_read(".env.example", Some(&root), &[]).unwrap();
        resolve_for_read("nested/.env.example", Some(&root), &[]).unwrap();
        assert!(!is_secret(&root_path.join(".env.example")));
        assert_blocked(&root, ".env.local");
        assert!(is_secret(&root_path.join(".env.local")));
        plant(root_path, ".env.example.local");
        assert_blocked(&root, ".env.example.local");
    }

    #[test]
    fn secret_match_is_case_insensitive() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, ".ENV.LOCAL");
        plant(root_path, "KEY.PEM");
        plant(root_path, "SERVER.KEY");
        plant(root_path, "CLIENT.P12");
        plant(root_path, "CERT.PFX");
        plant(root_path, "ID_ED25519");
        plant(root_path, "nested/.GIT/config");
        plant(root_path, ".ENV.EXAMPLE");
        plant(root_path, "ID_RSA.PUB");
        assert_blocked(&root, ".ENV.LOCAL");
        assert_blocked(&root, "KEY.PEM");
        assert_blocked(&root, "SERVER.KEY");
        assert_blocked(&root, "CLIENT.P12");
        assert_blocked(&root, "CERT.PFX");
        assert_blocked(&root, "ID_ED25519");
        assert_blocked(&root, "nested/.GIT/config");
        resolve_for_read(".ENV.EXAMPLE", Some(&root), &[]).unwrap();
        resolve_for_read("ID_RSA.PUB", Some(&root), &[]).unwrap();
    }

    #[test]
    fn override_off_allows_secret_names_inside_roots() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, "id_rsa");
        plant(root_path, ".env.local");
        plant(root_path, "server.key");
        let _guard = override_secret_block(false);
        resolve_for_read("id_rsa", Some(&root), &[]).unwrap();
        resolve_for_read(".env.local", Some(&root), &[]).unwrap();
        resolve_for_read("server.key", Some(&root), &[]).unwrap();
        assert!(is_secret(&root_path.join("id_rsa")));
        assert!(!is_blocked_secret(&root_path.join("id_rsa")));
    }

    #[test]
    fn override_off_still_refuses_paths_outside_roots() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        fs::write(parent.path().join("id_rsa"), "no\n").unwrap();
        let root = vault.canonicalize().unwrap();
        let _guard = override_secret_block(false);
        let error = resolve_for_read("../id_rsa", Some(root.to_str().unwrap()), &[]).unwrap_err();
        assert!(
            error.contains(OUTSIDE_ROOTS),
            "override must not weaken root sandboxing: {error}"
        );
        assert!(!error.contains(BLOCKED_SECRET), "{error}");
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
        plant(root_path, "id_card.md");
        resolve_for_read("env.md", Some(&root), &[]).unwrap();
        resolve_for_read("identity.md", Some(&root), &[]).unwrap();
        resolve_for_read("pem.txt", Some(&root), &[]).unwrap();
        resolve_for_read("gitconfig.md", Some(&root), &[]).unwrap();
        resolve_for_read("id_card.md", Some(&root), &[]).unwrap();
        assert!(!is_secret(&root_path.join("env.md")));
        assert!(!is_secret(&root_path.join("identity.md")));
        assert!(!is_secret(&root_path.join("id_card.md")));
    }

    #[test]
    fn key_backup_names_are_blocked() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        for name in [
            "id_rsa.bak",
            "id_rsa~",
            "id_rsa.old",
            "id_rsa.orig",
            "id_rsa.backup",
            "id_rsa.1",
            "id_rsa.swp",
            ".id_rsa.swp",
            "#id_rsa#",
            "id_ed25519 copy",
            "id_ed25519.ppk",
            "ID_RSA.BAK",
        ] {
            plant(root_path, name);
            assert_blocked(&root, name);
            assert!(is_secret(&root_path.join(name)), "{name}");
        }
        plant(root_path, "id_rsa-cert.pub");
        resolve_for_read("id_rsa-cert.pub", Some(&root), &[]).unwrap();
        assert!(!is_secret(&root_path.join("id_rsa-cert.pub")));
        assert!(!is_secret(&root_path.join("id_card.md")));
    }

    #[test]
    fn secret_extension_backups_are_blocked() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        for name in [
            "a.pem.bak",
            "a.key.old",
            "a.pem~",
            "a.key.swp",
            "a.p12.orig",
            "a.pfx.backup",
            "a.pem.1",
            "A.KEY.BAK",
        ] {
            plant(root_path, name);
            assert_blocked(&root, name);
            assert!(is_secret(&root_path.join(name)), "{name}");
        }
        plant(root_path, "notes.key.md");
        plant(root_path, "my.keyring");
        resolve_for_read("notes.key.md", Some(&root), &[]).unwrap();
        resolve_for_read("my.keyring", Some(&root), &[]).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn env_example_symlink_to_env_is_blocked() {
        let (_dir, root) = vault();
        plant(Path::new(&root), ".env");
        std::os::unix::fs::symlink(
            Path::new(&root).join(".env"),
            Path::new(&root).join(".env.example"),
        )
        .unwrap();
        assert_blocked(&root, ".env.example");
        assert!(is_secret(&PathBuf::from(&root).join(".env.example")));
    }

    #[test]
    fn resolve_for_write_refuses_secrets_when_the_setting_is_off() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        plant(root_path, ".git/hooks/pre-commit");
        plant(root_path, ".git/config");
        plant(root_path, ".env");
        plant(root_path, "id_rsa");
        let _guard = override_secret_block(false);
        resolve_for_read(".env", Some(&root), &[]).unwrap();
        resolve_for_read("id_rsa", Some(&root), &[]).unwrap();
        for requested in [".git/hooks/pre-commit", ".git/config", ".env", "id_rsa"] {
            let error = resolve_for_write(requested, Some(&root), &[]).unwrap_err();
            assert!(
                error.contains(BLOCKED_SECRET),
                "write must keep blocking {requested} with the setting off: {error}"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn dangling_symlink_mid_path_is_a_clear_error() {
        let (_dir, root) = vault();
        let link = PathBuf::from(&root).join("gone");
        std::os::unix::fs::symlink(PathBuf::from(&root).join("missing-dir"), &link).unwrap();
        let error = resolve_for_read("gone/note.md", Some(&root), &[]).unwrap_err();
        assert!(error.to_lowercase().contains("dangling"), "{error}");
        assert!(!error.contains("os error 17"), "{error}");
    }
}
