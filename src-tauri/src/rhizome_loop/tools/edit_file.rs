//! Exact string replace inside a text file in the allowed roots.

use std::path::PathBuf;

use super::args;
use super::atomic;
use super::sandbox;
use super::text;

pub const MAX_BYTES: usize = text::MAX_BYTES;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "edit_file",
    "description": "Replace an exact string in a text file inside the user's vault roots or current workspace. Paths are canonicalized; anything outside those roots is refused. Secret files (.env*, .git/, *.pem, id_*) are refused. Files larger than 2097152 bytes are refused. Fails if old_string is missing or not unique unless replace_all is true. Line endings and file permissions are kept. Read-only files and hard links are refused. Writes are atomic. This tool asks for approval on every call unless the session already granted this path.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Relative path from the current workspace, or an absolute path inside a mounted vault root."
        },
        "old_string": {
          "type": "string",
          "description": "Exact text to find. Must match uniquely unless replace_all is true."
        },
        "new_string": {
          "type": "string",
          "description": "Replacement text. May be empty to delete old_string."
        },
        "replace_all": {
          "type": "boolean",
          "description": "Replace every match. Defaults to false."
        }
      },
      "required": ["path", "old_string", "new_string"],
      "additionalProperties": false
    }
  }
}"#;

pub fn run(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    run_with_cap(raw_args, vault_path, vault_paths, MAX_BYTES)
}

fn run_with_cap(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    max_bytes: usize,
) -> Result<String, String> {
    let plan = plan_with_cap(raw_args, vault_path, vault_paths, max_bytes)?;
    atomic::write_atomic(&plan.path, plan.after.as_bytes())?;
    let noun = if plan.replacements == 1 {
        "replacement"
    } else {
        "replacements"
    };
    Ok(format!(
        "Edited {} ({} {noun})",
        plan.display_path, plan.replacements
    ))
}

pub struct EditPlan {
    pub path: PathBuf,
    pub display_path: String,
    pub before: String,
    pub after: String,
    pub replacements: usize,
    pub content_hash: String,
}

