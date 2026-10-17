//! Create or overwrite a text file inside the allowed roots.

use std::fs;
use std::path::{Path, PathBuf};

use super::args;
use super::atomic;
use super::preview;
use super::sandbox;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "write_file",
    "description": "Create or overwrite a text file inside the user's vault roots or current workspace. Paths are canonicalized; anything outside those roots is refused. Parent directories are created only inside those roots. Writes are atomic (temp file then rename). This tool asks for approval on every call unless the session already granted this path.",
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
    let plan = plan(raw_args, vault_path, vault_paths)?;
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
}

pub fn plan(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<WritePlan, String> {
    let args = args::parse_object(raw_args, "write_file")?;
    let requested = args::required_str(&args, "path", "write_file")?;
    let content = args::required_string(&args, "content", "write_file")?;
    let path = sandbox::resolve(requested, vault_path, vault_paths)?;
    if path.is_dir() {
        return Err(format!("Not a file: {requested}"));
    }
    let created = !path.is_file();
    let before = if created {
        String::new()
    } else {
        read_existing(&path)?
    };
    let roots = sandbox::allowed_roots(vault_path, vault_paths)?;
    Ok(WritePlan {
        display_path: sandbox::relative_to_root(&path, &roots),
        path,
        before,
        after: content.to_string(),
        created,
    })
}

pub fn preview_diff(
    raw_args: &str,
    vault_path: Option<&str>,
    vault_paths: &[String],
) -> Result<String, String> {
    let plan = plan(raw_args, vault_path, vault_paths)?;
    Ok(preview::unified(
        &plan.display_path,
        &plan.before,
        &plan.after,
    ))
}

fn read_existing(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("Failed to read file: {error}"))?;
    String::from_utf8(bytes).map_err(|_| {
        format!(
            "File is binary and cannot be overwritten as text: {}",
            path.display()
        )
    })
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
}
