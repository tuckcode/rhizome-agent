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
}

pub(crate) fn serve(responses: Vec<String>) -> TestServer {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&requests);
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
            loop {
                let mut header = String::new();
                reader.read_line(&mut header).unwrap();
                if header.trim().is_empty() {
                    break;
                }
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
            seen.lock()
                .unwrap()
                .push((target, String::from_utf8(body).unwrap()));
            stream.write_all(response.as_bytes()).unwrap();
        }
    });
    TestServer { base_url, requests }
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
