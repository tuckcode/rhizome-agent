//! xAI sign-in preview (ADR-0186, decision 3).
//!
//! xAI publishes no client registration, so this uses the public client id
//! that the Grok CLI and open-source agents share. The id is a setting. The
//! sign-in uses the device-code grant from `auth.x.ai` (RFC 8628): the system
//! browser opens xAI's approval page and Rhizome polls for the tokens.
//! Discovery on 2026-11-01 listed these endpoints. OpenCode and Hermes use
//! the same grant.
//!
//! `referrer` names Rhizome. Rhizome is never presented as another product.

use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use serde::Deserialize;

use super::openai::{split_scopes, Attempt, RefreshFail, RefreshTokens};
use super::{save_record, scrub, set_provider_enabled, unix_now, Env, OauthStatus, Record};

pub(crate) const PROVIDER_ID: &str = "xai";
pub(crate) const ISSUER: &str = "https://auth.x.ai";
pub(crate) const DEFAULT_CLIENT_ID: &str = "b1a00492-073a-47ea-816f-4c329264a828";
pub(crate) const API_SCOPE: &str = "api:access";
pub(crate) const NO_ACCESS: &str =
    "xAI does not allow API access for this account. Sign out of xAI, then add an xAI API key.";
pub(crate) const NOT_USABLE: &str = "xAI sign-in did not grant API access. Add an xAI API key.";
const SCOPES: &str = "openid profile email offline_access grok-cli:access api:access";
const REFERRER: &str = "rhizome";
const DEVICE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";
const DEFAULT_INTERVAL_SECS: u64 = 5;
const SLOW_DOWN_STEP_SECS: u64 = 5;
const COMPLETE_FAILED: &str = "Sign-in could not be completed.";

#[derive(Clone)]
pub(crate) struct Endpoints {
    pub device: String,
    pub token: String,
    pub userinfo: String,
    pub revoke: String,
}

impl Endpoints {
    pub(super) fn production() -> Self {
        Self {
            device: format!("{ISSUER}/oauth2/device/code"),
            token: format!("{ISSUER}/oauth2/token"),
            userinfo: format!("{ISSUER}/oauth2/userinfo"),
            revoke: format!("{ISSUER}/oauth2/revoke"),
        }
    }

    #[cfg(test)]
    pub(super) fn offline() -> Self {
        Self {
            device: "http://127.0.0.1:9/device".into(),
            token: "http://127.0.0.1:9/token".into(),
            userinfo: "http://127.0.0.1:9/userinfo".into(),
            revoke: "http://127.0.0.1:9/revoke".into(),
        }
    }
}

/// `show_code` receives the short code so the person can compare it with the
/// browser page. `open_url` opens the system browser.
pub(super) fn sign_in(
    env: &Env,
    open_url: impl FnOnce(&str) -> bool,
    show_code: impl FnOnce(&str),
    timeout: Duration,
) -> Result<OauthStatus, String> {
    let flag = super::openai::begin_attempt(env)?;
    let _attempt = Attempt::new(env);
    let client_id =
        super::client_id_setting(env, PROVIDER_ID).unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string());
    let device = request_device_code(env, &client_id)?;
    let page = approval_page(&device)?;
    show_code(&device.user_code);
    if !open_url(&page) {
        return Err("The sign-in page could not be opened.".into());
    }
    let lifetime = device
        .expires_in
        .filter(|seconds| *seconds > 0)
        .map_or(timeout, Duration::from_secs)
        .min(timeout);
    let tokens = poll_for_tokens(env, &device, &client_id, lifetime, &flag)
        .map_err(|error| scrub(&error, &[device.device_code.as_str()]))?;
    let identity = load_identity(env, &tokens.access_token);
    let scopes = split_scopes(tokens.scope.as_deref().unwrap_or(SCOPES));
    let usable = scopes.iter().any(|scope| scope == API_SCOPE);
    let now = unix_now();
    let record = Record {
        email: identity.email,
        issuer: ISSUER.into(),
        subject: identity.sub,
        client_id,
        ext_agent_host_id: String::new(),
        id_token: String::new(),
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
        save_record(env, PROVIDER_ID, &record)?;
        set_provider_enabled(env, PROVIDER_ID, usable)?;
    }
    if !usable {
        return Err(NOT_USABLE.into());
    }
    super::status_of(env, PROVIDER_ID)
}

