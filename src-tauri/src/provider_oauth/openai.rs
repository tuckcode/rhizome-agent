//! Sign in with ChatGPT, from OpenAI's published registration guide.
//!
//! `https://developers.openai.com/siwc/token-sharing-open-source/sign-in`
//! First sign-in uses `client_id=dynamic_agent_client`, `agent_name_hint=Rhizome`,
//! and this install's `ext_agent_host_id`. The callback's `oaiapp_` id is the
//! one we keep. The ID token is checked against the JWKS. Chat is usable only
//! when `chatgpt.tokens.use.direct` was granted.
//!
//! Nothing here is copied from a sample repository.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

use super::loopback::Loopback;
use super::pkce::{self, Pkce};
use super::{
    host_id, load_record, save_record, scrub, set_provider_enabled, unix_now, Env, OauthStatus,
    NOT_USABLE, SIGN_IN_AGAIN,
};

pub(super) const ISSUER: &str = "https://auth.openai.com";
pub(super) const DIRECT_SCOPE: &str = "chatgpt.tokens.use.direct";
const DYNAMIC_CLIENT: &str = "dynamic_agent_client";
const AGENT_NAME: &str = "Rhizome";
const RESOURCE: &str = "https://api.openai.com/v1";
const SCOPES: &str =
    "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const DISCOVERY: &str = "https://auth.openai.com/.well-known/openid-configuration";

#[derive(Clone)]
pub(crate) struct Endpoints {
    pub issuer: String,
    pub authorize: String,
    pub token: String,
    pub jwks: String,
    pub revoke: String,
    pub discover: bool,
}

impl Endpoints {
    pub(super) fn production() -> Self {
        Self {
            issuer: ISSUER.into(),
            authorize: "https://auth.openai.com/api/accounts/authorize".into(),
            token: "https://auth.openai.com/api/accounts/oauth/token".into(),
            jwks: "https://auth.openai.com/.well-known/jwks.json".into(),
            revoke: String::new(),
            discover: true,
        }
    }

    #[cfg(test)]
    pub(super) fn offline() -> Self {
        Self {
            issuer: ISSUER.into(),
            authorize: "http://127.0.0.1:9/authorize".into(),
            token: "http://127.0.0.1:9/token".into(),
            jwks: "http://127.0.0.1:9/jwks".into(),
            revoke: "http://127.0.0.1:9/revoke".into(),
            discover: false,
        }
    }
}

pub(super) enum RefreshFail {
    Again(Box<super::Record>),
    Temporary,
}

/// Tokens from a 2xx refresh body. Verification happens after this is saved.
pub(super) struct RefreshTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: String,
    pub expires_in: Option<i64>,
    pub scope: Option<String>,
}

pub(super) enum IdCheck {
    Match(Identity),
    Failed,
}

struct Attempt<'a> {
    env: &'a Env,
}

impl Drop for Attempt<'_> {
    fn drop(&mut self) {
        *self
            .env
            .attempt
            .lock()
            .unwrap_or_else(|poison| poison.into_inner()) = None;
    }
}

pub(super) fn sign_in(
    env: &Env,
    provider: &str,
    open_url: impl FnOnce(&str) -> bool,
    timeout: Duration,
) -> Result<OauthStatus, String> {
    let provider = normalize_openai(provider)?;
    let flag = begin_attempt(env)?;
    let _attempt = Attempt { env };
    let endpoints = resolve(env)?;
    let (host, previous) = {
        let _lock = super::lock_refresh(env)?;
        let host = host_id(env, &provider)?;
        let previous = load_record(env, &provider)?;
        (host, previous)
    };
    let client_id = previous
        .as_ref()
        .map(|record| record.client_id.as_str())
        .filter(|client_id| is_issued(client_id))
        .unwrap_or(DYNAMIC_CLIENT)
        .to_string();
    let pkce = pkce::generate();
    let loopback = Loopback::bind()?;
    let redirect = loopback.redirect_uri();
    let url = authorize_url(
        &endpoints,
        &pkce,
        &redirect,
        &client_id,
        &host,
        previous.as_ref(),
    );
    let (sender, receiver) = std::sync::mpsc::channel();
    let cancel = Arc::clone(&flag);
    let expected_state = pkce.state.clone();
    std::thread::spawn(move || {
        let _ = sender.send(loopback.wait(timeout, &cancel, &expected_state));
    });
    if !open_url(&url) {
        flag.store(true, Ordering::SeqCst);
        let _ = receiver.recv_timeout(Duration::from_secs(2));
        return Err("The sign-in page could not be opened.".into());
    }
    let callback = receiver
        .recv_timeout(timeout.saturating_add(Duration::from_secs(2)))
        .map_err(|_| "Sign-in timed out.".to_string())?
        .map_err(|error| scrub(&error, &[pkce.verifier.as_str(), pkce.state.as_str()]))?;
    if !pkce::same_secret(
        callback
            .params
            .get("state")
            .map(String::as_str)
            .unwrap_or(""),
        &pkce.state,
    ) {
        return Err("Sign-in could not be verified.".into());
    }
    if callback.params.get("error").map(String::as_str) == Some("access_denied") {
        return Err("Sign-in was declined.".into());
    }
    if callback.params.contains_key("error") {
        return Err("Sign-in could not be completed.".into());
    }
    let code = callback
        .params
        .get("code")
        .map(String::as_str)
        .filter(|code| !code.is_empty())
        .ok_or_else(|| "Sign-in could not be completed.".to_string())?;
    let issued = match callback.params.get("client_id").map(String::as_str) {
        Some(callback_id) if client_id == DYNAMIC_CLIENT && is_issued(callback_id) => {
            callback_id.to_string()
        }
        Some(callback_id) if client_id != DYNAMIC_CLIENT && callback_id == client_id => {
            client_id.clone()
        }
        None if client_id != DYNAMIC_CLIENT => client_id.clone(),
        _ => return Err("Sign-in could not be verified.".into()),
    };
    let tokens = exchange_code(env, &endpoints, code, &pkce.verifier, &redirect, &issued)
        .map_err(|error| scrub(&error, &[code, pkce.verifier.as_str()]))?;
    let identity = verify_id_token(env, &endpoints, &tokens.id_token, &pkce.nonce, &issued)?;
    let scopes = split_scopes(tokens.scope.as_deref().unwrap_or(""));
    let usable = scopes.iter().any(|scope| scope == DIRECT_SCOPE);
    let now = unix_now();
    let record = super::Record {
        email: identity.email,
        issuer: endpoints.issuer,
        subject: identity.subject,
        client_id: issued,
        ext_agent_host_id: host,
        id_token: tokens.id_token,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token.unwrap_or_default(),
        token_type: tokens.token_type.unwrap_or_else(|| "Bearer".into()),
        expires_at: now + tokens.expires_in.unwrap_or(3600).max(0),
        scopes,
        usable,
        saved_at: now,
    };
    {
        let _lock = super::lock_refresh(env)?;
        save_record(env, &provider, &record)?;
        set_provider_enabled(env, &provider, usable)?;
    }
    if !usable {
        return Err(NOT_USABLE.into());
    }
    super::status_of(env, &provider)
}

