mod ai;
mod app_icon;
mod clipboard;
mod delete;
mod folders;
mod free_tier;
mod git;
pub mod git_clone;
mod git_connect;
mod memory;
mod native_chat;
mod pdf_export;
mod runtime;
mod session_import;
mod sheet;
mod system;
mod vault;
mod version;

use std::borrow::Cow;
use std::path::Path;

pub use ai::*;
pub use app_icon::*;
pub use clipboard::*;
pub use delete::*;
pub use folders::*;
pub use free_tier::*;
pub use git::*;
pub use git_connect::*;
pub use memory::*;
pub use native_chat::*;
pub use pdf_export::*;
pub use runtime::*;
pub use session_import::*;
pub use sheet::*;
pub use system::*;
pub use vault::*;
pub use version::*;

/// Expand a leading `~` or `~/` in a path string to the user's home directory.
/// Returns the original string unchanged if it doesn't start with `~` or if the
/// home directory cannot be determined.
pub fn expand_tilde(path: &str) -> Cow<'_, str> {
    let Some(home) = dirs::home_dir() else {
        return Cow::Borrowed(path);
    };

    match path {
        "~" => Cow::Owned(home.to_string_lossy().into_owned()),
        _ => path
            .strip_prefix("~/")
            .map(|rest| Cow::Owned(home.join(rest).to_string_lossy().into_owned()))
            .unwrap_or(Cow::Borrowed(path)),
    }
}

/// `$HOME` is never a vault. Treating it as one writes into Prime's global
/// `~/.prime/agent/settings.json` and scopes MCP tools to the whole home
/// directory (#46).
pub(crate) fn is_home_directory(path: &Path) -> bool {
    let Some(home) = dirs::home_dir() else {
        return false;
    };
    let home = home.canonicalize().unwrap_or(home);
    let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    home == path
}

fn is_numeric_version_part(part: &str) -> bool {
    !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit())
}

fn is_legacy_build_version(minor: &str, patch: &str) -> bool {
    minor.len() >= 6 && is_numeric_version_part(minor) && is_numeric_version_part(patch)
}

fn parse_legacy_build_label(version: &str) -> Option<String> {
    let parts: Vec<&str> = version.split('.').collect();
    match parts.as_slice() {
        [_, minor, patch] if is_legacy_build_version(minor, patch) => Some(format!("b{}", patch)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_tilde_with_subpath() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~/Documents/vault");
        // Compare as paths: the separator is the platform's (Windows uses `\`).
        assert_eq!(
            Path::new(result.as_ref()),
            home.join("Documents").join("vault")
        );
    }

    #[test]
    fn expand_tilde_alone() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~");
        assert_eq!(result, home.to_string_lossy());
    }

    #[test]
    fn expand_tilde_noop_for_absolute_path() {
        let result = expand_tilde("/usr/local/bin");
        assert_eq!(result, "/usr/local/bin");
    }

    #[test]
    fn the_home_directory_is_detected_and_a_subdir_is_not() {
        let home = dirs::home_dir().unwrap();
        assert!(is_home_directory(&home));
        assert!(!is_home_directory(&home.join("Documents")));
    }

    #[test]
    fn expand_tilde_noop_for_relative_path() {
        let result = expand_tilde("some/relative/path");
        assert_eq!(result, "some/relative/path");
    }

    #[test]
    fn expand_tilde_noop_for_tilde_in_middle() {
        let result = expand_tilde("/home/~user/path");
        assert_eq!(result, "/home/~user/path");
    }
}
