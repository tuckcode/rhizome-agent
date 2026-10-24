//! One-shot loopback callback on `127.0.0.1`.
//!
//! Any free port except 1455 (Codex's default). The path is `/auth/callback`.
//! The page after the browser returns says the tab can be closed. A `/cancel`
//! request, or the cancel flag, ends the wait. Other paths (a favicon) do not.

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

/// Codex binds this port. Rhizome must not.
pub(crate) const FORBIDDEN_PORT: u16 = 1455;

pub(crate) const CALLBACK_PATH: &str = "/auth/callback";

const CLOSE_PAGE: &str = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Rhizome</title></head><body><p>You can close this tab.</p></body></html>";
const ERROR_PAGE: &str = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Rhizome</title></head><body><p>Sign-in could not be verified.</p></body></html>";

pub(crate) struct Loopback {
    listener: TcpListener,
    pub port: u16,
}

pub(crate) struct Callback {
    pub params: BTreeMap<String, String>,
}

impl std::fmt::Debug for Callback {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut params = self.params.clone();
        for secret in ["code", "state"] {
            if params.contains_key(secret) {
                params.insert(secret.to_string(), "[redacted]".to_string());
            }
        }
        formatter
            .debug_struct("Callback")
            .field("params", &params)
            .finish()
    }
}

pub(crate) fn port_is_allowed(port: u16) -> bool {
    port != FORBIDDEN_PORT
}

impl Loopback {
    pub(crate) fn bind() -> Result<Self, String> {
        for _ in 0..8 {
            let listener = TcpListener::bind("127.0.0.1:0")
                .map_err(|_| "The sign-in callback could not be started.".to_string())?;
            let address = listener
                .local_addr()
                .map_err(|_| "The sign-in callback could not be started.".to_string())?;
            if !address.ip().is_loopback() || !port_is_allowed(address.port()) {
                drop(listener);
                continue;
            }
            return Ok(Self {
                listener,
                port: address.port(),
            });
        }
        Err("The sign-in callback could not be started.".into())
    }

    pub(crate) fn redirect_uri(&self) -> String {
        format!("http://127.0.0.1:{}{CALLBACK_PATH}", self.port)
    }

    /// Blocks until a callback whose state matches, a cancel, or `timeout`.
    /// A callback with a different state stays open.
    pub(crate) fn wait(
        self,
        timeout: Duration,
        cancel: &AtomicBool,
        expected_state: &str,
    ) -> Result<Callback, String> {
        self.listener
            .set_nonblocking(true)
            .map_err(|_| "The sign-in callback could not be started.".to_string())?;
        let deadline = Instant::now() + timeout;
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err("Sign-in was cancelled.".into());
            }
            if Instant::now() >= deadline {
                return Err("Sign-in timed out.".into());
            }
            match self.listener.accept() {
                Ok((stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
                    match handle_connection(stream, expected_state) {
                        Connection::KeepWaiting => {}
                        Connection::Callback(callback) => return Ok(callback),
                        Connection::Cancelled => return Err("Sign-in was cancelled.".into()),
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(20));
                }
                Err(_) => return Err("The sign-in callback could not be started.".into()),
            }
        }
    }
}

enum Connection {
    KeepWaiting,
    Callback(Callback),
    Cancelled,
}

fn handle_connection(mut stream: TcpStream, expected_state: &str) -> Connection {
    let mut buffer = [0u8; 8192];
    let Ok(read) = stream.read(&mut buffer) else {
        return Connection::KeepWaiting;
    };
    let text = String::from_utf8_lossy(&buffer[..read]);
    let Some(target) = request_target(&text) else {
        let _ = write_response(&mut stream, 400, CLOSE_PAGE);
        return Connection::KeepWaiting;
    };
    let path = target.split('?').next().unwrap_or(target);
    if path == "/favicon.ico" {
        let _ = write_response(&mut stream, 404, CLOSE_PAGE);
        return Connection::KeepWaiting;
    }
    if path == "/cancel" {
        let _ = write_response(&mut stream, 200, CLOSE_PAGE);
        return Connection::Cancelled;
    }
    if path != CALLBACK_PATH {
        let _ = write_response(&mut stream, 404, ERROR_PAGE);
        return Connection::KeepWaiting;
    }
    let params = query_params(target);
    let state = params.get("state").map(String::as_str).unwrap_or("");
    let state_ok = super::pkce::same_secret(state, expected_state);
    let finished =
        params.get("code").is_some_and(|code| !code.is_empty()) || params.contains_key("error");
    if !state_ok || !finished {
        let _ = write_response(&mut stream, 400, ERROR_PAGE);
        return Connection::KeepWaiting;
    }
    let _ = write_response(&mut stream, 200, CLOSE_PAGE);
    Connection::Callback(Callback { params })
}

fn request_target(request: &str) -> Option<&str> {
    let mut parts = request.lines().next()?.split_whitespace();
    let _method = parts.next()?;
    parts.next()
}

