//! PKCE S256, plus the random `state` and `nonce` for one sign-in attempt.
//!
//! OpenAI's registration guide: a fresh verifier, S256 challenge, state, and
//! nonce on every attempt. The challenge is the base64url SHA-256 of the
//! verifier, without padding.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use sha2::{Digest, Sha256};

pub(crate) struct Pkce {
    pub verifier: String,
    pub challenge: String,
    pub state: String,
    pub nonce: String,
}

pub(crate) fn generate() -> Pkce {
    let verifier = random_token(64);
    Pkce {
        challenge: s256(&verifier),
        state: random_token(32),
        nonce: random_token(32),
        verifier,
    }
}

pub(crate) fn s256(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// Same secret, without stopping at the first differing byte.
pub(crate) fn same_secret(left: &str, right: &str) -> bool {
    let (left, right) = (left.as_bytes(), right.as_bytes());
    if left.len() != right.len() {
        return false;
    }
    let mut diff = 0u8;
    for (left, right) in left.iter().zip(right) {
        diff |= left ^ right;
    }
    diff == 0
}

fn random_token(bytes: usize) -> String {
    let mut raw = Vec::with_capacity(bytes);
    while raw.len() < bytes {
        raw.extend_from_slice(uuid::Uuid::new_v4().as_bytes());
    }
    raw.truncate(bytes);
    URL_SAFE_NO_PAD.encode(raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_is_s256_and_each_attempt_is_fresh() {
        let first = generate();
        let second = generate();
        assert_eq!(first.challenge, s256(&first.verifier));
        assert_ne!(first.verifier, second.verifier);
        assert_ne!(first.state, second.state);
        assert_ne!(first.nonce, second.nonce);
        assert!(first.verifier.len() >= 43 && first.verifier.len() <= 128);
        assert!(!first.challenge.contains('='));
        assert!(!first.verifier.contains('+') && !first.verifier.contains('/'));
    }

    #[test]
    fn same_secret_rejects_a_different_length() {
        assert!(same_secret("abc", "abc"));
        assert!(!same_secret("abc", "abd"));
        assert!(!same_secret("abc", "ab"));
    }
}
