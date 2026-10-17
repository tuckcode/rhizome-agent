//! Create or overwrite a text file inside the allowed roots.

use std::path::PathBuf;

use super::args;
use super::atomic;
use super::sandbox;
use super::text;

pub const MAX_BYTES: usize = text::MAX_BYTES;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "write_file",
    "description": "Create or overwrite a text file inside the user's vault roots or current workspace. Paths are canonicalized; anything outside those roots is refused. Secret files (.env*, .git/, *.pem, id_*) are refused. Content and existing files larger than 2097152 bytes are refused. Read-only files and hard links are refused. Parent directories are created only inside those roots. Writes are atomic (temp file then rename). This tool asks for approval on every call unless the session already granted this path.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Relative path from the current workspace, or an absolute path inside a mounted vault root."
        },
        "content": {
          "type": "string",
          "description": "Full file contents to write. Existing files are replaced."
        }
      },
      "required": ["path", "content"],
      "additionalProperties": false
    }
  }
}"#;

pub fn run(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    run_stamped(raw_args, vault_path, vault_paths, None)
}

pub fn run_stamped(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    expected_hash: Option<&str>,
) -> Result<String, String> {
    run_with_cap(raw_args, vault_path, vault_paths, MAX_BYTES, expected_hash)
}

fn run_with_cap(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    max_bytes: usize,
    expected_hash: Option<&str>,
) -> Result<String, String> {
    let plan = plan_with_cap(raw_args, vault_path, vault_paths, max_bytes)?;
    if let Some(expected) = expected_hash {
        if plan.content_hash != expected {
            return Err(text::CHANGED_SINCE_APPROVAL.to_string());
        }
    }
    atomic::write_atomic(&plan.path, plan.after.as_bytes())?;
    Ok(if plan.created {
        format!("Created {}", plan.display_path)
    } else {
        format!("Wrote {}", plan.display_path)
    })
}

pub struct WritePlan {
    pub path: PathBuf,
    pub display_path: String,
    pub before: String,
    pub after: String,
    pub created: bool,
    pub content_hash: String,
}

