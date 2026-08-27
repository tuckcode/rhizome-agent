//! Rhizome skin for the Mycelium (Mindwalk) sidecar.
//!
//! Mindwalk themes itself through ~26 CSS custom properties and semantic
//! class names, **none of which are build-hashed** (verified 2026-08-26
//! against mindwalk serving 94 classes, 0 hashed). A stylesheet appended to
//! its `index.html` therefore survives an engine upgrade, which is the whole
//! point: Rhizome fronts the sidecar with a loopback proxy that passes every
//! byte through untouched *except* the HTML document, where it appends one
//! `<style>` block and renames the wordmark.
//!
//! Deliberately **not** a fork (ADR-0168: absorb contracts and artifacts,
//! never runtimes). The citymap engine stays Mindwalk's, upstream fixes
//! arrive for free, and the only thing Rhizome owns is the skin below. The
//! MIT notice stays in the view footer.
//!
//! Failure mode to watch: the risk is *renaming*, not rebuilding. If upstream
//! renames `--sky`, our override silently no-ops and that surface reverts to
//! Mindwalk's palette. `missing_skin_variables` reports that drift so it
//! shows up as a log line instead of a mystery.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::Duration;

/// Mindwalk custom properties this skin expects to override. Drift here is
/// what breaks the reskin, so it is asserted rather than assumed.
pub const EXPECTED_MINDWALK_VARS: &[&str] = &[
    "--sky",
    "--panel",
    "--panel-raised",
    "--hairline",
    "--hairline-strong",
    "--ink",
    "--muted",
    "--faint",
    "--act-read",
    "--act-edit",
    "--act-exec",
    "--act-search",
    "--act-verify",
    "--font-body",
    "--font-display",
];

/// The skin. Dark is the default; light is opt-in via `data-rhizome-theme`,
/// which the injected script sets from the `rzTheme` query parameter.
const SKIN_CSS: &str = r#"
/* Rhizome skin — engine is Mindwalk (MIT), only these tokens are ours. */
:root {
  --sky: #0E120C;
  --panel: #151A12;
  --panel-raised: #1B2117;
  --hairline: #232A1F;
  --hairline-strong: #333D2B;
  --ink: #E6EBE0;
  --muted: #ADB6A3;
  --faint: #79836F;
  --moss: #6FE3A0;
  --pine: #4FBF80;
  --moon: #8FEBB4;
  --amber: #E3C46F;
  --ember: #E39F6F;
  --alarm: #E36F6F;
  --act-read: #8FB4EB;
  --act-edit: #E3C46F;
  --act-exec: #79836F;
  --act-search: #6FD8E3;
  --act-verify: #6FE3A0;
  --mark-compaction: #E3806F;
  --mark-subagent: #B98FEB;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

html[data-rhizome-theme="light"] {
  --sky: #EFF1EC;
  --panel: #F7F8F5;
  --panel-raised: #FBFCFA;
  --hairline: #D6DBCF;
  --hairline-strong: #C2C9B8;
  --ink: #23281F;
  --muted: #4C5546;
  --faint: #97A08D;
  --moss: #2E6B4F;
  --pine: #38A169;
  --moon: #245741;
  --act-read: #3A6BA5;
  --act-edit: #9A7B1F;
  --act-exec: #77806E;
  --act-search: #1F7E8A;
  --act-verify: #2E6B4F;
  --alarm: #C03D30;
}

/* The wordmark is plain text in a semantic element, so it renames in CSS. */
h1.wordmark { font-size: 0; letter-spacing: 0; }
h1.wordmark::after {
  content: "Mycelium";
  font-size: 1.35rem;
  font-family: var(--font-display);
  letter-spacing: -0.01em;
  color: var(--ink);
}
"#;

/// Append the Rhizome skin to a Mindwalk HTML document.
///
/// Appends before `</head>` so it wins the cascade over the bundled
/// stylesheet. A document without a `</head>` still gets the skin rather
/// than silently rendering unstyled.
pub fn inject_skin(html: &str, theme: &str) -> String {
    let theme_attr = if theme == "light" { "light" } else { "dark" };
    let block = format!(
        "<style data-rhizome-skin=\"1\">{SKIN_CSS}</style>\
         <script data-rhizome-skin=\"1\">\
         document.documentElement.setAttribute('data-rhizome-theme','{theme_attr}');\
         document.title='Mycelium';\
         </script>"
    );
    match html.find("</head>") {
        Some(idx) => {
            let mut out = String::with_capacity(html.len() + block.len());
            out.push_str(&html[..idx]);
            out.push_str(&block);
            out.push_str(&html[idx..]);
            out
        }
        None => format!("{html}{block}"),
    }
}

/// Which expected Mindwalk variables are absent from its stylesheet.
///
/// Non-empty means upstream renamed something and part of the skin is now a
/// no-op. Reported, never fatal — a drifted skin is a cosmetic regression,
/// not a reason to refuse to show the view.
pub fn missing_skin_variables(upstream_css: &str) -> Vec<&'static str> {
    EXPECTED_MINDWALK_VARS
        .iter()
        .filter(|var| !upstream_css.contains(**var))
        .copied()
        .collect()
}

/// Parse the request target out of an HTTP/1.1 request line.
fn request_target(line: &str) -> Option<(String, String)> {
    let mut parts = line.split_whitespace();
    let method = parts.next()?.to_string();
    let target = parts.next()?.to_string();
    Some((method, target))
}

