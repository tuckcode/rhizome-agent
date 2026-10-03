use crate::ai_agents::AiAgentAvailability;
use std::path::{Path, PathBuf};

pub(crate) fn check_cli() -> AiAgentAvailability {
    match find_binary() {
        Ok(binary) => AiAgentAvailability {
            installed: true,
            version: installed_version_for(&binary),
        },
        Err(_) => AiAgentAvailability {
            installed: false,
            version: None,
        },
    }
}

/// Read the version out of the npm package the CLI lives in.
///
/// `prime-agent` on this machine is a **symlink** into
/// `lib/node_modules/prime-agent/dist/bundle/cli.js`, so the package manifest
/// sits three directories above the resolved target. Reading it is exact and
/// costs a file read, where the `--version` probe costs a Node process — and
/// that probe comes back empty in the bundled app while working from a shell,
/// which is what left Settings reporting "installed / No version detected"
/// for a 0.8.0 install.
///
/// Kept as a fallback rather than a replacement: a future install layout that
/// is a real binary would have no `package.json`, and `--version` is the
/// answer there.
pub(crate) fn installed_version_for(binary: &Path) -> Option<String> {
    version_from_package(binary).or_else(|| crate::cli_agent_runtime::version_for_binary(binary))
}

fn version_from_package(binary: &Path) -> Option<String> {
    let resolved = std::fs::canonicalize(binary).ok()?;
    let manifest = resolved
        .ancestors()
        .nth(3)
        .map(|package_root| package_root.join("package.json"))?;
    version_from_manifest(&std::fs::read_to_string(manifest).ok()?)
}

fn version_from_manifest(raw: &str) -> Option<String> {
    let parsed = serde_json::from_str::<serde_json::Value>(raw).ok()?;
    let version = parsed["version"].as_str()?.trim();
    (!version.is_empty()).then(|| version.to_string())
}

pub(crate) fn find_binary() -> Result<PathBuf, String> {
    crate::cli_agent_runtime::find_cli_binary(
        "prime-agent",
        prime_binary_candidates(),
        "Prime Agent",
        "https://www.npmjs.com/package/prime-agent (npm i -g prime-agent)",
    )
}

fn prime_binary_candidates() -> Vec<PathBuf> {
    dirs::home_dir()
        .map(|home| prime_binary_candidates_for_home(&home))
        .unwrap_or_default()
}

fn prime_binary_candidates_for_home(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".local/bin/prime-agent"),
        home.join(".local/bin/prime-agent.exe"),
        home.join(".npm-global/bin/prime-agent"),
        home.join(".npm-global/bin/prime-agent.exe"),
        home.join("AppData/Roaming/npm/prime-agent.cmd"),
        home.join("AppData/Roaming/npm/prime-agent"),
        home.join(".local/share/mise/shims/prime-agent"),
        home.join(".asdf/shims/prime-agent"),
        home.join(".linuxbrew/bin/prime-agent"),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin/prime-agent"),
        PathBuf::from("/usr/local/bin/prime-agent"),
        PathBuf::from("/opt/homebrew/bin/prime-agent"),
    ]
}

#[cfg(test)]
mod tests {
    /// Settings reported "installed / No version detected" for a 0.8.0
    /// install. `prime-agent` is a symlink into the npm package, so the
    /// manifest is the exact answer and a file read rather than a Node
    /// process.
    #[test]
    fn installed_version_reads_the_package_manifest_without_running_it() {
        let root = std::env::temp_dir().join(format!(
            "rhizome-prime-version-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        let binary = root.join("dist").join("bundle").join("cli.js");
        std::fs::create_dir_all(binary.parent().expect("parent")).expect("dir");
        std::fs::write(&binary, "not an executable\n").expect("binary");
        std::fs::write(
            root.join("package.json"),
            r#"{"name":"prime-agent","version":"9.9.9"}"#,
        )
        .expect("manifest");

        let version = super::installed_version_for(&binary);
        let _ = std::fs::remove_dir_all(&root);

        assert_eq!(version.as_deref(), Some("9.9.9"));
    }

    #[test]
    fn a_version_is_read_out_of_the_package_manifest() {
        assert_eq!(
            version_from_manifest(r#"{"name":"prime-agent","version":"0.8.0"}"#),
            Some("0.8.0".to_string())
        );
    }

    /// Never a blank or bogus version: "installed, version unknown" is a
    /// truthful thing to show, and an empty string rendered as a version is
    /// not.
    #[test]
    fn a_manifest_without_a_usable_version_reports_nothing() {
        assert_eq!(version_from_manifest("not json"), None);
        assert_eq!(version_from_manifest(r#"{"name":"prime-agent"}"#), None);
        assert_eq!(version_from_manifest(r#"{"version":"   "}"#), None);
        assert_eq!(version_from_manifest(r#"{"version":42}"#), None);
    }

    use super::*;

    #[test]
    fn binary_candidates_include_supported_installs() {
        let home = PathBuf::from("/Users/alex");
        let candidates = prime_binary_candidates_for_home(&home);
        let expected = [
            home.join(".local/bin/prime-agent"),
            home.join(".npm-global/bin/prime-agent"),
            home.join(".local/share/mise/shims/prime-agent"),
            PathBuf::from("/opt/homebrew/bin/prime-agent"),
        ];

        for candidate in expected {
            assert!(
                candidates.contains(&candidate),
                "missing {}",
                candidate.display()
            );
        }
    }
}
