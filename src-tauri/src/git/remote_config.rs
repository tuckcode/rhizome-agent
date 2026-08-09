use std::path::Path;

use super::command::{git_output, stderr_or_failure, stdout_lines};

const DEFAULT_FETCH_REFSPEC: &str = "+refs/heads/*:refs/remotes/origin/*";
const REMOTE_URL_CONFIG_PATTERN: &str = r"^remote\..*\.url$";
const ORIGIN_URL_CONFIG_KEY: &str = "remote.origin.url";
const ORIGIN_FETCH_CONFIG_KEY: &str = "remote.origin.fetch";

#[derive(Debug, Clone, PartialEq, Eq)]
struct ConfiguredRemote {
    name: String,
    url: String,
}

pub(super) fn has_configured_remote(vault: &Path) -> Result<bool, String> {
    Ok(!list_configured_remotes(vault)?.is_empty())
}

pub(super) fn list_configured_remotes(vault: &Path) -> Result<Vec<String>, String> {
    Ok(list_configured_remote_urls(vault)?
        .into_iter()
        .map(|remote| remote.name)
        .collect())
}

pub(super) fn primary_remote_url(vault: &Path) -> Result<Option<String>, String> {
    let remotes = list_configured_remote_urls(vault)?;
    Ok(remotes
        .iter()
        .find(|remote| remote.name == "origin")
        .or_else(|| remotes.first())
        .map(|remote| remote.url.clone()))
}

fn list_configured_remote_urls(vault: &Path) -> Result<Vec<ConfiguredRemote>, String> {
    let output = git_output(
        vault,
        &["config", "--get-regexp", REMOTE_URL_CONFIG_PATTERN],
    )
    .map_err(|e| format!("Failed to inspect git remotes: {e}"))?;

    if output.status.code() == Some(1) {
        return Ok(Vec::new());
    }
    if !output.status.success() {
        return Err(stderr_or_failure("git config --get-regexp", &output));
    }

    Ok(stdout_lines(&output)
        .into_iter()
        .filter_map(|line| remote_from_url_config(&line))
        .collect())
}

fn remote_from_url_config(line: &str) -> Option<ConfiguredRemote> {
    let (key, value) = line.split_once(' ')?;
    let url = value.trim();
    if url.is_empty() {
        return None;
    }
    let name = key
        .strip_prefix("remote.")
        .and_then(|name| name.strip_suffix(".url"))
        .filter(|name| !name.is_empty())
        .map(ToString::to_string)?;

    Some(ConfiguredRemote {
        name,
        url: url.to_string(),
    })
}

pub(super) fn configure_origin_remote(vault: &Path, remote_url: &str) -> Result<(), String> {
    run_git_config(vault, ORIGIN_URL_CONFIG_KEY, remote_url)?;
    run_git_config(vault, ORIGIN_FETCH_CONFIG_KEY, DEFAULT_FETCH_REFSPEC)
}

fn run_git_config(vault: &Path, key: &str, value: &str) -> Result<(), String> {
    let output = git_output(vault, &["config", "--local", "--replace-all", key, value])
        .map_err(|e| format!("Failed to run git config: {e}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(stderr_or_failure("git config", &output))
}
