use crate::ai_agents::AiAgentAvailability;
use std::path::{Path, PathBuf};

pub(crate) fn check_cli() -> AiAgentAvailability {
    crate::cli_agent_runtime::check_cli_availability(find_binary)
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