pub(super) fn refresh(env: &Env, record: &super::Record) -> Result<RefreshTokens, RefreshFail> {
    let endpoints = resolve(env).map_err(|_| RefreshFail::Temporary)?;
    let response = env
        .http
        .post(&endpoints.token)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", record.client_id.as_str()),
            ("refresh_token", record.refresh_token.as_str()),
            ("resource", RESOURCE),
        ])
        .send();
    let response = match response {
        Ok(response) => response,
        Err(_) => return Err(RefreshFail::Temporary),
    };
    if !response.status().is_success() {
        let code = oauth_error_code(response);
        if unusable_refresh(&code) {
            let cleared = if clears_client(&code) {
                record.cleared_client()
            } else {
                record.cleared()
            };
            return Err(RefreshFail::Again(Box::new(cleared)));
        }
        return Err(RefreshFail::Temporary);
    }
    let body: TokenBody = match response.json() {
        Ok(body) => body,
        Err(_) => return Err(RefreshFail::Temporary),
    };
    Ok(RefreshTokens {
        access_token: body.access_token,
        refresh_token: body.refresh_token.filter(|token| !token.is_empty()),
        id_token: body.id_token,
        expires_in: body.expires_in,
        scope: body.scope,
    })
}

pub(super) fn check_id_token(
    env: &Env,
    id_token: &str,
    client_id: &str,
) -> Result<IdCheck, String> {
    let endpoints = resolve(env)?;
    match verify_id_token(env, &endpoints, id_token, "", client_id) {
        Ok(identity) => Ok(IdCheck::Match(identity)),
        Err(_) => Ok(IdCheck::Failed),
    }
}

pub(super) fn revoke(env: &Env, record: &super::Record) -> Result<(), ()> {
    let endpoints = resolve(env).map_err(|_| ())?;
    if endpoints.revoke.is_empty() {
        return Err(());
    }
    let response = env
        .http
        .post(&endpoints.revoke)
        .form(&[
            ("token", record.refresh_token.as_str()),
            ("token_type_hint", "refresh_token"),
            ("client_id", record.client_id.as_str()),
        ])
        .send()
        .map_err(|_| ())?;
    if response.status().is_success() {
        Ok(())
    } else {
        let _ = response.bytes();
        Err(())
    }
}

fn begin_attempt(env: &Env) -> Result<Arc<AtomicBool>, String> {
    let mut slot = env
        .attempt
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    if slot.is_some() {
        return Err("A sign-in is already in progress.".into());
    }
    let flag = Arc::new(AtomicBool::new(false));
    *slot = Some(Arc::clone(&flag));
    Ok(flag)
}

fn normalize_openai(provider: &str) -> Result<String, String> {
    let id = provider.trim().to_ascii_lowercase();
    if id != "openai" {
        return Err("Sign in with ChatGPT is only available for the OpenAI provider.".into());
    }
    Ok(id)
}

fn is_issued(client_id: &str) -> bool {
    client_id.starts_with("oaiapp_") && client_id != DYNAMIC_CLIENT
}

fn authorize_url(
    endpoints: &Endpoints,
    pkce: &Pkce,
    redirect: &str,
    client_id: &str,
    host: &str,
    previous: Option<&super::Record>,
) -> String {
    let mut pairs = vec![
        ("client_id", client_id.to_string()),
        ("response_type", "code".into()),
        ("redirect_uri", redirect.into()),
        ("scope", SCOPES.into()),
        ("resource", RESOURCE.into()),
        ("state", pkce.state.clone()),
        ("nonce", pkce.nonce.clone()),
        ("code_challenge_method", "S256".into()),
        ("code_challenge", pkce.challenge.clone()),
        ("ext_agent_host_id", host.into()),
    ];
    if client_id == DYNAMIC_CLIENT {
        pairs.push(("agent_name_hint", AGENT_NAME.into()));
    } else if let Some(email) = previous
        .and_then(|previous| previous.email.as_ref())
        .filter(|email| !email.is_empty())
    {
        pairs.push(("login_hint", email.clone()));
    }
    let query = pairs
        .iter()
        .map(|(name, value)| format!("{}={}", percent_encode(name), percent_encode(value)))
        .collect::<Vec<_>>()
        .join("&");
    format!("{}?{query}", endpoints.authorize)
}

fn exchange_code(
    env: &Env,
    endpoints: &Endpoints,
    code: &str,
    verifier: &str,
    redirect: &str,
    client_id: &str,
) -> Result<TokenBody, String> {
    let response = env
        .http
        .post(&endpoints.token)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect),
            ("client_id", client_id),
            ("code_verifier", verifier),
            ("resource", RESOURCE),
        ])
        .send()
        .map_err(|_| "Sign-in could not be completed.".to_string())?;
    if !response.status().is_success() {
        let code = oauth_error_code(response);
        if unusable_refresh(&code) {
            return Err(SIGN_IN_AGAIN.into());
        }
        return Err("Sign-in could not be completed.".into());
    }
    let body: TokenBody = response
        .json()
        .map_err(|_| "Sign-in could not be completed.".to_string())?;
    if body.access_token.is_empty()
        || body.refresh_token.as_deref().unwrap_or("").is_empty()
        || body.id_token.is_empty()
    {
        return Err("Sign-in could not be completed.".into());
    }
    Ok(body)
}

#[derive(Debug, Deserialize)]
struct TokenBody {
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    id_token: String,
    #[serde(default)]
    token_type: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
    #[serde(default)]
    scope: Option<String>,
}