pub(super) fn refresh(env: &Env, record: &Record) -> Result<RefreshTokens, RefreshFail> {
    let response = env
        .http
        .post(&env.xai_endpoints.token)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", record.client_id.as_str()),
            ("refresh_token", record.refresh_token.as_str()),
        ])
        .send()
        .map_err(|_| RefreshFail::Temporary)?;
    let status = response.status();
    if status == reqwest::StatusCode::FORBIDDEN {
        return Err(RefreshFail::NoAccess);
    }
    if !status.is_success() {
        let code = error_code(response);
        if super::openai::unusable_refresh(&code) {
            return Err(RefreshFail::Again(Box::new(record.cleared())));
        }
        return Err(RefreshFail::Temporary);
    }
    let body: TokenBody = response.json().map_err(|_| RefreshFail::Temporary)?;
    Ok(RefreshTokens {
        access_token: body.access_token,
        refresh_token: body.refresh_token.filter(|token| !token.is_empty()),
        id_token: String::new(),
        expires_in: body.expires_in,
        scope: body.scope,
    })
}

pub(super) fn revoke(env: &Env, record: &Record) -> Result<(), ()> {
    let response = env
        .http
        .post(&env.xai_endpoints.revoke)
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
        Err(())
    }
}

fn request_device_code(env: &Env, client_id: &str) -> Result<DeviceCode, String> {
    let response = env
        .http
        .post(&env.xai_endpoints.device)
        .form(&[
            ("client_id", client_id),
            ("scope", SCOPES),
            ("referrer", REFERRER),
        ])
        .send()
        .map_err(|_| COMPLETE_FAILED.to_string())?;
    let status = response.status();
    if status == reqwest::StatusCode::FORBIDDEN {
        return Err(NO_ACCESS.into());
    }
    if !status.is_success() {
        return Err(COMPLETE_FAILED.into());
    }
    response.json().map_err(|_| COMPLETE_FAILED.to_string())
}

/// The page comes from a server reply, so only an xAI https address opens.
fn approval_page(device: &DeviceCode) -> Result<String, String> {
    let page = device
        .verification_uri_complete
        .as_deref()
        .unwrap_or(device.verification_uri.as_str());
    let host = reqwest::Url::parse(page)
        .ok()
        .filter(|url| url.scheme() == "https")
        .and_then(|url| url.host_str().map(str::to_ascii_lowercase));
    match host {
        Some(host) if host == "x.ai" || host.ends_with(".x.ai") => Ok(page.to_string()),
        _ => Err("Sign-in could not be verified.".into()),
    }
}

fn poll_for_tokens(
    env: &Env,
    device: &DeviceCode,
    client_id: &str,
    lifetime: Duration,
    cancel: &std::sync::atomic::AtomicBool,
) -> Result<TokenBody, String> {
    let deadline = Instant::now() + lifetime;
    let mut interval = device.interval.unwrap_or(DEFAULT_INTERVAL_SECS).max(1);
    loop {
        wait_for_next_poll(Duration::from_secs(interval), deadline, cancel)?;
        let response = env
            .http
            .post(&env.xai_endpoints.token)
            .form(&[
                ("grant_type", DEVICE_GRANT),
                ("client_id", client_id),
                ("device_code", device.device_code.as_str()),
            ])
            .send();
        let Ok(response) = response else {
            // A network failure can pass. The deadline ends the wait.
            continue;
        };
        let status = response.status();
        if status == reqwest::StatusCode::FORBIDDEN {
            return Err(NO_ACCESS.into());
        }
        if status.is_success() {
            return valid_tokens(response);
        }
        match error_code(response).as_str() {
            "authorization_pending" => {}
            "slow_down" => interval += SLOW_DOWN_STEP_SECS,
            "access_denied" => return Err("Sign-in was declined.".into()),
            "expired_token" => return Err("Sign-in timed out.".into()),
            _ => return Err(COMPLETE_FAILED.into()),
        }
    }
}

