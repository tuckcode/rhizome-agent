//! Local HTTP server for provider tests. Test builds only.
//!
//! It binds `127.0.0.1:0`, so the OS picks a free port. Each connection has
//! a short read and write timeout, so a stuck test fails in seconds.

use std::io::{BufRead, BufReader, Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::HttpLimits;

const TEST_IO_LIMIT: Duration = Duration::from_secs(3);

/// Short client limits for tests. Production keeps `HttpLimits::STREAM` and
/// `HttpLimits::DISCOVER`.
pub(crate) const TEST_LIMITS: HttpLimits = HttpLimits {
    connect: Duration::from_secs(2),
    total: Duration::from_secs(5),
};

/// Answers each connection with the next canned response, then closes.
pub(crate) struct TestServer {
    pub(crate) base_url: String,
    /// "METHOD PATH" and the body of each request, in order.
    pub(crate) requests: Arc<Mutex<Vec<(String, String)>>>,
    /// The header lines of each request, lowercased, in order.
    pub(crate) headers: Arc<Mutex<Vec<String>>>,
}

pub(crate) fn serve(responses: Vec<String>) -> TestServer {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&requests);
    let headers = Arc::new(Mutex::new(Vec::new()));
    let seen_headers = Arc::clone(&headers);
    std::thread::spawn(move || {
        for response in responses {
            let Ok((mut stream, _)) = listener.accept() else {
                return;
            };
            // A stuck client ends this connection in seconds. The dropped
            // stream then fails the client side fast too.
            stream.set_read_timeout(Some(TEST_IO_LIMIT)).unwrap();
            stream.set_write_timeout(Some(TEST_IO_LIMIT)).unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut request_line = String::new();
            reader.read_line(&mut request_line).unwrap();
            let mut content_length = 0;
            let mut lines = String::new();
            loop {
                let mut header = String::new();
                reader.read_line(&mut header).unwrap();
                if header.trim().is_empty() {
                    break;
                }
                lines.push_str(&header.to_ascii_lowercase());
                if let Some(value) = header.to_ascii_lowercase().strip_prefix("content-length:") {
                    content_length = value.trim().parse().unwrap();
                }
            }
            let mut body = vec![0; content_length];
            reader.read_exact(&mut body).unwrap();
            let target = request_line
                .split_whitespace()
                .take(2)
                .collect::<Vec<_>>()
                .join(" ");
            seen_headers.lock().unwrap().push(lines);
            seen.lock()
                .unwrap()
                .push((target, String::from_utf8(body).unwrap()));
            // A client that drops the socket mid-stream must not kill the
            // rest of this canned sequence.
            let _ = stream.write_all(response.as_bytes());
        }
    });
    TestServer {
        base_url,
        requests,
        headers,
    }
}

/// Accepts one connection and never answers it.
pub(crate) fn serve_silent() -> String {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
    std::thread::spawn(move || {
        if let Ok((stream, _)) = listener.accept() {
            std::thread::sleep(Duration::from_secs(30));
            drop(stream);
        }
    });
    base_url
}

pub(crate) fn http_response(status: &str, headers: &[&str], body: &str) -> String {
    let mut response = format!("HTTP/1.1 {status}\r\nConnection: close\r\n");
    for header in headers {
        response.push_str(header);
        response.push_str("\r\n");
    }
    response.push_str("\r\n");
    response.push_str(body);
    response
}

pub(crate) fn sse(lines: &[&str]) -> String {
    let body = lines
        .iter()
        .map(|line| format!("data: {line}\n\n"))
        .collect::<String>();
    http_response("200 OK", &["Content-Type: text/event-stream"], &body)
}

pub(crate) fn json_response(status: &str, body: &str) -> String {
    http_response(status, &["Content-Type: application/json"], body)
}

/// Responses API SSE. Each JSON object is split across two `data:` lines
/// and dispatched only after the blank line, per the SSE spec.
pub(crate) fn responses_sse(events: &[&str]) -> String {
    let mut body = String::new();
    for event in events {
        let event_type = serde_json::from_str::<serde_json::Value>(event)
            .ok()
            .and_then(|value| {
                value
                    .get("type")
                    .and_then(|kind| kind.as_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| "message".to_string());
        body.push_str("event: ");
        body.push_str(&event_type);
        body.push('\n');
        // A newline between these lines is JSON whitespace, so the joined
        // payload is still one object.
        if let Some(rest) = event.strip_prefix('{') {
            body.push_str("data: {\n");
            body.push_str("data: ");
            body.push_str(rest);
        } else {
            body.push_str("data: ");
            body.push_str(event);
        }
        body.push_str("\n\n");
    }
    http_response("200 OK", &["Content-Type: text/event-stream"], &body)
}

/// Answers `count` connections. `respond` sees the request target and body.
pub(crate) fn serve_mapped<F>(count: usize, mut respond: F) -> TestServer
where
    F: FnMut(&str, &str) -> String + Send + 'static,
{
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&requests);
    let headers = Arc::new(Mutex::new(Vec::new()));
    let seen_headers = Arc::clone(&headers);
    std::thread::spawn(move || {
        for _ in 0..count {
            let Ok((mut stream, _)) = listener.accept() else {
                return;
            };
            stream.set_read_timeout(Some(TEST_IO_LIMIT)).unwrap();
            stream.set_write_timeout(Some(TEST_IO_LIMIT)).unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut request_line = String::new();
            if reader.read_line(&mut request_line).is_err() {
                return;
            }
            let mut content_length = 0usize;
            let mut lines = String::new();
            loop {
                let mut header = String::new();
                if reader.read_line(&mut header).is_err() {
                    return;
                }
                if header.trim().is_empty() {
                    break;
                }
                lines.push_str(&header.to_ascii_lowercase());
                if let Some(value) = header.to_ascii_lowercase().strip_prefix("content-length:") {
                    content_length = value.trim().parse().unwrap_or(0);
                }
            }
            let mut body = vec![0; content_length];
            if reader.read_exact(&mut body).is_err() {
                return;
            }
            let target = request_line
                .split_whitespace()
                .take(2)
                .collect::<Vec<_>>()
                .join(" ");
            let body = String::from_utf8(body).unwrap_or_default();
            seen_headers.lock().unwrap().push(lines);
            seen.lock().unwrap().push((target.clone(), body.clone()));
            let response = respond(&target, &body);
            let _ = stream.write_all(response.as_bytes());
        }
    });
    TestServer {
        base_url,
        requests,
        headers,
    }
}