fn query_params(target: &str) -> BTreeMap<String, String> {
    let Some(query) = target.split_once('?').map(|(_, query)| query) else {
        return BTreeMap::new();
    };
    query
        .split('&')
        .filter_map(|pair| {
            let (name, value) = pair.split_once('=').unwrap_or((pair, ""));
            let name = percent_decode(name.as_bytes());
            if name.is_empty() {
                None
            } else {
                Some((name, percent_decode(value.as_bytes())))
            }
        })
        .collect()
}

fn percent_decode(bytes: &[u8]) -> String {
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'+' {
            out.push(b' ');
            index += 1;
            continue;
        }
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = [bytes[index + 1], bytes[index + 2]];
            if hex.iter().all(u8::is_ascii_hexdigit) {
                let text = [hex[0] as char, hex[1] as char];
                let text: String = text.iter().collect();
                if let Ok(byte) = u8::from_str_radix(&text, 16) {
                    out.push(byte);
                    index += 3;
                    continue;
                }
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn write_response(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let reason = if status == 200 { "OK" } else { "Not Found" };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(body.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;

    #[test]
    fn the_listener_is_loopback_and_never_1455() {
        assert!(!port_is_allowed(FORBIDDEN_PORT));
        assert!(port_is_allowed(1456));
        let loopback = Loopback::bind().unwrap();
        assert_ne!(loopback.port, FORBIDDEN_PORT);
        assert!(loopback.redirect_uri().starts_with("http://127.0.0.1:"));
        assert!(loopback.redirect_uri().ends_with("/auth/callback"));
        assert!(!loopback.redirect_uri().contains("localhost"));
    }

    #[test]
    fn the_callback_page_says_the_tab_can_close() {
        let loopback = Loopback::bind().unwrap();
        let uri = loopback.redirect_uri();
        let cancel = Arc::new(AtomicBool::new(false));
        let handle = thread::spawn(move || loopback.wait(Duration::from_secs(2), &cancel, "two"));
        let page = reqwest::blocking::get(format!("{uri}?code=one&state=two"))
            .unwrap()
            .text()
            .unwrap();
        let callback = handle.join().unwrap().unwrap();
        assert!(page.contains("You can close this tab."));
        assert!(!page.contains("one"));
        assert_eq!(callback.params.get("code").map(String::as_str), Some("one"));
        assert_eq!(
            callback.params.get("state").map(String::as_str),
            Some("two")
        );
    }

    #[test]
    fn cancel_request_ends_the_wait() {
        let loopback = Loopback::bind().unwrap();
        let port = loopback.port;
        let cancel = Arc::new(AtomicBool::new(false));
        let handle =
            thread::spawn(move || loopback.wait(Duration::from_secs(2), &cancel, "unused"));
        let page = reqwest::blocking::get(format!("http://127.0.0.1:{port}/cancel"))
            .unwrap()
            .text()
            .unwrap();
        let error = handle.join().unwrap().unwrap_err();
        assert!(page.contains("You can close this tab."));
        assert_eq!(error, "Sign-in was cancelled.");
    }

    #[test]
    fn the_wait_times_out() {
        let loopback = Loopback::bind().unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        let error = loopback
            .wait(Duration::from_millis(80), &cancel, "unused")
            .unwrap_err();
        assert_eq!(error, "Sign-in timed out.");
    }

    #[test]
    fn the_cancel_flag_ends_the_wait() {
        let loopback = Loopback::bind().unwrap();
        let cancel = Arc::new(AtomicBool::new(true));
        let error = loopback
            .wait(Duration::from_secs(2), &cancel, "unused")
            .unwrap_err();
        assert_eq!(error, "Sign-in was cancelled.");
    }

    #[test]
    fn a_wrong_state_stays_open_and_non_ascii_decoding_does_not_panic() {
        assert_eq!(percent_decode(b"%C3%A9"), "é");
        let mixed = b"a%\xC3\xA9";
        assert_eq!(percent_decode(mixed), "a%\u{00e9}");

        let loopback = Loopback::bind().unwrap();
        let uri = loopback.redirect_uri();
        let cancel = Arc::new(AtomicBool::new(false));
        let handle = thread::spawn(move || loopback.wait(Duration::from_secs(2), &cancel, "good"));
        let bad = reqwest::blocking::get(format!("{uri}?code=secret-code&state=bad"))
            .unwrap()
            .text()
            .unwrap();
        assert!(bad.contains("could not be verified"));
        assert!(!bad.contains("You can close this tab."));
        assert!(!bad.contains("secret-code"));
        let good = reqwest::blocking::get(format!("{uri}?code=one&state=good"))
            .unwrap()
            .text()
            .unwrap();
        assert!(good.contains("You can close this tab."));
        let callback = handle.join().unwrap().unwrap();
        let rendered = format!("{callback:?}");
        assert!(!rendered.contains("one"));
        assert!(!rendered.contains("good"));
        assert!(rendered.contains("[redacted]"));
    }
}