pub fn plan(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<WritePlan, String> {
    plan_with_cap(raw_args, vault_path, vault_paths, MAX_BYTES)
}

fn plan_with_cap(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    max_bytes: usize,
) -> Result<WritePlan, String> {
    let args = args::parse_object(raw_args, "write_file")?;
    let requested = args::required_str(&args, "path", "write_file")?;
    let content = args::required_string(&args, "content", "write_file")?;
    if content.len() > max_bytes {
        return Err(format!(
            "Content is too large to write ({} bytes; limit is {max_bytes}).",
            content.len()
        ));
    }
    let path = sandbox::resolve(requested, vault_path, vault_paths)?;
    if path.is_dir() {
        return Err(format!("Not a file: {requested}"));
    }
    atomic::preflight(&path)?;
    let created = !path.is_file();
    let (before, content_hash) = if created {
        (String::new(), text::ABSENT_HASH.to_string())
    } else {
        let text_body = text::read_text_limited(&path, max_bytes)?;
        let content_hash = text::hash_bytes(text_body.as_bytes());
        (text_body, content_hash)
    };
    let roots = sandbox::allowed_roots(vault_path, vault_paths)?;
    Ok(WritePlan {
        display_path: sandbox::display_path(requested, &path, &roots),
        path,
        before,
        after: content.to_string(),
        created,
        content_hash,
    })
}

#[cfg(test)]
pub fn preview_diff(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    let plan = plan(raw_args, vault_path, vault_paths)?;
    Ok(super::preview::unified(
        &plan.display_path,
        &plan.before,
        &plan.after,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use std::path::Path;

    fn vault() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().canonicalize().unwrap();
        (dir, path.to_string_lossy().into_owned())
    }

    #[test]
    fn creates_a_new_file() {
        let (_dir, root) = vault();
        let out = run(
            &json!({ "path": "fresh.md", "content": "hello\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("Created"), "{out}");
        assert_eq!(
            fs::read_to_string(Path::new(&root).join("fresh.md")).unwrap(),
            "hello\n"
        );
    }

    #[test]
    fn overwrites_an_existing_file() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "old\n").unwrap();
        let out = run(
            &json!({ "path": "note.md", "content": "new\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("Wrote"), "{out}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "new\n");
    }

    #[test]
    fn creates_parent_directories_inside_the_root() {
        let (_dir, root) = vault();
        run(
            &json!({ "path": "nested/deep/note.md", "content": "ok\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(Path::new(&root).join("nested/deep/note.md")).unwrap(),
            "ok\n"
        );
    }

    #[test]
    fn parent_traversal_is_refused() {
        let parent = tempfile::tempdir().unwrap();
        let vault = parent.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let secret = parent.path().join("secret.md");
        fs::write(&secret, "keep\n").unwrap();
        let root = vault.canonicalize().unwrap();
        let error = run(
            &json!({ "path": "../secret.md", "content": "no\n" }).to_string(),
            Some(root.to_str().unwrap()),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::OUTSIDE_ROOTS), "{error}");
        assert_eq!(fs::read_to_string(&secret).unwrap(), "keep\n");
        assert!(!root.join("secret.md").exists());
    }

    #[cfg(unix)]
    #[test]
    fn symlink_pointing_outside_is_refused() {
        let (_dir, root) = vault();
        let outside = tempfile::tempdir().unwrap();
        let target = outside.path().join("escaped.md");
        fs::write(&target, "keep\n").unwrap();
        let link = Path::new(&root).join("out.link");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let error = run(
            &json!({ "path": "out.link", "content": "no\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::OUTSIDE_ROOTS), "{error}");
        assert_eq!(fs::read_to_string(&target).unwrap(), "keep\n");
    }

    #[test]
    fn new_file_preview_is_full_content() {
        let (_dir, root) = vault();
        let diff = preview_diff(
            &json!({ "path": "fresh.md", "content": "alpha\nbeta\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(diff.contains("--- /dev/null"), "{diff}");
        assert!(diff.contains("+alpha"), "{diff}");
        assert!(!Path::new(&root).join("fresh.md").exists());
    }

    #[test]
    fn secret_paths_are_refused_without_writing() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join(".env"), "SECRET=keep\n").unwrap();
        let existing = run(
            &json!({ "path": ".env", "content": "SECRET=no\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(existing.contains(sandbox::BLOCKED_SECRET), "{existing}");
        assert_eq!(
            fs::read_to_string(root_path.join(".env")).unwrap(),
            "SECRET=keep\n"
        );

        for requested in [".env.local", "key.pem", "id_ed25519", "nested/.git/config"] {
            let error = run(
                &json!({ "path": requested, "content": "no\n" }).to_string(),
                Some(&root),
                &[],
            )
            .unwrap_err();
            assert!(
                error.contains(sandbox::BLOCKED_SECRET),
                "{requested}: {error}"
            );
            assert!(
                !root_path.join(requested).exists(),
                "{requested} must not be created"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn symlink_to_a_secret_file_is_refused() {
        let (_dir, root) = vault();
        let env = Path::new(&root).join(".env.local");
        fs::write(&env, "SECRET=keep\n").unwrap();
        std::os::unix::fs::symlink(&env, Path::new(&root).join("notes.md")).unwrap();
        let error = run(
            &json!({ "path": "notes.md", "content": "no\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::BLOCKED_SECRET), "{error}");
        assert_eq!(fs::read_to_string(&env).unwrap(), "SECRET=keep\n");
    }

    #[test]
    fn existing_file_over_the_byte_cap_is_refused_without_writing() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "abcdefghij").unwrap();
        let error = run_with_cap(
            &json!({ "path": "note.md", "content": "x" }).to_string(),
            Some(&root),
            &[],
            8,
            None,
        )
        .unwrap_err();
        assert!(error.contains("too large"), "{error}");
        assert!(error.contains("limit is 8"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "abcdefghij");
    }

    #[test]
    fn content_over_the_byte_cap_is_refused_without_writing() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "keep\n").unwrap();
        let error = run_with_cap(
            &json!({ "path": "note.md", "content": "abcdefghij" }).to_string(),
            Some(&root),
            &[],
            8,
            None,
        )
        .unwrap_err();
        assert!(error.contains("Content is too large"), "{error}");
        assert!(error.contains("limit is 8"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
        assert!(!Path::new(&root).join("fresh.md").exists());
    }

    #[test]
    fn new_content_at_the_byte_cap_can_be_written() {
        let (_dir, root) = vault();
        let out = run_with_cap(
            &json!({ "path": "fresh.md", "content": "abcdefgh" }).to_string(),
            Some(&root),
            &[],
            8,
            None,
        )
        .unwrap();
        assert!(out.contains("Created"), "{out}");
        assert_eq!(
            fs::read_to_string(Path::new(&root).join("fresh.md")).unwrap(),
            "abcdefgh"
        );
    }

    #[cfg(unix)]
    #[test]
    fn preview_path_is_the_symlink_target() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("real.md");
        fs::write(&dest, "old\n").unwrap();
        std::os::unix::fs::symlink(&dest, Path::new(&root).join("link.md")).unwrap();
        let plan = plan(
            &json!({ "path": "link.md", "content": "new\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert_eq!(plan.display_path, "real.md via link.md");
        assert_eq!(plan.path, dest);
        assert!(!plan.created);
    }

    #[cfg(unix)]
    #[test]
    fn dangling_symlink_mid_path_is_a_clear_error() {
        let (_dir, root) = vault();
        let link = Path::new(&root).join("gone");
        std::os::unix::fs::symlink(Path::new(&root).join("missing-dir"), &link).unwrap();
        let error = run(
            &json!({ "path": "gone/note.md", "content": "no\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.to_lowercase().contains("dangling"), "{error}");
        assert!(!error.contains("os error 17"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn read_only_file_is_refused() {
        use std::os::unix::fs::PermissionsExt;

        let (_dir, root) = vault();
        let dest = Path::new(&root).join("locked.md");
        fs::write(&dest, "keep\n").unwrap();
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o444)).unwrap();
        let error = run(
            &json!({ "path": "locked.md", "content": "no\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        let _ = fs::set_permissions(&dest, fs::Permissions::from_mode(0o644));
        assert!(error.contains("read-only"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
    }

    #[cfg(unix)]
    #[test]
    fn hard_link_is_refused() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        let alias = Path::new(&root).join("alias.md");
        fs::write(&dest, "keep\n").unwrap();
        fs::hard_link(&dest, &alias).unwrap();
        let error = run(
            &json!({ "path": "note.md", "content": "no\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains("hard link"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
        assert_eq!(fs::read_to_string(&alias).unwrap(), "keep\n");
    }

    #[test]
    fn long_filename_can_be_overwritten() {
        let (_dir, root) = vault();
        let long = "n".repeat(240) + ".md";
        let dest = Path::new(&root).join(&long);
        fs::write(&dest, "old\n").unwrap();
        let out = run(
            &json!({ "path": long, "content": "new\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("Wrote"), "{out}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "new\n");
    }

    #[cfg(unix)]
    #[test]
    fn owner_0464_file_is_read_only() {
        use std::os::unix::fs::PermissionsExt;

        let (_dir, root) = vault();
        let dest = Path::new(&root).join("locked.md");
        fs::write(&dest, "keep\n").unwrap();
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o464)).unwrap();
        let error = run(
            &json!({ "path": "locked.md", "content": "no\n" }).to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        let _ = fs::set_permissions(&dest, fs::Permissions::from_mode(0o644));
        assert!(error.contains("read-only"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
    }

    #[test]
    fn stale_expected_hash_refuses_without_writing() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "keep\n").unwrap();
        let error = run_stamped(
            &json!({ "path": "note.md", "content": "no\n" }).to_string(),
            Some(&root),
            &[],
            Some("deadbeef"),
        )
        .unwrap_err();
        assert_eq!(error, text::CHANGED_SINCE_APPROVAL);
        assert_eq!(fs::read_to_string(&dest).unwrap(), "keep\n");
    }
}
