const TRANSPORT_HELPER_MARKER: &str = "::";

/// Reject git URLs that git would parse as an option or run as a transport helper.
pub(crate) fn validate_remote_url(url: &str) -> Result<(), String> {
    if url.starts_with('-') {
        return Err("Repository URL cannot start with '-'.".to_string());
    }

    if url.chars().any(char::is_control) {
        return Err("Repository URL contains control characters.".to_string());
    }

    // "ext::sh -c ..." runs a command; "ssh://[::1]/x" is a valid IPv6 host.
    if let Some((helper, _)) = url.split_once(TRANSPORT_HELPER_MARKER) {
        let is_helper_name = !helper.is_empty()
            && helper
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '-' || c == '.');
        if is_helper_name {
            return Err("Repository URL uses an unsupported transport.".to_string());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_option_like_urls() {
        assert!(validate_remote_url("--upload-pack=touch /tmp/x").is_err());
        assert!(validate_remote_url("-oProxyCommand=x").is_err());
    }

    #[test]
    fn rejects_transport_helpers() {
        assert!(validate_remote_url("ext::sh -c 'touch /tmp/x'").is_err());
        assert!(validate_remote_url("fd::17/foo").is_err());
        assert!(validate_remote_url("remote-foo.bar::evil").is_err());
    }

    #[test]
    fn accepts_https_hostnames_with_dots_while_transport_helpers_still_fail() {
        assert!(validate_remote_url("https://remote-foo.bar/repo.git").is_ok());
        assert!(validate_remote_url("ext::sh -c 'touch /tmp/x'").is_err());
        assert!(validate_remote_url("-https://example.com/repo.git").is_err());
    }

    #[test]
    fn rejects_control_characters() {
        assert!(validate_remote_url("https://a.test/r\n--x").is_err());
    }

    #[test]
    fn accepts_regular_urls() {
        for url in [
            "https://github.com/o/r.git",
            "http://example.com/r.git",
            "ssh://git@host/o/r.git",
            "ssh://git@[::1]/o/r.git",
            "git://host/r.git",
            "git@github.com:o/r.git",
            "/tmp/local/repo",
            "C:/repos/vault",
        ] {
            assert!(validate_remote_url(url).is_ok(), "{url}");
        }
    }
}
