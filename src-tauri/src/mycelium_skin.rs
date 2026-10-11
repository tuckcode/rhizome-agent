//! Rhizome skin for the Mycelium (Mindwalk) sidecar.
//!
//! Mindwalk themes itself through ~26 CSS custom properties and semantic
//! class names, **none of which are build-hashed** (verified 2026-08-26
//! against mindwalk serving 94 classes, 0 hashed). A stylesheet appended to
//! its `index.html` therefore survives an engine upgrade, which is the whole
//! point: Rhizome fronts the sidecar with a loopback proxy that passes every
//! byte through untouched *except* the HTML document, where it appends one
//! `<style>` block and renames the wordmark, and Evaluate JSON (`/report`,
//! `/analyze`), where it replaces a raw CLI dump with the useful sentence
//! and offers both Mindwalk judges.
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

use crate::mycelium_judge::{
    detect_mindwalk_judges, inject_evaluate_chrome, is_evaluate_json_path, rewrite_evaluate_payload,
};
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

/// Dark city tokens. The 3D canvas samples `:root` at startup, so these must
/// live on `:root` itself — not on a later `html[data-rhizome-theme]` rule.
const DARK_TOKENS: &str = r#"
:root {
  --sky: #0F110C;
  --panel: #16170F;
  --panel-raised: #1C1D14;
  --hairline: #2A281D;
  --hairline-strong: #3B3828;
  --ink: #E9E8DC;
  --muted: #999784;
  --faint: #8F8D7B;
  --moss: #6FE3A0;
  --pine: #9BCF7E;
  --moon: #8FEBB4;
  --amber: #E9B04F;
  --ember: #E5B171;
  --alarm: #EE8B7E;
  --act-read: #8FBEDB;
  --act-edit: #E9B04F;
  --act-exec: #8F8D7B;
  --act-search: #8FBEDB;
  --act-verify: #6FE3A0;
  --mark-compaction: #EE8B7E;
  --mark-subagent: #C3B2F0;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
"#;

const LIGHT_TOKENS: &str = r#"
:root {
  --sky: #F1ECE2;
  --panel: #F8F5EE;
  --panel-raised: #FCFAF6;
  --hairline: #DDD4C3;
  --hairline-strong: #C8BDA8;
  --ink: #2A251E;
  --muted: #625A4D;
  --faint: #6B6354;
  --moss: #2C6A4D;
  --pine: #3D6A1E;
  --moon: #22573F;
  --amber: #8A5208;
  --ember: #9E4A27;
  --alarm: #A3342A;
  --act-read: #286C68;
  --act-edit: #8A5208;
  --act-exec: #6B6354;
  --act-search: #286C68;
  --act-verify: #2C6A4D;
  --mark-compaction: #A3342A;
  --mark-subagent: #714EB2;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
"#;

/// Wordmark rename. Shared across themes.
const SKIN_CHROME: &str = r#"
h1.wordmark { font-size: 0; letter-spacing: 0; }
h1.wordmark::after {
  content: "Mycelium";
  font-size: 1.35rem;
  font-family: var(--font-display);
  letter-spacing: -0.01em;
  color: var(--ink);
}
"#;

fn skin_css(theme: &str) -> String {
    let tokens = if theme == "light" {
        LIGHT_TOKENS
    } else {
        DARK_TOKENS
    };
    format!("/* Rhizome skin — engine is Mindwalk (MIT), only these tokens are ours. */{tokens}{SKIN_CHROME}")
}

/// Append the Rhizome skin to a Mindwalk HTML document.
///
/// Appends before `</head>` so it wins the cascade over the bundled
/// stylesheet. A document without a `</head>` still gets the skin rather
/// than silently rendering unstyled.
pub fn inject_skin(html: &str, theme: &str) -> String {
    let theme_attr = if theme == "light" { "light" } else { "dark" };
    let css = skin_css(theme_attr);
    let block = format!(
        "<style data-rhizome-skin=\"1\">{css}</style>\
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
        let skinned = inject_skin(&html, theme);
        inject_evaluate_chrome(&skinned, &detect_mindwalk_judges()).into_bytes()
    } else if is_evaluate_json_path(&target) {
        rewrite_evaluate_payload(&bytes, &detect_mindwalk_judges())
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
        assert!(out.contains("--sky: #0F110C"));
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
    fn light_theme_paints_root_tokens_not_dark_defaults() {
        let out = inject_skin("<head></head>", "light");
        assert!(out.contains("--sky: #F1ECE2"));
        assert!(
            !out.contains("--sky: #0F110C"),
            "light skin must not leave the dark sky on :root; the city samples :root"
        );
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
