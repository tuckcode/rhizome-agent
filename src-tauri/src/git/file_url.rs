use std::path::Path;

use crate::vault::path_identity::vault_relative_path_string;

use super::command::{git_output, stderr_or_failure, stdout_text};
use super::remote_config::primary_remote_url;

enum RemoteWebKind {
    Bitbucket,
    Gitea,
    GitLab,
    Generic,
}

struct RemoteWebBase {
    base_url: String,
    kind: RemoteWebKind,
}

struct GitFileLocation {
    branch: BranchName,
    relative_path: RelativeGitPath,
}

struct BranchName(String);

struct RelativeGitPath(String);

struct RemoteUrl(String);

struct RemoteParts {
    host: RemoteHost,
    repo_path: RepoPath,
}

struct RemoteHost(String);

struct RepoPath(String);

pub fn git_file_url(vault_path: &str, file_path: &str) -> Result<Option<String>, String> {
    let vault = Path::new(vault_path);
    let file = Path::new(file_path);
    let Some(relative_path) = RelativeGitPath::from_paths(vault, file)? else {
        return Ok(None);
    };

    let Some(remote_url) = primary_remote_url(vault)?.map(RemoteUrl::new) else {
        return Ok(None);
    };
    let location = GitFileLocation::new(current_ref_name(vault)?, relative_path);

    let url = match remote_web_base(&remote_url) {
        Some(remote) => remote.file_url(&location),
        None => remote_url.git_fragment_url(&location),
    };
    Ok(Some(url))
}

fn current_ref_name(vault: &Path) -> Result<BranchName, String> {
    let output = git_output(vault, &["branch", "--show-current"])
        .map_err(|e| format!("Failed to get branch: {e}"))?;

    if !output.status.success() {
        return Err(stderr_or_failure("git branch", &output));
    }

    let branch = stdout_text(&output);
    Ok(BranchName::new(branch))
}

impl GitFileLocation {
    fn new(branch: BranchName, relative_path: RelativeGitPath) -> Self {
        Self {
            branch,
            relative_path,
        }
    }
}

impl BranchName {
    fn new(value: String) -> Self {
        if value.is_empty() {
            return Self("HEAD".to_string());
        }
        Self(value)
    }

    fn encoded_fragment(&self) -> String {
        encode_fragment_part(&self.0)
    }

    fn encoded_path(&self) -> String {
        encode_path(&self.0)
    }
}

impl RelativeGitPath {
    fn from_paths(vault: &Path, file: &Path) -> Result<Option<Self>, String> {
        let value = vault_relative_path_string(vault, file)?;
        if value.is_empty() {
            return Ok(None);
        }
        Ok(Some(Self(value)))
    }

    fn encoded_fragment(&self) -> String {
        encode_fragment_part(&self.0)
    }

    fn encoded_path(&self) -> String {
        encode_path(&self.0)
    }
}

impl RemoteWebBase {
    fn file_url(&self, location: &GitFileLocation) -> String {
        let branch = location.branch.encoded_path();
        let path = location.relative_path.encoded_path();
        match self.kind {
            RemoteWebKind::Bitbucket => format!("{}/src/{}/{}", self.base_url, branch, path),
            RemoteWebKind::Gitea => format!("{}/src/branch/{}/{}", self.base_url, branch, path),
            RemoteWebKind::GitLab => format!("{}/-/blob/{}/{}", self.base_url, branch, path),
            RemoteWebKind::Generic => format!("{}/blob/{}/{}", self.base_url, branch, path),
        }
    }
}

impl RemoteUrl {
    fn new(value: String) -> Self {
        Self(value)
    }

    fn trimmed(&self) -> &str {
        self.0.trim()
    }

    fn git_fragment_url(&self, location: &GitFileLocation) -> String {
        format!(
            "{}#{}:{}",
            self.trimmed(),
            location.branch.encoded_fragment(),
            location.relative_path.encoded_fragment(),
        )
    }

    fn host_and_path(&self) -> Option<RemoteParts> {
        self.http_parts()
            .or_else(|| self.scheme_parts())
            .or_else(|| self.scp_parts())
    }

    fn http_parts(&self) -> Option<RemoteParts> {
        let rest = self
            .trimmed()
            .strip_prefix("https://")
            .or_else(|| self.trimmed().strip_prefix("http://"))?;
        RemoteParts::from_authority_path(rest)
    }

    fn scheme_parts(&self) -> Option<RemoteParts> {
        let rest = self
            .trimmed()
            .strip_prefix("ssh://")
            .or_else(|| self.trimmed().strip_prefix("git://"))?;
        RemoteParts::from_authority_path(rest)
    }

    fn scp_parts(&self) -> Option<RemoteParts> {
        let (_, target) = self.trimmed().split_once('@')?;
        let (host, path) = target.split_once(':')?;
        Some(RemoteParts::new(RemoteHost::new(host), RepoPath::new(path)))
    }
}

impl RemoteParts {
    fn new(host: RemoteHost, repo_path: RepoPath) -> Self {
        Self { host, repo_path }
    }

    fn from_authority_path(value: &str) -> Option<Self> {
        let (authority, path) = value.split_once('/')?;
        Some(Self::new(
            RemoteHost::from_authority(authority),
            RepoPath::new(path),
        ))
    }