static PROXY: Mutex<Option<String>> = Mutex::new(None);

/// Start (or reuse) the skin proxy in front of `upstream`, returning its URL.
///
/// Binds port 0 so the OS picks a free port; the caller hands the returned
/// URL to the iframe instead of the sidecar's own. Mindwalk speaks plain
/// request/response — no WebSocket or SSE strings in the binary — so a
/// non-streaming proxy is sufficient.
pub fn start_skin_proxy(upstream: &str, theme: &str) -> Result<String, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Mycelium skin proxy could not bind: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Mycelium skin proxy has no address: {e}"))?
        .port();
    let url = format!("http://127.0.0.1:{port}");
    let upstream = upstream.trim_end_matches('/').to_string();
    let theme = theme.to_string();

    std::thread::spawn(move || {
        let client = match reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
        {
            Ok(client) => client,
            Err(error) => {
                log::warn!("mycelium skin proxy client failed: {error}");
                return;
            }
        };
        for stream in listener.incoming().flatten() {
            let upstream = upstream.clone();
            let theme = theme.clone();
            let client = client.clone();
            if let Err(error) = serve_one(stream, &client, &upstream, &theme) {
                log::debug!("mycelium skin proxy request failed: {error}");
            }
        }
    });

    let mut slot = PROXY
        .lock()
        .map_err(|_| "mycelium skin proxy lock poisoned".to_string())?;
    *slot = Some(url.clone());
    Ok(url)
}

fn serve_one(
    mut stream: TcpStream,
    client: &reqwest::blocking::Client,
    upstream: &str,
    theme: &str,
) -> Result<(), String> {
    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| e.to_string())?;
    let (method, target) = request_target(&request_line)
        .ok_or_else(|| format!("malformed request line: {request_line:?}"))?;

    // Drain headers so the socket is positioned at the body; only the
    // content length matters for the small POSTs Mindwalk's judge makes.
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).map_err(|e| e.to_string())? == 0 {
            break;
        }
        if line.trim().is_empty() {
            break;
        }
        if let Some(value) = line.to_ascii_lowercase().strip_prefix("content-length:") {
            content_length = value.trim().parse().unwrap_or(0);
        }
    }
    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body).map_err(|e| e.to_string())?;
    }

    let url = format!("{upstream}{target}");
    let request = match method.as_str() {
        "POST" => client.post(&url).body(body),
        "PUT" => client.put(&url).body(body),
        "DELETE" => client.delete(&url),
        "HEAD" => client.head(&url),
        _ => client.get(&url),
    };
    let response = request.send().map_err(|e| e.to_string())?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response.bytes().map_err(|e| e.to_string())?;

    let payload: Vec<u8> = if content_type.starts_with("text/html") {
        let html = String::from_utf8_lossy(&bytes);
        inject_skin(&html, theme).into_bytes()
    } else {
        bytes.to_vec()
    };

    let header = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        status.as_u16(),
        status.canonical_reason().unwrap_or("OK"),
        content_type,
        payload.len()
    );
    stream
        .write_all(header.as_bytes())
        .map_err(|e| e.to_string())?;
    stream.write_all(&payload).map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn injects_before_head_close() {
        let out = inject_skin(
            "<html><head><title>mindwalk</title></head><body></body></html>",
            "dark",
        );
        let style_at = out.find("data-rhizome-skin").expect("skin injected");
        let head_at = out.find("</head>").expect("head preserved");
        assert!(style_at < head_at, "skin must win the cascade");
        assert!(out.contains("--sky: #0E120C"));
    }

    #[test]
    fn injects_even_without_head() {
        let out = inject_skin("<html><body>no head</body></html>", "dark");
        assert!(out.contains("data-rhizome-skin"));
        assert!(out.contains("no head"), "original document is preserved");
    }

    #[test]
    fn light_theme_sets_the_attribute() {
        let out = inject_skin("<head></head>", "light");
        assert!(out.contains("'data-rhizome-theme','light'"));
    }

    #[test]
    fn unknown_theme_falls_back_to_dark() {
        let out = inject_skin("<head></head>", "banana");
        assert!(out.contains("'data-rhizome-theme','dark'"));
    }

    #[test]
    fn renames_the_wordmark_without_touching_the_engine() {
        let out = inject_skin("<head></head>", "dark");
        assert!(out.contains("content: \"Mycelium\""));
        assert!(out.contains("document.title='Mycelium'"));
    }

    #[test]
    fn reports_no_drift_when_every_variable_is_present() {
        let css = EXPECTED_MINDWALK_VARS.join(": x;");
        assert!(missing_skin_variables(&css).is_empty());
    }

    #[test]
    fn reports_drift_when_upstream_renames_a_variable() {
        let css = ":root{--panel:#000;--ink:#fff}";
        let missing = missing_skin_variables(css);
        assert!(missing.contains(&"--sky"));
        assert!(!missing.contains(&"--panel"));
    }

    #[test]
    fn parses_a_request_line() {
        let (method, target) = request_target("GET /api/sessions HTTP/1.1").expect("parsed");
        assert_eq!(method, "GET");
        assert_eq!(target, "/api/sessions");
    }

    #[test]
    fn rejects_a_malformed_request_line() {
        assert!(request_target("GET").is_none());
    }
}
