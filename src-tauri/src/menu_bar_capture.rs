//! Menu-bar screen capture (GatherOS pattern ported to Tauri).
//!
//! Uses macOS `/usr/sbin/screencapture` for native area/window pickers.
//! PNG lands in `attachments/`; a markdown stub lands in `raw/inbox/` so
//! inbox automation / history can pick it up. Escape cancel = no files.

#[cfg(any(test, target_os = "macos"))]
use std::fs;
#[cfg(any(test, target_os = "macos"))]
use std::path::Path;
#[cfg(target_os = "macos")]
use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::process::Command;
#[cfg(target_os = "macos")]
use std::thread;
#[cfg(target_os = "macos")]
use std::time::Duration;

#[cfg(any(test, target_os = "macos"))]
use chrono::Local;

#[cfg(any(test, target_os = "macos"))]
use crate::rhizome_distill::append_vault_event_best_effort;
#[cfg(target_os = "macos")]
use crate::vault_list;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureKind {
    Area,
    Window,
    Fullscreen,
}

#[cfg(any(test, target_os = "macos"))]
impl CaptureKind {
    fn slug(self) -> &'static str {
        match self {
            CaptureKind::Area => "area",
            CaptureKind::Window => "window",
            CaptureKind::Fullscreen => "fullscreen",
        }
    }

    fn title(self) -> &'static str {
        match self {
            CaptureKind::Area => "Screen capture (area)",
            CaptureKind::Window => "Screen capture (window)",
            CaptureKind::Fullscreen => "Screen capture (fullscreen)",
        }
    }
}

/// Resolve the vault that tray capture should write into.
#[cfg(target_os = "macos")]
pub fn resolve_capture_vault_path() -> Result<PathBuf, String> {
    let list = vault_list::load_vault_list()?;
    let path = list
        .active_vault
        .or(list.default_workspace_path)
        .or_else(|| list.vaults.first().map(|v| v.path.clone()))
        .ok_or_else(|| {
            "No active vault — open Rhizome and select a vault before capturing.".to_string()
        })?;
    let path = PathBuf::from(path);
    if !path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", path.display()));
    }
    Ok(path)
}

/// Run a capture mode and save into the active vault. Cancel (Esc) is Ok(None).
pub fn capture_to_vault(kind: CaptureKind) -> Result<Option<CaptureResult>, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = kind;
        Err("Screen capture from the menu bar is macOS-only for now.".into())
    }

    #[cfg(target_os = "macos")]
    {
        let vault = resolve_capture_vault_path()?;
        let tmp = std::env::temp_dir().join(format!(
            "rhizome-capture-{}-{}.png",
            kind.slug(),
            Local::now().format("%Y%m%d%H%M%S%3f")
        ));
        run_screencapture(kind, &tmp)?;
        // Brief settle so the FS flushes (GatherOS does the same).
        thread::sleep(Duration::from_millis(80));
        if !tmp.exists() {
            return Ok(None); // user cancelled
        }
        let bytes = fs::read(&tmp).map_err(|e| format!("Failed to read capture: {e}"))?;
        let _ = fs::remove_file(&tmp);
        if bytes.is_empty() {
            return Ok(None);
        }
        let saved = write_capture_files(&vault, kind, &bytes)?;
        Ok(Some(saved))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaptureResult {
    pub note_relative: String,
    pub image_relative: String,
}

/// Pure write path — unit-tested without screencapture.
#[cfg(any(test, target_os = "macos"))]
pub fn write_capture_files(
    vault_path: &Path,
    kind: CaptureKind,
    png_bytes: &[u8],
) -> Result<CaptureResult, String> {
    let stamp = Local::now().format("%Y-%m-%d-%H%M%S");
    let base = format!("capture-{}-{}", kind.slug(), stamp);

    let attachments = vault_path.join("attachments");
    fs::create_dir_all(&attachments)
        .map_err(|e| format!("Failed to create attachments dir: {e}"))?;
    let image_name = format!("{base}.png");
    let image_abs = attachments.join(&image_name);
    fs::write(&image_abs, png_bytes).map_err(|e| format!("Failed to write PNG: {e}"))?;

    let inbox = vault_path.join("raw").join("inbox");
    fs::create_dir_all(&inbox).map_err(|e| format!("Failed to create raw/inbox: {e}"))?;
    let note_name = format!("{base}.md");
    let note_abs = inbox.join(&note_name);
    // Wiki-style attachment link from vault root.
    let body = format!(
        "---\ntitle: \"{}\"\nsource: menu_bar\ncapture: {}\n---\n\n![[attachments/{image_name}]]\n",
        kind.title(),
        kind.slug(),
    );
    fs::write(&note_abs, body).map_err(|e| format!("Failed to write capture note: {e}"))?;

    let note_relative = format!("raw/inbox/{note_name}");
    let image_relative = format!("attachments/{image_name}");

    append_vault_event_best_effort(
        vault_path,
        "capture",
        None,
        "menu_bar",
        note_relative.as_str(),
    );

    Ok(CaptureResult {
        note_relative,
        image_relative,
    })
}

#[cfg(target_os = "macos")]
fn run_screencapture(kind: CaptureKind, out: &Path) -> Result<(), String> {
    let out_str = out.to_string_lossy().to_string();
    // Flags mirror GatherOS:
    //   -i interactive, -s selection only, -w window, -x no sound, -t png
    let args: Vec<&str> = match kind {
        CaptureKind::Area => vec!["-i", "-s", "-x", "-t", "png", &out_str],
        CaptureKind::Window => vec!["-w", "-x", "-t", "png", &out_str],
        CaptureKind::Fullscreen => vec!["-x", "-t", "png", &out_str],
    };

    let status = Command::new("/usr/sbin/screencapture")
        .args(&args)
        .status()
        .map_err(|e| format!("Failed to spawn screencapture: {e}"))?;

    // Non-zero often means cancel; treat missing file as cancel upstream.
    if !status.success() && out.exists() {
        return Err(format!("screencapture exited with {status}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn write_capture_files_creates_png_note_and_paths() {
        let dir = TempDir::new().unwrap();
        let result = write_capture_files(dir.path(), CaptureKind::Area, b"fake-png-bytes").unwrap();
        assert!(result.note_relative.starts_with("raw/inbox/capture-area-"));
        assert!(result.note_relative.ends_with(".md"));
        assert!(result
            .image_relative
            .starts_with("attachments/capture-area-"));
        assert!(result.image_relative.ends_with(".png"));

        let note = dir.path().join(&result.note_relative);
        let img = dir.path().join(&result.image_relative);
        assert!(note.is_file());
        assert!(img.is_file());
        assert_eq!(fs::read(&img).unwrap(), b"fake-png-bytes");
        let md = fs::read_to_string(&note).unwrap();
        assert!(md.contains("source: menu_bar"));
        assert!(md.contains("![[attachments/"));
    }

    #[test]
    fn capture_kind_slugs_are_stable() {
        assert_eq!(CaptureKind::Area.slug(), "area");
        assert_eq!(CaptureKind::Window.slug(), "window");
        assert_eq!(CaptureKind::Fullscreen.slug(), "fullscreen");
    }
}