fn wait_for_next_poll(
    wait: Duration,
    deadline: Instant,
    cancel: &std::sync::atomic::AtomicBool,
) -> Result<(), String> {
    let wake = Instant::now() + wait;
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err("Sign-in was cancelled.".into());
        }
        let now = Instant::now();
        if now >= deadline {
            return Err("Sign-in timed out.".into());
        }
        if now >= wake {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn valid_tokens(response: reqwest::blocking::Response) -> Result<TokenBody, String> {
    let body: TokenBody = response.json().map_err(|_| COMPLETE_FAILED.to_string())?;
    if body.access_token.is_empty() || body.refresh_token.as_deref().unwrap_or("").is_empty() {
        return Err(COMPLETE_FAILED.into());
    }
    Ok(body)
}

/// The email is only a label, so a failed lookup does not end the sign-in.
fn load_identity(env: &Env, access_token: &str) -> UserInfo {
    env.http
        .get(&env.xai_endpoints.userinfo)
        .bearer_auth(access_token)
        .send()
        .ok()
        .filter(|response| response.status().is_success())
        .and_then(|response| response.json().ok())
        .unwrap_or_default()
}

fn error_code(response: reqwest::blocking::Response) -> String {
    response
        .json::<ErrorBody>()
        .ok()
        .and_then(|body| body.error)
        .unwrap_or_default()
}

#[derive(Deserialize)]
struct DeviceCode {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default)]
    verification_uri_complete: Option<String>,
    #[serde(default)]
    expires_in: Option<u64>,
    #[serde(default)]
    interval: Option<u64>,
}

#[derive(Deserialize)]
struct TokenBody {
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    token_type: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
    #[serde(default)]
    scope: Option<String>,
}

#[derive(Default, Deserialize)]
struct UserInfo {
    #[serde(default)]
    sub: String,
    #[serde(default)]
    email: Option<String>,
}

#[derive(Deserialize)]
struct ErrorBody {
    error: Option<String>,
}

#[cfg(test)]
mod tests {
    use std::io::{Read, Write};
    use std::sync::atomic::{AtomicBool, AtomicUsize};
    use std::sync::{Arc, Mutex};

    use super::*;
    use crate::provider_oauth::{
        fresh_access_token_with, provider_is_signed_in_with, sign_out_with, SIGN_IN_AGAIN,
    };

    const ACCESS: &str = "xai-secret-access";
    const REFRESH: &str = "xai-secret-refresh";
    const DEVICE: &str = "xai-secret-device";

    type Reply = (u16, String);

    /// Answers each request by path from a script of replies.
    struct Mock {
        base: String,
        requests: Arc<Mutex<Vec<(String, String)>>>,
    }

    impl Mock {
        fn start(script: Vec<(&'static str, Reply)>) -> Self {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let base = format!("http://{}", listener.local_addr().unwrap());
            let requests = Arc::new(Mutex::new(Vec::new()));
            let seen = Arc::clone(&requests);
            let script = Arc::new(Mutex::new(script));
            std::thread::spawn(move || {
                for stream in listener.incoming() {
                    let Ok(mut stream) = stream else { return };
                    let (path, body) = read_request(&mut stream);
                    seen.lock().unwrap().push((path.clone(), body));
                    let (status, reply) = next_reply(&script, &path);
                    let _ = write!(
                        stream,
                        "HTTP/1.1 {status} X\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{reply}",
                        reply.len()
                    );
                }
            });
            Self { base, requests }
        }

        fn endpoints(&self) -> Endpoints {
            Endpoints {
                device: format!("{}/device", self.base),
                token: format!("{}/token", self.base),
                userinfo: format!("{}/userinfo", self.base),
                revoke: format!("{}/revoke", self.base),
            }
        }

        fn body_of(&self, path: &str) -> String {
            self.requests
                .lock()
                .unwrap()
                .iter()
                .find(|(seen, _)| seen == path)
                .map(|(_, body)| body.clone())
                .unwrap_or_default()
        }
    }