    fn into_web_base(self) -> Option<RemoteWebBase> {
        let clean_path = self.repo_path.clean();
        if self.host.is_empty() {
            return None;
        }
        if clean_path.is_empty() {
            return None;
        }

        let base_url = format!("https://{}/{clean_path}", self.host.as_str());
        Some(RemoteWebBase {
            kind: remote_web_kind(&self.host),
            base_url,
        })
    }
}

impl RemoteHost {
    fn new(value: &str) -> Self {
        Self(value.to_string())
    }

    fn from_authority(authority: &str) -> Self {
        Self::new(authority.rsplit('@').next().unwrap_or_default())
    }

    fn as_str(&self) -> &str {
        &self.0
    }

    fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    fn lower(&self) -> String {
        self.0.to_ascii_lowercase()
    }
}

impl RepoPath {
    fn new(value: &str) -> Self {
        Self(value.to_string())
    }

    fn clean(&self) -> &str {
        let trimmed = self.0.trim_matches('/');
        trimmed.strip_suffix(".git").unwrap_or(trimmed)
    }
}

fn remote_web_base(remote_url: &RemoteUrl) -> Option<RemoteWebBase> {
    remote_url.host_and_path()?.into_web_base()
}

fn remote_web_kind(host: &RemoteHost) -> RemoteWebKind {
    let lower_host = host.lower();
    if lower_host.contains("gitlab") {
        return RemoteWebKind::GitLab;
    }
    if lower_host.contains("bitbucket") {
        return RemoteWebKind::Bitbucket;
    }
    if lower_host.contains("gitea") {
        return RemoteWebKind::Gitea;
    }
    if lower_host.contains("forgejo") {
        return RemoteWebKind::Gitea;
    }
    if lower_host == "codeberg.org" {
        return RemoteWebKind::Gitea;
    }
    RemoteWebKind::Generic
}

fn encode_path(path: &str) -> String {
    path.split('/')
        .map(encode_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn encode_fragment_part(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b' ' => encoded.push_str("%20"),
            b'#' => encoded.push_str("%23"),
            b'%' => encoded.push_str("%25"),
            _ => encoded.push(char::from(byte)),
        }
    }
    encoded
}

fn encode_segment(segment: &str) -> String {
    segment
        .bytes()
        .flat_map(|byte| {
            if is_unreserved_url_byte(byte) {
                vec![byte]
            } else {
                format!("%{byte:02X}").into_bytes()
            }
        })
        .map(char::from)
        .collect()
}

fn is_unreserved_url_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::git_command;
    use crate::git::tests::setup_git_repo;
    use std::fs;
    use std::path::Path;

    struct RemoteFixture {
        name: &'static str,
        url: &'static str,
    }

    struct GitUrlCase {
        remote: RemoteFixture,
        note_path: &'static str,
        expected_url: &'static str,
    }

    fn add_remote(vault: &Path, remote: RemoteFixture) {
        git_command()
            .args(["remote", "add", remote.name, remote.url])
            .current_dir(vault)
            .output()
            .unwrap();
    }

    fn write_note(vault: &Path, relative_path: &str) -> String {
        let file = vault.join(relative_path);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "# Note\n").unwrap();
        file.to_string_lossy().to_string()
    }

    fn assert_git_file_url(test_case: GitUrlCase) {
        let dir = setup_git_repo();
        let note = write_note(dir.path(), test_case.note_path);
        add_remote(dir.path(), test_case.remote);

        let url = git_file_url(dir.path().to_str().unwrap(), &note).unwrap();

        assert_eq!(url.as_deref(), Some(test_case.expected_url));
    }

    #[test]
    fn returns_none_without_remote() {
        let dir = setup_git_repo();
        let note = write_note(dir.path(), "note.md");

        let url = git_file_url(dir.path().to_str().unwrap(), &note).unwrap();

        assert_eq!(url, None);
    }

    #[test]
    fn returns_none_outside_git_repository() {
        let dir = tempfile::tempdir().unwrap();
        let note = write_note(dir.path(), "note.md");

        let url = git_file_url(dir.path().to_str().unwrap(), &note).unwrap();

        assert_eq!(url, None);
    }

    #[test]
    fn builds_remote_note_urls() {
        [
            GitUrlCase {
                remote: RemoteFixture {
                    name: "origin",
                    url: "git@github.com:owner/repo.git",
                },
                note_path: "Notes/Project Plan.md",
                expected_url: "https://github.com/owner/repo/blob/main/Notes/Project%20Plan.md",
            },
            GitUrlCase {
                remote: RemoteFixture {
                    name: "origin",
                    url: "https://gho_secret@github.com/owner/repo.git",
                },
                note_path: "private.md",
                expected_url: "https://github.com/owner/repo/blob/main/private.md",
            },
            GitUrlCase {
                remote: RemoteFixture {
                    name: "origin",
                    url: "https://gitlab.com/group/repo.git",
                },
                note_path: "notes/topic.md",
                expected_url: "https://gitlab.com/group/repo/-/blob/main/notes/topic.md",
            },
            GitUrlCase {
                remote: RemoteFixture {
                    name: "upstream",
                    url: "https://github.com/team/vault.git",
                },
                note_path: "shared.md",
                expected_url: "https://github.com/team/vault/blob/main/shared.md",
            },
        ]
        .into_iter()
        .for_each(assert_git_file_url);
    }
}