#[derive(Deserialize)]
struct ErrorBody {
    error: Option<String>,
}

fn oauth_error_code(response: reqwest::blocking::Response) -> String {
    response
        .json::<ErrorBody>()
        .ok()
        .and_then(|body| body.error)
        .unwrap_or_default()
}

fn unusable_refresh(code: &str) -> bool {
    matches!(
        code,
        "invalid_grant"
            | "invalid_refresh_token"
            | "token_expired"
            | "refresh_token_expired"
            | "refresh_token_invalidated"
            | "refresh_token_reused"
            | "invalid_client"
            | "unauthorized_client"
    )
}

fn clears_client(code: &str) -> bool {
    matches!(code, "invalid_client" | "unauthorized_client")
}

pub(super) fn split_scopes(scope: &str) -> Vec<String> {
    scope
        .split(|character: char| character.is_whitespace() || character == '+')
        .filter(|scope| !scope.is_empty())
        .map(str::to_string)
        .collect()
}

pub(super) struct Identity {
    pub(super) subject: String,
    pub(super) email: Option<String>,
}

#[derive(Deserialize)]
struct IdClaims {
    sub: String,
    #[serde(default)]
    nonce: String,
    #[serde(default)]
    email: Option<String>,
}

fn verify_id_token(
    env: &Env,
    endpoints: &Endpoints,
    id_token: &str,
    expected_nonce: &str,
    client_id: &str,
) -> Result<Identity, String> {
    let header =
        decode_header(id_token).map_err(|_| "Sign-in could not be verified.".to_string())?;
    if header.alg != Algorithm::RS256 {
        return Err("Sign-in could not be verified.".into());
    }
    let kid = header
        .kid
        .ok_or_else(|| "Sign-in could not be verified.".to_string())?;
    let key = jwks_key(env, endpoints, &kid)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[&endpoints.issuer]);
    validation.set_audience(&[client_id]);
    validation.leeway = 5;
    validation.validate_exp = true;
    let data = decode::<IdClaims>(id_token, &key, &validation)
        .map_err(|_| "Sign-in could not be verified.".to_string())?;
    if !expected_nonce.is_empty() && !pkce::same_secret(&data.claims.nonce, expected_nonce) {
        return Err("Sign-in could not be verified.".into());
    }
    if data.claims.sub.is_empty() {
        return Err("Sign-in could not be verified.".into());
    }
    Ok(Identity {
        subject: data.claims.sub,
        email: data
            .claims
            .email
            .filter(|email| !email.trim().is_empty())
            .map(|email| email.trim().to_string()),
    })
}

fn jwks_key(env: &Env, endpoints: &Endpoints, kid: &str) -> Result<DecodingKey, String> {
    let response = env
        .http
        .get(&endpoints.jwks)
        .send()
        .map_err(|_| "Sign-in could not be verified.".to_string())?;
    if !response.status().is_success() {
        return Err("Sign-in could not be verified.".into());
    }
    let set: JwkSet = response
        .json()
        .map_err(|_| "Sign-in could not be verified.".to_string())?;
    let key = set
        .keys
        .into_iter()
        .find(|key| key.kid.as_deref() == Some(kid) && key.kty == "RSA")
        .ok_or_else(|| "Sign-in could not be verified.".to_string())?;
    if matches!(key.alg.as_deref(), Some(alg) if alg != "RS256") {
        return Err("Sign-in could not be verified.".into());
    }
    let (n, e) = key
        .n
        .zip(key.e)
        .ok_or_else(|| "Sign-in could not be verified.".to_string())?;
    let n = b64url(&n).map_err(|_| "Sign-in could not be verified.".to_string())?;
    let e = b64url(&e).map_err(|_| "Sign-in could not be verified.".to_string())?;
    Ok(DecodingKey::from_rsa_raw_components(&n, &e))
}

#[derive(Deserialize)]
struct JwkSet {
    keys: Vec<JwkKey>,
}

#[derive(Deserialize)]
struct JwkKey {
    kty: String,
    #[serde(default)]
    kid: Option<String>,
    #[serde(default)]
    alg: Option<String>,
    #[serde(default)]
    n: Option<String>,
    #[serde(default)]
    e: Option<String>,
}

fn b64url(value: &str) -> Result<Vec<u8>, ()> {
    URL_SAFE_NO_PAD
        .decode(value.trim_end_matches('='))
        .or_else(|_| URL_SAFE_NO_PAD.decode(value))
        .map_err(|_| ())
}

fn resolve(env: &Env) -> Result<Endpoints, String> {
    if !env.endpoints.discover {
        return Ok(env.endpoints.clone());
    }
    static CACHE: std::sync::Mutex<Option<Endpoints>> = std::sync::Mutex::new(None);
    let cache = CACHE.lock().unwrap_or_else(|poison| poison.into_inner());
    if let Some(cached) = cache.clone() {
        return Ok(cached);
    }
    drop(cache);
    let response = env
        .http
        .get(DISCOVERY)
        .send()
        .map_err(|_| "Sign-in could not be completed.".to_string())?;
    if !response.status().is_success() {
        return Err("Sign-in could not be completed.".into());
    }
    let document: Discovery = response
        .json()
        .map_err(|_| "Sign-in could not be completed.".to_string())?;
    if document.issuer != ISSUER {
        return Err("Sign-in could not be verified.".into());
    }
    let endpoints = Endpoints {
        issuer: document.issuer,
        authorize: document.authorization_endpoint,
        token: document.token_endpoint,
        jwks: document.jwks_uri,
        revoke: document.revocation_endpoint,
        discover: false,
    };
    *CACHE.lock().unwrap_or_else(|poison| poison.into_inner()) = Some(endpoints.clone());
    Ok(endpoints)
}

#[derive(Deserialize)]
struct Discovery {
    issuer: String,
    authorization_endpoint: String,
    token_endpoint: String,
    jwks_uri: String,
    revocation_endpoint: String,
}

fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use super::*;
    use crate::provider_keys::SecretBackend;
    use crate::provider_oauth::{
        fresh_access_token_with, lock_refresh, sign_out_with, Record, SIGN_IN_AGAIN, TURNED_OFF,
    };
    use std::collections::HashMap;
    use std::sync::Mutex;

    const ACCESS: &str = "oat-secret-access";
    const REFRESH: &str = "oat-secret-refresh";
    const ACCESS_2: &str = "oat-secret-access-2";
    const REFRESH_2: &str = "oat-secret-refresh-2";
    const CODE: &str = "oat-secret-code";
    const CLIENT: &str = "oaiapp_testclient";

    struct Keys {
        values: Mutex<HashMap<String, String>>,
        /// Rejects the rotated access token so a refresh cannot be saved.
        reject_rotated: bool,
        fail_first_rotated: std::sync::atomic::AtomicBool,
        /// Fails every rotated write after the first, so the profile save
        /// after a good token save can fail on its own.
        fail_second_rotated: bool,
        rotated_writes: std::sync::atomic::AtomicU32,
    }

    impl Keys {
        fn new() -> Self {
            Self {
                values: Mutex::new(HashMap::new()),
                reject_rotated: false,
                fail_first_rotated: std::sync::atomic::AtomicBool::new(false),
                fail_second_rotated: false,
                rotated_writes: std::sync::atomic::AtomicU32::new(0),
            }
        }
    }

    impl SecretBackend for Keys {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            Ok(self.values.lock().expect("keys").get(account).cloned())
        }

        fn set(&self, account: &str, value: &str) -> Result<(), String> {
            if value.contains(ACCESS_2) {
                let index = self.rotated_writes.fetch_add(1, Ordering::SeqCst);
                let fail_first = self.fail_first_rotated.swap(false, Ordering::SeqCst);
                if self.reject_rotated || fail_first || (self.fail_second_rotated && index >= 1) {
                    return Err("keychain write failed".into());
                }
            }
            self.values
                .lock()
                .expect("keys")
                .insert(account.to_string(), value.to_string());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), String> {
            self.values.lock().expect("keys").remove(account);
            Ok(())
        }
    }

    struct Mock {
        base: String,
        requests: Arc<Mutex<Vec<(String, String)>>>,
        thread: Option<std::thread::JoinHandle<()>>,
        shutdown: Arc<AtomicBool>,
        addr: std::net::SocketAddr,
    }

    #[derive(Clone)]
    enum Mode {
        Happy { scope: String, delay_ms: u64 },
        Denied,
        WrongState,
        InvalidGrant,
        InvalidClient,
        MissingScope,
        OmitRefreshToken,
        RefreshJwksFails,
        SubjectMismatch,
        RevokeFails,
        EmptyAccess,
        SameAccess,
    }

    impl Mock {
        fn start(mode: Mode) -> Self {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let addr = listener.local_addr().unwrap();
            let requests = Arc::new(Mutex::new(Vec::new()));
            let mode = Arc::new(Mutex::new(mode));
            let nonce = Arc::new(Mutex::new(None));
            let jwks_hits = Arc::new(std::sync::atomic::AtomicU32::new(0));
            let shutdown = Arc::new(AtomicBool::new(false));
            let seen = Arc::clone(&requests);
            let stop = Arc::clone(&shutdown);
            let hits = Arc::clone(&jwks_hits);
            let handle = std::thread::spawn(move || serve(listener, seen, mode, nonce, hits, stop));
            Self {
                base: format!("http://{addr}"),
                requests,
                thread: Some(handle),
                shutdown,
                addr,
            }
        }

        fn endpoints(&self) -> Endpoints {
            Endpoints {
                issuer: ISSUER.into(),
                authorize: format!("{}/authorize", self.base),
                token: format!("{}/token", self.base),
                jwks: format!("{}/jwks", self.base),
                revoke: format!("{}/revoke", self.base),
                discover: false,
            }
        }
    }

    impl Drop for Mock {
        fn drop(&mut self) {
            self.shutdown.store(true, Ordering::SeqCst);
            let _ = std::net::TcpStream::connect(self.addr);
            if let Some(handle) = self.thread.take() {
                let _ = handle.join();
            }
        }
    }

    fn serve(
        listener: std::net::TcpListener,
        requests: Arc<Mutex<Vec<(String, String)>>>,
        mode: Arc<Mutex<Mode>>,
        nonce: Arc<Mutex<Option<String>>>,
        jwks_hits: Arc<std::sync::atomic::AtomicU32>,
        shutdown: Arc<AtomicBool>,
    ) {
        listener.set_nonblocking(true).unwrap();
        while !shutdown.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    let (target, body) = read_request(&mut stream);
                    requests
                        .lock()
                        .unwrap()
                        .push((target.clone(), body.clone()));
                    let response = route(&target, &body, &mode, &nonce, &jwks_hits);
                    let _ = stream.write_all(response.as_bytes());
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(10));
                }
                Err(_) => return,
            }
        }
    }

    fn read_request(stream: &mut std::net::TcpStream) -> (String, String) {
        use std::io::{BufRead, BufReader, Read};
        let mut reader = BufReader::new(stream);
        let mut request = String::new();
        let _ = reader.read_line(&mut request);
        let target = request.split_whitespace().nth(1).unwrap_or("").to_string();
        let mut length = 0usize;
        loop {
            let mut header = String::new();
            if reader
                .read_line(&mut header)
                .ok()
                .filter(|n| *n > 0)
                .is_none()
            {
                break;
            }
            if header.trim().is_empty() {
                break;
            }
            if let Some(value) = header.to_ascii_lowercase().strip_prefix("content-length:") {
                length = value.trim().parse().unwrap_or(0);
            }
        }
        let mut body = vec![0; length];
        let _ = reader.read_exact(&mut body);
        (target, String::from_utf8_lossy(&body).into_owned())
    }

    fn route(
        target: &str,
        body: &str,
        mode: &Mutex<Mode>,
        nonce: &Mutex<Option<String>>,
        jwks_hits: &std::sync::atomic::AtomicU32,
    ) -> String {
        let path = target.split('?').next().unwrap_or(target);
        let mode = mode.lock().unwrap().clone();
        if path == "/authorize" {
            return authorize_redirect(target, &mode, nonce);
        }
        if path == "/jwks" {
            let hit = jwks_hits.fetch_add(1, Ordering::SeqCst);
            if matches!(mode, Mode::RefreshJwksFails) && hit > 0 {
                return http(500, "text/plain", "");
            }
            return http(200, "application/json", &jwks_json());
        }
        if path == "/token" {
            return token_response(body, &mode, nonce);
        }
        if path == "/revoke" {
            if matches!(mode, Mode::RevokeFails) {
                return http(500, "text/plain", "");
            }
            return http(200, "text/plain", "");
        }
        http(404, "text/plain", "")
    }

    fn authorize_redirect(target: &str, mode: &Mode, nonce: &Mutex<Option<String>>) -> String {
        let query = target.split_once('?').map(|(_, query)| query).unwrap_or("");
        let params = query_map(query);
        if let Some(value) = params.get("nonce") {
            *nonce.lock().unwrap() = Some(value.clone());
        }
        let redirect = params.get("redirect_uri").cloned().unwrap_or_default();
        let state = params.get("state").cloned().unwrap_or_default();
        let location = match mode {
            Mode::Denied => format!("{redirect}?error=access_denied&state={state}"),
            Mode::WrongState => {
                format!("{redirect}?code={CODE}&state=wrong-state&client_id={CLIENT}")
            }
            _ => format!("{redirect}?code={CODE}&state={state}&client_id={CLIENT}"),
        };
        format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    }

    fn token_response(body: &str, mode: &Mode, nonce: &Mutex<Option<String>>) -> String {
        if let Mode::Happy { delay_ms, .. } = mode {
            if body.contains("refresh_token") {
                std::thread::sleep(Duration::from_millis(*delay_ms));
            }
        }
        if body.contains("grant_type=refresh_token") {
            if matches!(mode, Mode::InvalidGrant) {
                let payload = format!(
                    "{{\"error\":\"invalid_grant\",\"error_description\":\"{REFRESH} {ACCESS}\"}}"
                );
                return http(400, "application/json", &payload);
            }
            if matches!(mode, Mode::InvalidClient) {
                return http(400, "application/json", r#"{"error":"invalid_client"}"#);
            }
        }
        let nonce = nonce.lock().unwrap().clone().unwrap_or_default();
        let scope = match mode {
            Mode::MissingScope => "openid profile email offline_access",
            Mode::Happy { scope, .. } => scope.as_str(),
            _ => "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
        };
        let refreshing = body.contains("grant_type=refresh_token");
        let (access, refresh) = if refreshing && matches!(mode, Mode::SameAccess) {
            (ACCESS, REFRESH)
        } else if refreshing && matches!(mode, Mode::EmptyAccess) {
            ("", REFRESH_2)
        } else if refreshing {
            (ACCESS_2, REFRESH_2)
        } else {
            (ACCESS, REFRESH)
        };
        let subject = if refreshing && matches!(mode, Mode::SubjectMismatch) {
            "other-subject"
        } else {
            "user-subject"
        };
        let id_token = mint_id_token(&nonce, CLIENT, subject);
        let refresh_field = if refreshing && matches!(mode, Mode::OmitRefreshToken) {
            String::new()
        } else {
            format!(r#","refresh_token":"{refresh}""#)
        };
        let payload = format!(
            r#"{{"access_token":"{access}"{refresh_field},"id_token":"{id_token}","token_type":"Bearer","expires_in":3600,"scope":"{scope}"}}"#
        );
        http(200, "application/json", &payload)
    }

    fn http(status: u16, content_type: &str, body: &str) -> String {
        let reason = if status == 200 {
            "OK"
        } else if status == 400 {
            "Bad Request"
        } else if status == 500 {
            "Error"
        } else {
            "Not Found"
        };
        format!(
            "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    fn query_map(query: &str) -> HashMap<String, String> {
        query
            .split('&')
            .map(|pair| {
                let (name, value) = pair.split_once('=').unwrap_or((pair, ""));
                (percent_decode(name), percent_decode(value))
            })
            .collect()
    }

    fn percent_decode(value: &str) -> String {
        let bytes = value.as_bytes();
        let mut out = Vec::new();
        let mut index = 0;
        while index < bytes.len() {
            if bytes[index] == b'%' && index + 2 < bytes.len() {
                if let Ok(byte) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                    out.push(byte);
                    index += 3;
                    continue;
                }
            }
            out.push(if bytes[index] == b'+' {
                b' '
            } else {
                bytes[index]
            });
            index += 1;
        }
        String::from_utf8_lossy(&out).into_owned()
    }

    struct TestKey {
        pem: String,
        n: String,
        e: String,
    }

    fn test_key() -> &'static TestKey {
        static KEY: std::sync::OnceLock<TestKey> = std::sync::OnceLock::new();
        KEY.get_or_init(|| {
            use rsa::pkcs8::EncodePrivateKey;
            use rsa::traits::PublicKeyParts;
            use rsa::RsaPrivateKey;
            let mut rng = rand::thread_rng();
            let key = RsaPrivateKey::new(&mut rng, 2048).expect("rsa");
            let pem = key
                .to_pkcs8_pem(rsa::pkcs8::LineEnding::LF)
                .expect("pem")
                .to_string();
            TestKey {
                n: URL_SAFE_NO_PAD.encode(key.n().to_bytes_be()),
                e: URL_SAFE_NO_PAD.encode(key.e().to_bytes_be()),
                pem,
            }
        })
    }

    fn jwks_json() -> String {
        let key = test_key();
        format!(
            "{{\"keys\":[{{\"kty\":\"RSA\",\"kid\":\"test-key\",\"use\":\"sig\",\"alg\":\"RS256\",\"n\":\"{}\",\"e\":\"{}\"}}]}}",
            key.n, key.e
        )
    }

    fn mint_id_token(nonce: &str, client_id: &str, subject: &str) -> String {
        #[derive(serde::Serialize)]
        struct Claims<'a> {
            iss: &'a str,
            aud: &'a str,
            sub: &'a str,
            nonce: &'a str,
            email: &'a str,
            exp: u64,
            iat: u64,
        }
        let now = unix_now() as u64;
        let mut header = jsonwebtoken::Header::new(Algorithm::RS256);
        header.kid = Some("test-key".into());
        jsonwebtoken::encode(
            &header,
            &Claims {
                iss: ISSUER,
                aud: client_id,
                sub: subject,
                nonce,
                email: "ada@example.com",
                exp: now + 3600,
                iat: now,
            },
            &jsonwebtoken::EncodingKey::from_rsa_pem(test_key().pem.as_bytes()).unwrap(),
        )
        .unwrap()
    }

    fn env_for(mock: &Mock) -> (tempfile::TempDir, Env) {
        let dir = tempfile::tempdir().unwrap();
        let env = Env::in_dir_with(dir.path(), mock.endpoints(), Box::new(Keys::new()));
        (dir, env)
    }

    fn browser(url: &str) {
        let client = reqwest::blocking::Client::builder()
            .redirect(reqwest::redirect::Policy::limited(4))
            .build()
            .unwrap();
        client.get(url).send().unwrap();
    }

    fn assert_clean(error: &str) {
        assert!(!error.contains("oat-secret"), "{error}");
        assert!(!error.contains("eyJ"), "{error}");
        assert!(!error.contains(CODE), "{error}");
    }

    #[test]
    fn a_sign_in_keeps_the_issued_client_and_the_direct_scope() {
        let mock = Mock::start(Mode::Happy {
            scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
                .into(),
            delay_ms: 0,
        });
        let (_dir, env) = env_for(&mock);
        let status = sign_in(
            &env,
            "openai",
            |url| {
                assert!(url.contains("client_id=dynamic_agent_client"));
                assert!(url.contains("agent_name_hint=Rhizome"));
                assert!(url.contains("ext_agent_host_id=urn%3Auuid%3A"));
                assert!(url.contains("code_challenge_method=S256"));
                assert!(url.contains("resource=https%3A%2F%2Fapi.openai.com%2Fv1"));
                assert!(url.contains("chatgpt.tokens.use.direct"));
                assert!(!url.contains("127.0.0.1%3A1455") && !url.contains(":1455/"));
                assert!(url.contains("%2Fauth%2Fcallback"));
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        assert!(status.enabled && status.signed_in && status.usable);
        assert_eq!(status.email.as_deref(), Some("ada@example.com"));
        let raw = env.read_account("openai:oauth").unwrap().unwrap();
        assert!(raw.contains(CLIENT));
        assert!(!raw.contains(DYNAMIC_CLIENT));
        assert!(raw.contains("urn:uuid:"));
        let token_body = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .find(|(target, _)| target.starts_with("/token"))
            .unwrap()
            .1
            .clone();
        let authorize = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .find(|(target, _)| target.starts_with("/authorize"))
            .unwrap()
            .0
            .clone();
        let challenge = query_map(authorize.split_once('?').unwrap().1)
            .remove("code_challenge")
            .unwrap();
        let verifier = query_map(&token_body).remove("code_verifier").unwrap();
        assert_eq!(challenge, pkce::s256(&verifier));
        assert!(token_body.contains(&format!("client_id={CLIENT}")));
    }

    #[test]
    fn a_wrong_state_callback_is_ignored() {
        let mock = Mock::start(Mode::WrongState);
        let (_dir, env) = env_for(&mock);
        let status = sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                let params = query_map(url.split_once('?').unwrap().1);
                let redirect = params.get("redirect_uri").cloned().unwrap();
                let state = params.get("state").cloned().unwrap();
                reqwest::blocking::get(format!(
                    "{redirect}?code={CODE}&state={state}&client_id={CLIENT}"
                ))
                .unwrap();
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        assert!(status.usable);
        let token_hits = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .filter(|(target, _)| target.starts_with("/token"))
            .count();
        assert_eq!(token_hits, 1);
    }

    #[test]
    fn access_denied_does_not_exchange_the_code() {
        let mock = Mock::start(Mode::Denied);
        let (_dir, env) = env_for(&mock);
        let error = sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap_err();
        assert_eq!(error, "Sign-in was declined.");
        assert_clean(&error);
        assert!(mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .all(|(target, _)| !target.starts_with("/token")));
    }

    #[test]
    fn sign_in_times_out() {
        let dir = tempfile::tempdir().unwrap();
        let env = Env::in_dir(dir.path(), Endpoints::offline());
        let error = sign_in(&env, "openai", |_url| true, Duration::from_millis(80)).unwrap_err();
        assert_eq!(error, "Sign-in timed out.");
        assert_clean(&error);
    }

    #[test]
    fn cancel_ends_sign_in() {
        let dir = tempfile::tempdir().unwrap();
        let env = Arc::new(Env::in_dir(dir.path(), Endpoints::offline()));
        let waiting = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&waiting);
        let env_thread = Arc::clone(&env);
        let handle = std::thread::spawn(move || {
            sign_in(
                &env_thread,
                "openai",
                move |_url| {
                    flag.store(true, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_secs(3));
                    true
                },
                Duration::from_secs(5),
            )
        });
        let start = std::time::Instant::now();
        while !waiting.load(Ordering::SeqCst) {
            assert!(start.elapsed() < Duration::from_secs(2));
            std::thread::sleep(Duration::from_millis(10));
        }
        env.cancel();
        let error = handle.join().unwrap().unwrap_err();
        assert_eq!(error, "Sign-in was cancelled.");
    }

    #[test]
    fn a_missing_direct_scope_is_not_usable() {
        let mock = Mock::start(Mode::MissingScope);
        let (_dir, env) = env_for(&mock);
        let error = sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap_err();
        assert_eq!(error, NOT_USABLE);
        assert_clean(&error);
        let status = crate::provider_oauth::status_of(&env, "openai").unwrap();
        assert!(status.signed_in);
        assert!(!status.usable);
        assert!(!status.enabled);
        let fresh = super::super::fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(fresh, NOT_USABLE);
        assert_clean(&fresh);
    }

    #[test]
    fn refresh_rotates_and_saves_before_use() {
        let mock = Mock::start(Mode::Happy {
            scope: format!("{DIRECT_SCOPE} openid"),
            delay_ms: 0,
        });
        let (_dir, env) = env_for(&mock);
        sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        {
            let _lock = lock_refresh(&env).unwrap();
            let mut record = load_record(&env, "openai").unwrap().unwrap();
            record.expires_at = unix_now() + 30;
            save_record(&env, "openai", &record).unwrap();
        }
        let token = fresh_access_token_with(&env, "openai").unwrap();
        assert_eq!(token, ACCESS_2);
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert_eq!(stored.refresh_token, REFRESH_2);
        assert_eq!(stored.access_token, ACCESS_2);
        let refresh_hits = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .filter(|(target, body)| target.starts_with("/token") && body.contains("refresh_token"))
            .count();
        assert_eq!(refresh_hits, 1);
    }

    #[test]
    fn a_failed_save_does_not_return_the_rotated_token() {
        let mock = Mock::start(Mode::Happy {
            scope: DIRECT_SCOPE.into(),
            delay_ms: 0,
        });
        let dir = tempfile::tempdir().unwrap();
        let mut keys = Keys::new();
        keys.reject_rotated = true;
        let env = Env::in_dir_with(dir.path(), mock.endpoints(), Box::new(keys));
        sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        {
            let _lock = lock_refresh(&env).unwrap();
            let mut record = load_record(&env, "openai").unwrap().unwrap();
            record.expires_at = unix_now() + 10;
            save_record(&env, "openai", &record).unwrap();
        }
        let error = fresh_access_token_with(&env, "openai").unwrap_err();
        assert!(!error.contains(ACCESS_2), "{error}");
        assert!(!error.contains(REFRESH_2), "{error}");
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert_eq!(stored.access_token, ACCESS);
        assert_eq!(stored.refresh_token, REFRESH);
    }

    #[test]
    fn invalid_grant_says_sign_in_again_and_hides_the_token() {
        let mock = Mock::start(Mode::InvalidGrant);
        let (_dir, env) = env_for(&mock);
        sign_in(
            &env,
            "OpenAI",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        {
            let _lock = lock_refresh(&env).unwrap();
            let mut record = load_record(&env, "openai").unwrap().unwrap();
            record.expires_at = unix_now();
            save_record(&env, "openai", &record).unwrap();
        }
        let error = fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(error, SIGN_IN_AGAIN);
        assert_clean(&error);
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert!(stored.access_token.is_empty());
        assert!(stored.refresh_token.is_empty());
        assert_eq!(stored.client_id, CLIENT);
        let again = fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(again, SIGN_IN_AGAIN);
    }

    #[test]
    fn concurrent_refresh_uses_one_token_request() {
        let mock = Mock::start(Mode::Happy {
            scope: DIRECT_SCOPE.into(),
            delay_ms: 250,
        });
        let (_dir, env) = env_for(&mock);
        let env = Arc::new(env);
        sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        {
            let _lock = lock_refresh(&env).unwrap();
            let mut record = load_record(&env, "openai").unwrap().unwrap();
            record.expires_at = unix_now() + 10;
            save_record(&env, "openai", &record).unwrap();
        }
        let left_env = Arc::clone(&env);
        let right_env = Arc::clone(&env);
        let left = std::thread::spawn(move || fresh_access_token_with(&left_env, "openai"));
        let right = std::thread::spawn(move || fresh_access_token_with(&right_env, "openai"));
        assert_eq!(left.join().unwrap().unwrap(), ACCESS_2);
        assert_eq!(right.join().unwrap().unwrap(), ACCESS_2);
        let refresh_hits = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .filter(|(target, body)| target.starts_with("/token") && body.contains("refresh_token"))
            .count();
        assert_eq!(refresh_hits, 1);
        assert_eq!(
            load_record(&env, "openai").unwrap().unwrap().refresh_token,
            REFRESH_2
        );
    }

    #[test]
    fn sign_out_revokes_and_deletes_the_record_but_keeps_the_host() {
        let mock = Mock::start(Mode::Happy {
            scope: DIRECT_SCOPE.into(),
            delay_ms: 0,
        });
        let (_dir, env) = env_for(&mock);
        sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        let host = env.read_account("openai:oauth-host").unwrap().unwrap();
        let status = sign_out_with(&env, "openai").unwrap();
        assert!(!status.signed_in && !status.enabled);
        assert!(env.read_account("openai:oauth").unwrap().is_none());
        assert_eq!(
            env.read_account("openai:oauth-host").unwrap().unwrap(),
            host
        );
        sign_in(
            &env,
            "openai",
            |url| {
                assert!(url.contains("client_id=dynamic_agent_client"));
                assert!(url.contains(&percent_encode(&host)));
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        assert_eq!(
            env.read_account("openai:oauth-host").unwrap().unwrap(),
            host
        );
        let revoke = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .find(|(target, _)| target.starts_with("/revoke"))
            .unwrap()
            .1
            .clone();
        assert!(revoke.contains(REFRESH));
        assert!(revoke.contains(&format!("client_id={CLIENT}")));
        assert!(revoke.contains("token_type_hint=refresh_token"));
    }

    #[test]
    fn errors_and_debug_do_not_carry_tokens() {
        let record = load_shape();
        let rendered = format!("{record:?}");
        assert!(!rendered.contains(ACCESS));
        assert!(rendered.contains("[redacted]"));
        let leaked = scrub(
            &format!("failed {ACCESS} and {REFRESH}"),
            &[ACCESS, REFRESH],
        );
        assert!(!leaked.contains(ACCESS));
        assert!(!leaked.contains(REFRESH));
        assert!(leaked.contains("[redacted]"));
    }

    fn load_shape() -> Record {
        Record {
            email: Some("ada@example.com".into()),
            issuer: ISSUER.into(),
            subject: "user-subject".into(),
            client_id: CLIENT.into(),
            ext_agent_host_id: "urn:uuid:00000000-0000-4000-8000-000000000099".into(),
            id_token: "eyJ.secret.id".into(),
            access_token: ACCESS.into(),
            refresh_token: REFRESH.into(),
            token_type: "Bearer".into(),
            expires_at: unix_now() + 3600,
            scopes: vec![DIRECT_SCOPE.into()],
            usable: true,
            saved_at: unix_now(),
        }
    }

    #[test]
    fn the_setting_blocks_a_saved_token_without_touching_it() {
        let dir = tempfile::tempdir().unwrap();
        let env = Env::in_dir(dir.path(), Endpoints::offline());
        save_record(&env, "openai", &load_shape()).unwrap();
        let error = fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(error, TURNED_OFF);
        assert_clean(&error);
        assert_eq!(
            load_record(&env, "openai").unwrap().unwrap().access_token,
            ACCESS
        );
    }

    fn expire_for_refresh(env: &Env) {
        let _lock = lock_refresh(env).unwrap();
        let mut record = load_record(env, "openai").unwrap().unwrap();
        record.expires_at = unix_now();
        save_record(env, "openai", &record).unwrap();
    }

    fn signed_in(env: &Env) {
        sign_in(
            env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
    }

    #[test]
    fn a_refresh_without_a_new_refresh_token_keeps_the_old_one() {
        let mock = Mock::start(Mode::OmitRefreshToken);
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        expire_for_refresh(&env);
        assert_eq!(fresh_access_token_with(&env, "openai").unwrap(), ACCESS_2);
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert_eq!(stored.refresh_token, REFRESH);
        assert_eq!(stored.access_token, ACCESS_2);
    }

    #[test]
    fn a_jwks_failure_after_rotation_keeps_the_new_tokens() {
        let mock = Mock::start(Mode::RefreshJwksFails);
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        let before = load_record(&env, "openai").unwrap().unwrap();
        expire_for_refresh(&env);
        assert_eq!(fresh_access_token_with(&env, "openai").unwrap(), ACCESS_2);
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert_eq!(stored.access_token, ACCESS_2);
        assert_eq!(stored.refresh_token, REFRESH_2);
        assert_eq!(stored.id_token, before.id_token);
        assert_eq!(stored.email, before.email);
    }

    #[test]
    fn a_subject_mismatch_clears_the_record() {
        let mock = Mock::start(Mode::SubjectMismatch);
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        expire_for_refresh(&env);
        let error = fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(error, SIGN_IN_AGAIN);
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert!(stored.access_token.is_empty());
        assert!(stored.refresh_token.is_empty());
        assert_eq!(stored.client_id, CLIENT);
        let revoke = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .find(|(target, _)| target.starts_with("/revoke"))
            .map(|(_, body)| body.clone())
            .unwrap_or_default();
        assert!(revoke.contains(REFRESH_2), "{revoke}");
    }

    #[test]
    fn an_empty_access_token_is_stored_so_the_next_call_refreshes() {
        let mock = Mock::start(Mode::EmptyAccess);
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        expire_for_refresh(&env);
        let error = fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(error, "The token request failed.");
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert!(stored.access_token.is_empty());
        assert_eq!(stored.expires_at, 0);
        let again = fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(again, "The token request failed.");
        let refresh_hits = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .filter(|(target, body)| {
                target.starts_with("/token") && body.contains("grant_type=refresh_token")
            })
            .count();
        assert_eq!(refresh_hits, 2);
    }

    #[test]
    fn a_failed_profile_save_still_returns_the_token() {
        let mock = Mock::start(Mode::Happy {
            scope: DIRECT_SCOPE.into(),
            delay_ms: 0,
        });
        let dir = tempfile::tempdir().unwrap();
        let mut keys = Keys::new();
        keys.fail_second_rotated = true;
        let env = Env::in_dir_with(dir.path(), mock.endpoints(), Box::new(keys));
        signed_in(&env);
        expire_for_refresh(&env);
        assert_eq!(fresh_access_token_with(&env, "openai").unwrap(), ACCESS_2);
        assert_eq!(
            load_record(&env, "openai").unwrap().unwrap().access_token,
            ACCESS_2
        );
    }

    #[test]
    fn force_refresh_rejects_the_same_access_token() {
        let mock = Mock::start(Mode::SameAccess);
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        let error = super::super::force_refresh_with(&env, "openai").unwrap_err();
        assert_eq!(error, SIGN_IN_AGAIN);
        let refresh_hits = mock
            .requests
            .lock()
            .unwrap()
            .iter()
            .filter(|(target, body)| {
                target.starts_with("/token") && body.contains("grant_type=refresh_token")
            })
            .count();
        assert_eq!(refresh_hits, 1);
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert_eq!(stored.access_token, ACCESS);
    }

    #[test]
    fn force_refresh_asks_again_before_the_token_is_due() {
        let mock = Mock::start(Mode::Happy {
            scope: DIRECT_SCOPE.into(),
            delay_ms: 0,
        });
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        assert_eq!(
            super::super::force_refresh_with(&env, "openai").unwrap(),
            ACCESS_2
        );
    }

    #[test]
    fn invalid_client_clears_the_stored_client_id() {
        let mock = Mock::start(Mode::InvalidClient);
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        expire_for_refresh(&env);
        let error = fresh_access_token_with(&env, "openai").unwrap_err();
        assert_eq!(error, SIGN_IN_AGAIN);
        assert_clean(&error);
        let stored = load_record(&env, "openai").unwrap().unwrap();
        assert!(stored.client_id.is_empty());
        assert!(stored.access_token.is_empty());
        assert!(stored.refresh_token.is_empty());
    }

    #[test]
    fn a_keychain_write_is_retried_after_rotation() {
        let mock = Mock::start(Mode::Happy {
            scope: DIRECT_SCOPE.into(),
            delay_ms: 0,
        });
        let dir = tempfile::tempdir().unwrap();
        let keys = Keys::new();
        keys.fail_first_rotated.store(true, Ordering::SeqCst);
        let env = Env::in_dir_with(dir.path(), mock.endpoints(), Box::new(keys));
        signed_in(&env);
        expire_for_refresh(&env);
        assert_eq!(fresh_access_token_with(&env, "openai").unwrap(), ACCESS_2);
        assert_eq!(
            load_record(&env, "openai").unwrap().unwrap().refresh_token,
            REFRESH_2
        );
    }

    #[test]
    fn sign_out_succeeds_when_revoke_fails() {
        let mock = Mock::start(Mode::RevokeFails);
        let (_dir, env) = env_for(&mock);
        signed_in(&env);
        let status = sign_out_with(&env, "openai").unwrap();
        assert!(!status.revoked);
        assert!(!status.signed_in);
        assert!(env.read_account("openai:oauth").unwrap().is_none());
    }

    #[test]
    fn a_second_sign_in_reuses_the_issued_client_and_the_host() {
        let mock = Mock::start(Mode::Happy {
            scope: DIRECT_SCOPE.into(),
            delay_ms: 0,
        });
        let (_dir, env) = env_for(&mock);
        sign_in(
            &env,
            "openai",
            |url| {
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        let host = env.read_account("openai:oauth-host").unwrap().unwrap();
        sign_in(
            &env,
            "openai",
            |url| {
                assert!(url.contains(&format!("client_id={CLIENT}")));
                assert!(!url.contains("agent_name_hint"));
                assert!(!url.contains("id_token_hint="));
                assert!(url.contains("login_hint="));
                assert!(url.contains(&percent_encode(&host)));
                browser(url);
                true
            },
            Duration::from_secs(5),
        )
        .unwrap();
        assert_eq!(
            env.read_account("openai:oauth-host").unwrap().unwrap(),
            host
        );
    }
}