    fn read_request(stream: &mut std::net::TcpStream) -> (String, String) {
        let mut data = Vec::new();
        let mut buffer = [0u8; 4096];
        loop {
            let read = stream.read(&mut buffer).unwrap_or(0);
            data.extend_from_slice(&buffer[..read]);
            let text = String::from_utf8_lossy(&data).to_string();
            if let Some((head, body)) = text.split_once("\r\n\r\n") {
                let length = head
                    .lines()
                    .find_map(|line| {
                        let lower = line.to_ascii_lowercase();
                        lower
                            .strip_prefix("content-length: ")
                            .and_then(|value| value.parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                if body.len() >= length || read == 0 {
                    let path = head.split_whitespace().nth(1).unwrap_or("").to_string();
                    return (path, body.to_string());
                }
            }
            if read == 0 {
                return (String::new(), String::new());
            }
        }
    }

    fn next_reply(script: &Mutex<Vec<(&'static str, Reply)>>, path: &str) -> Reply {
        let mut script = script.lock().unwrap();
        match script.iter().position(|(seen, _)| *seen == path) {
            Some(index) => script.remove(index).1,
            None => (404, "{}".to_string()),
        }
    }

    fn device_reply() -> (&'static str, Reply) {
        (
            "/device",
            (
                200,
                format!(
                    r#"{{"device_code":"{DEVICE}","user_code":"ABCD-1234","verification_uri":"https://accounts.x.ai/oauth2/device","verification_uri_complete":"https://accounts.x.ai/oauth2/device?user_code=ABCD-1234","expires_in":60,"interval":0}}"#
                ),
            ),
        )
    }

    fn tokens_reply(scope: &str) -> (&'static str, Reply) {
        (
            "/token",
            (
                200,
                format!(
                    r#"{{"access_token":"{ACCESS}","refresh_token":"{REFRESH}","token_type":"Bearer","expires_in":3600,"scope":"{scope}"}}"#
                ),
            ),
        )
    }

    fn error_reply(status: u16, code: &str) -> (&'static str, Reply) {
        ("/token", (status, format!(r#"{{"error":"{code}"}}"#)))
    }

    fn env_for(dir: &std::path::Path, mock: &Mock) -> Env {
        let mut env = Env::in_dir(dir, crate::provider_oauth::openai::Endpoints::offline());
        env.xai_endpoints = mock.endpoints();
        env
    }

    fn run_sign_in(env: &Env) -> (Result<OauthStatus, String>, String, String) {
        let opened = Mutex::new(String::new());
        let shown = Mutex::new(String::new());
        let result = sign_in(
            env,
            |url| {
                *opened.lock().unwrap() = url.to_string();
                true
            },
            |code| *shown.lock().unwrap() = code.to_string(),
            Duration::from_secs(10),
        );
        let opened = opened.lock().unwrap().clone();
        let shown = shown.lock().unwrap().clone();
        (result, opened, shown)
    }

    fn scripted(script: Vec<(&'static str, Reply)>) -> (Mock, tempfile::TempDir) {
        (Mock::start(script), tempfile::tempdir().unwrap())
    }

    fn happy_script() -> Vec<(&'static str, Reply)> {
        vec![
            device_reply(),
            error_reply(400, "authorization_pending"),
            tokens_reply("openid email offline_access api:access"),
            (
                "/userinfo",
                (200, r#"{"sub":"user-1","email":"ada@example.com"}"#.into()),
            ),
        ]
    }

    #[test]
    fn device_sign_in_saves_the_account_and_shows_the_code() {
        let (mock, dir) = scripted(happy_script());
        let env = env_for(dir.path(), &mock);
        let (result, opened, shown) = run_sign_in(&env);
        let status = result.unwrap();
        assert!(status.signed_in && status.usable && status.enabled);
        assert_eq!(status.email.as_deref(), Some("ada@example.com"));
        assert_eq!(
            opened,
            "https://accounts.x.ai/oauth2/device?user_code=ABCD-1234"
        );
        assert_eq!(shown, "ABCD-1234");
        let device = mock.body_of("/device");
        assert!(device.contains(&format!("client_id={DEFAULT_CLIENT_ID}")));
        assert!(device.contains("referrer=rhizome"));
        assert!(device.contains("api%3Aaccess"));
        assert!(mock.body_of("/token").contains("device_code"));
        assert!(provider_is_signed_in_with(&env, PROVIDER_ID));
        assert_eq!(fresh_access_token_with(&env, PROVIDER_ID).unwrap(), ACCESS);
    }

    #[test]
    fn the_client_id_setting_replaces_the_default() {
        let (mock, dir) = scripted(happy_script());
        let env = env_for(dir.path(), &mock);
        std::fs::write(
            dir.path().join(crate::provider_oauth::SETTINGS_FILE),
            r#"{"client_ids":{"xai":"rhizome-own-client"}}"#,
        )
        .unwrap();
        run_sign_in(&env).0.unwrap();
        assert!(mock
            .body_of("/device")
            .contains("client_id=rhizome-own-client"));
        let record = crate::provider_oauth::load_record(&env, PROVIDER_ID)
            .unwrap()
            .unwrap();
        assert_eq!(record.client_id, "rhizome-own-client");
    }

    #[test]
    fn enabling_a_provider_keeps_the_client_id_setting() {
        let (mock, dir) = scripted(vec![]);
        let env = env_for(dir.path(), &mock);
        std::fs::write(
            dir.path().join(crate::provider_oauth::SETTINGS_FILE),
            r#"{"client_ids":{"xai":"rhizome-own-client"}}"#,
        )
        .unwrap();
        crate::provider_oauth::set_provider_enabled(&env, PROVIDER_ID, true).unwrap();
        assert_eq!(
            crate::provider_oauth::client_id_setting(&env, PROVIDER_ID).as_deref(),
            Some("rhizome-own-client")
        );
    }

    #[test]
    fn a_403_at_the_token_step_says_the_account_has_no_access() {
        let (mock, dir) = scripted(vec![device_reply(), error_reply(403, "access_denied")]);
        let env = env_for(dir.path(), &mock);
        let error = run_sign_in(&env).0.unwrap_err();
        assert_eq!(error, NO_ACCESS);
        assert!(error.contains("API key"));
        assert!(!provider_is_signed_in_with(&env, PROVIDER_ID));
    }

    #[test]
    fn a_403_at_the_device_step_says_the_account_has_no_access() {
        let (mock, dir) = scripted(vec![("/device", (403, "{}".into()))]);
        let env = env_for(dir.path(), &mock);
        assert_eq!(run_sign_in(&env).0.unwrap_err(), NO_ACCESS);
    }

    #[test]
    fn a_grant_without_api_access_is_not_usable() {
        let (mock, dir) = scripted(vec![device_reply(), tokens_reply("openid email")]);
        let env = env_for(dir.path(), &mock);
        assert_eq!(run_sign_in(&env).0.unwrap_err(), NOT_USABLE);
        assert!(!provider_is_signed_in_with(&env, PROVIDER_ID));
    }

    #[test]
    fn declined_and_expired_codes_have_their_own_words() {
        for (code, message) in [
            ("access_denied", "Sign-in was declined."),
            ("expired_token", "Sign-in timed out."),
        ] {
            let (mock, dir) = scripted(vec![device_reply(), error_reply(400, code)]);
            let env = env_for(dir.path(), &mock);
            assert_eq!(run_sign_in(&env).0.unwrap_err(), message);
        }
    }

    #[test]
    fn slow_down_keeps_polling() {
        let mut script = happy_script();
        script[1] = error_reply(400, "slow_down");
        let (mock, dir) = scripted(script);
        let env = env_for(dir.path(), &mock);
        let started = Instant::now();
        run_sign_in(&env).0.unwrap();
        assert!(started.elapsed() >= Duration::from_secs(SLOW_DOWN_STEP_SECS));
    }

    #[test]
    fn a_page_outside_xai_never_opens() {
        let (mock, dir) = scripted(vec![(
            "/device",
            (
                200,
                r#"{"device_code":"d","user_code":"u","verification_uri":"https://evil.example/x.ai","expires_in":60,"interval":0}"#
                    .into(),
            ),
        )]);
        let env = env_for(dir.path(), &mock);
        let (result, opened, _) = run_sign_in(&env);
        assert_eq!(result.unwrap_err(), "Sign-in could not be verified.");
        assert!(opened.is_empty());
    }

    #[test]
    fn a_browser_that_does_not_open_ends_the_attempt() {
        let (mock, dir) = scripted(vec![device_reply()]);
        let env = env_for(dir.path(), &mock);
        let error = sign_in(&env, |_| false, |_| {}, Duration::from_secs(5)).unwrap_err();
        assert_eq!(error, "The sign-in page could not be opened.");
        assert!(crate::provider_oauth::openai::begin_attempt(&env).is_ok());
    }

    #[test]
    fn cancel_ends_the_wait() {
        let script = vec![
            device_reply(),
            error_reply(400, "authorization_pending"),
            error_reply(400, "authorization_pending"),
        ];
        let (mock, dir) = scripted(script);
        let env = Arc::new(env_for(dir.path(), &mock));
        let polls = Arc::new(AtomicUsize::new(0));
        let canceller = Arc::clone(&env);
        let seen = Arc::clone(&polls);
        let thread = std::thread::spawn(move || {
            while seen.load(Ordering::SeqCst) == 0 {
                std::thread::sleep(Duration::from_millis(5));
            }
            canceller.cancel();
        });
        let error = sign_in(
            &env,
            |_| {
                polls.fetch_add(1, Ordering::SeqCst);
                true
            },
            |_| {},
            Duration::from_secs(10),
        )
        .unwrap_err();
        thread.join().unwrap();
        assert_eq!(error, "Sign-in was cancelled.");
    }

    #[test]
    fn the_wait_ends_at_the_deadline() {
        let cancel = AtomicBool::new(false);
        let error = wait_for_next_poll(
            Duration::from_secs(5),
            Instant::now() + Duration::from_millis(30),
            &cancel,
        )
        .unwrap_err();
        assert_eq!(error, "Sign-in timed out.");
    }

    fn signed_in_env(dir: &std::path::Path, mock: &Mock, expires_at: i64) -> Env {
        let env = env_for(dir, mock);
        let record = Record {
            email: Some("ada@example.com".into()),
            issuer: ISSUER.into(),
            subject: "user-1".into(),
            client_id: DEFAULT_CLIENT_ID.into(),
            ext_agent_host_id: String::new(),
            id_token: String::new(),
            access_token: ACCESS.into(),
            refresh_token: REFRESH.into(),
            token_type: "Bearer".into(),
            expires_at,
            scopes: vec![API_SCOPE.into()],
            usable: true,
            saved_at: unix_now(),
        };
        save_record(&env, PROVIDER_ID, &record).unwrap();
        set_provider_enabled(&env, PROVIDER_ID, true).unwrap();
        env
    }

    #[test]
    fn an_expiring_token_refreshes_without_a_resource_field() {
        let (mock, dir) = scripted(vec![(
            "/token",
            (
                200,
                r#"{"access_token":"xai-next-access","refresh_token":"xai-next-refresh","expires_in":3600}"#
                    .into(),
            ),
        )]);
        let env = signed_in_env(dir.path(), &mock, unix_now() + 10);
        assert_eq!(
            fresh_access_token_with(&env, PROVIDER_ID).unwrap(),
            "xai-next-access"
        );
        let body = mock.body_of("/token");
        assert!(body.contains("grant_type=refresh_token"));
        assert!(!body.contains("resource"));
        let record = crate::provider_oauth::load_record(&env, PROVIDER_ID)
            .unwrap()
            .unwrap();
        assert_eq!(record.refresh_token, "xai-next-refresh");
    }

    #[test]
    fn a_403_on_refresh_says_no_access_and_keeps_the_record() {
        let (mock, dir) = scripted(vec![error_reply(403, "forbidden")]);
        let env = signed_in_env(dir.path(), &mock, unix_now() + 10);
        assert_eq!(
            fresh_access_token_with(&env, PROVIDER_ID).unwrap_err(),
            NO_ACCESS
        );
        let record = crate::provider_oauth::load_record(&env, PROVIDER_ID)
            .unwrap()
            .unwrap();
        assert_eq!(record.refresh_token, REFRESH);
    }

    #[test]
    fn invalid_grant_on_refresh_says_sign_in_again() {
        let (mock, dir) = scripted(vec![error_reply(400, "invalid_grant")]);
        let env = signed_in_env(dir.path(), &mock, unix_now() + 10);
        assert_eq!(
            fresh_access_token_with(&env, PROVIDER_ID).unwrap_err(),
            SIGN_IN_AGAIN
        );
    }

    #[test]
    fn sign_out_revokes_at_xai_and_clears_the_account() {
        let (mock, dir) = scripted(vec![("/revoke", (200, "{}".into()))]);
        let env = signed_in_env(dir.path(), &mock, unix_now() + 3600);
        let status = sign_out_with(&env, PROVIDER_ID).unwrap();
        assert!(status.revoked && !status.signed_in && !status.enabled);
        assert!(mock.body_of("/revoke").contains(REFRESH));
    }

    #[test]
    fn errors_and_debug_output_hold_no_tokens() {
        let (mock, dir) = scripted(vec![device_reply(), error_reply(403, ACCESS)]);
        let env = env_for(dir.path(), &mock);
        let error = run_sign_in(&env).0.unwrap_err();
        for secret in [ACCESS, REFRESH, DEVICE] {
            assert!(!error.contains(secret));
        }
    }
}