pub fn plan(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<EditPlan, String> {
    plan_with_cap(raw_args, vault_path, vault_paths, MAX_BYTES)
}

fn plan_with_cap(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
    max_bytes: usize,
) -> Result<EditPlan, String> {
    let args = args::parse_object(raw_args, "edit_file")?;
    let requested = args::required_str(&args, "path", "edit_file")?;
    let old_string = args::required_string(&args, "old_string", "edit_file")?;
    let new_string = args::required_string(&args, "new_string", "edit_file")?;
    let replace_all = args::optional_bool(&args, "replace_all", "edit_file")?.unwrap_or(false);
    if old_string.is_empty() {
        return Err("edit_file old_string must not be empty.".into());
    }
    let old_lf = text::to_lf(old_string);
    let new_lf = text::to_lf(new_string);
    if old_lf == new_lf {
        return Err("old_string and new_string are the same; no change to make.".into());
    }
    let path = sandbox::resolve_file(requested, vault_path, vault_paths)?;
    atomic::preflight(&path)?;
    let before = text::read_text_limited(&path, max_bytes)?;
    let content_hash = text::hash_bytes(before.as_bytes());
    let crlf = text::uses_crlf(&before);
    let before_lf = text::to_lf(&before);
    let matches = count_matches(&before_lf, &old_lf);
    if matches == 0 {
        return Err(format!("old_string was not found in {requested}."));
    }
    if matches > 1 && !replace_all {
        return Err(format!(
            "old_string matched {matches} times in {requested}. Set replace_all to true to change every match."
        ));
    }
    let after_lf = if replace_all {
        before_lf.replace(&old_lf, &new_lf)
    } else {
        before_lf.replacen(&old_lf, &new_lf, 1)
    };
    let after = text::apply_eol(&after_lf, crlf);
    let roots = sandbox::allowed_roots(vault_path, vault_paths)?;
    Ok(EditPlan {
        display_path: sandbox::relative_to_root(&path, &roots),
        path,
        before,
        after,
        replacements: if replace_all { matches } else { 1 },
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

fn count_matches(haystack: &str, needle: &str) -> usize {
    if needle.is_empty() {
        return 0;
    }
    haystack.matches(needle).count()
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
    fn replaces_a_unique_string() {
        let (_dir, root) = vault();
        fs::write(Path::new(&root).join("note.md"), "alpha beta gamma\n").unwrap();
        let out = run(
            &json!({
                "path": "note.md",
                "old_string": "beta",
                "new_string": "DELTA"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("1 replacement"), "{out}");
        assert_eq!(
            fs::read_to_string(Path::new(&root).join("note.md")).unwrap(),
            "alpha DELTA gamma\n"
        );
    }

    #[test]
    fn missing_old_string_fails_without_writing() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "only this\n").unwrap();
        let error = run(
            &json!({
                "path": "note.md",
                "old_string": "missing",
                "new_string": "x"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains("not found"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "only this\n");
    }

    #[test]
    fn non_unique_match_fails_unless_replace_all() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "foo foo foo\n").unwrap();
        let error = run(
            &json!({
                "path": "note.md",
                "old_string": "foo",
                "new_string": "bar"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains("3 times"), "{error}");
        assert!(error.contains("replace_all"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "foo foo foo\n");
    }

    #[test]
    fn replace_all_changes_every_match() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "foo foo foo\n").unwrap();
        let out = run(
            &json!({
                "path": "note.md",
                "old_string": "foo",
                "new_string": "bar",
                "replace_all": true
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(out.contains("3 replacements"), "{out}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "bar bar bar\n");
    }

    #[test]
    fn keeps_crlf_line_endings() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "one\r\ntwo\r\n").unwrap();
        run(
            &json!({
                "path": "note.md",
                "old_string": "two",
                "new_string": "TWO"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert_eq!(fs::read(&dest).unwrap(), b"one\r\nTWO\r\n");
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
            &json!({
                "path": "../secret.md",
                "old_string": "keep",
                "new_string": "no"
            })
            .to_string(),
            Some(root.to_str().unwrap()),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::OUTSIDE_ROOTS), "{error}");
        assert_eq!(fs::read_to_string(&secret).unwrap(), "keep\n");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "alpha\n").unwrap();
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o640)).unwrap();
        run(
            &json!({
                "path": "note.md",
                "old_string": "alpha",
                "new_string": "beta"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        let mode = fs::metadata(&dest).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o640);
    }

    #[test]
    fn preview_does_not_write() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "alpha\n").unwrap();
        let diff = preview_diff(
            &json!({
                "path": "note.md",
                "old_string": "alpha",
                "new_string": "beta"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert!(diff.contains("-alpha"), "{diff}");
        assert!(diff.contains("+beta"), "{diff}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "alpha\n");
    }

    #[test]
    fn secret_paths_are_refused_without_writing() {
        let (_dir, root) = vault();
        let root_path = Path::new(&root);
        fs::write(root_path.join(".env"), "SECRET=keep\n").unwrap();
        fs::write(root_path.join("key.pem"), "keep\n").unwrap();
        fs::write(root_path.join("id_rsa"), "keep\n").unwrap();
        fs::create_dir_all(root_path.join("nested").join(".git")).unwrap();
        fs::write(
            root_path.join("nested").join(".git").join("config"),
            "keep\n",
        )
        .unwrap();
        for requested in [".env", "key.pem", "id_rsa", "nested/.git/config"] {
            let error = run(
                &json!({
                    "path": requested,
                    "old_string": "keep",
                    "new_string": "no"
                })
                .to_string(),
                Some(&root),
                &[],
            )
            .unwrap_err();
            assert!(
                error.contains(sandbox::BLOCKED_SECRET),
                "{requested}: {error}"
            );
        }
        assert_eq!(
            fs::read_to_string(root_path.join(".env")).unwrap(),
            "SECRET=keep\n"
        );
        assert_eq!(
            fs::read_to_string(root_path.join("key.pem")).unwrap(),
            "keep\n"
        );
        assert_eq!(
            fs::read_to_string(root_path.join("id_rsa")).unwrap(),
            "keep\n"
        );
        assert_eq!(
            fs::read_to_string(root_path.join("nested").join(".git").join("config")).unwrap(),
            "keep\n"
        );
    }

    #[cfg(unix)]
    #[test]
    fn symlink_to_a_secret_file_is_refused() {
        let (_dir, root) = vault();
        let env = Path::new(&root).join(".env.local");
        fs::write(&env, "SECRET=keep\n").unwrap();
        std::os::unix::fs::symlink(&env, Path::new(&root).join("notes.md")).unwrap();
        let error = run(
            &json!({
                "path": "notes.md",
                "old_string": "keep",
                "new_string": "no"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap_err();
        assert!(error.contains(sandbox::BLOCKED_SECRET), "{error}");
        assert_eq!(fs::read_to_string(&env).unwrap(), "SECRET=keep\n");
    }

    #[test]
    fn file_over_the_byte_cap_is_refused_without_writing() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        let body = "abcdefghijUNIQUE";
        fs::write(&dest, body).unwrap();
        let error = run_with_cap(
            &json!({
                "path": "note.md",
                "old_string": "UNIQUE",
                "new_string": "CHANGED"
            })
            .to_string(),
            Some(&root),
            &[],
            8,
        )
        .unwrap_err();
        assert!(error.contains("too large"), "{error}");
        assert!(error.contains("limit is 8"), "{error}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), body);
    }

    #[test]
    fn file_at_the_byte_cap_can_be_edited() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "abcdefgh").unwrap();
        let out = run_with_cap(
            &json!({
                "path": "note.md",
                "old_string": "abcdefgh",
                "new_string": "ABCDEFGH"
            })
            .to_string(),
            Some(&root),
            &[],
            8,
        )
        .unwrap();
        assert!(out.contains("1 replacement"), "{out}");
        assert_eq!(fs::read_to_string(&dest).unwrap(), "ABCDEFGH");
    }

    #[test]
    fn multiline_lf_old_string_matches_a_crlf_file() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("note.md");
        fs::write(&dest, "one\r\ntwo\r\nthree\r\n").unwrap();
        run(
            &json!({
                "path": "note.md",
                "old_string": "one\ntwo",
                "new_string": "ONE\nTWO"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert_eq!(fs::read(&dest).unwrap(), b"ONE\r\nTWO\r\nthree\r\n");
    }

    #[cfg(unix)]
    #[test]
    fn preview_path_is_the_symlink_target() {
        let (_dir, root) = vault();
        let dest = Path::new(&root).join("real.md");
        fs::write(&dest, "old\n").unwrap();
        std::os::unix::fs::symlink(&dest, Path::new(&root).join("link.md")).unwrap();
        let plan = plan(
            &json!({
                "path": "link.md",
                "old_string": "old",
                "new_string": "new"
            })
            .to_string(),
            Some(&root),
            &[],
        )
        .unwrap();
        assert_eq!(plan.display_path, "real.md");
        assert_eq!(plan.path, dest);
    }
}
