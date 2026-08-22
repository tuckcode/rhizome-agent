//! Window-level navigation guard.
//!
//! Every webview the app opens — the main window, the menu-bar companion, the
//! AI workspace pop-out, note windows — is declared in `tauri.conf.json` and
//! rendered with no browser chrome. A top-level navigation away from the app
//! origin strands the user: there is no back button, no address bar, and no
//! way out short of quitting the app. Issue #43.
//!
//! Tauri 2.10 has no `on_navigation` for config-declared windows at the
//! `WebviewWindowBuilder` level (that method only attaches when *you* build
//! the window in code). But the plugin hook
//! [`tauri::plugin::Builder::on_navigation`] runs for *every* webview the
//! manager creates, config-declared or not — it is invoked from
//! `WebviewManager`'s navigation handler for all windows. So we install a
//! tiny plugin instead of rebuilding the main window.

use tauri::{plugin::TauriPlugin, Runtime, Url};
use tauri_plugin_opener::OpenerExt;

/// What the navigation guard should do with a prospective top-level navigation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationDecision {
    /// The webview may navigate here (the app's own origin).
    Allow,
    /// Refuse the navigation, but hand the URL to the system handler
    /// (browser for http/https, mail client for mailto/tel/sms). The webview
    /// must never leave the app, yet the user's intent still happens.
    OpenExternally,
    /// Refuse the navigation and do nothing. Used for schemes that have no
    /// safe external meaning (data:, javascript:, file:, asset:, ipc:, ...).
    Refuse,
}

/// Classify a prospective top-level navigation.
///
/// Pure and origin-only: it needs nothing but the target `Url`, so the policy
/// is unit-testable without a running webview. The plugin wires the decision
/// to the actual allow/refuse action.
pub fn navigation_decision(url: &Url) -> NavigationDecision {
    match url.scheme() {
        // Production custom protocol (and the wry `http(s)://tauri.localhost`
        // workaround that some builds use instead).
        "tauri" => {
            if url.host_str() == Some("localhost") {
                NavigationDecision::Allow
            } else {
                NavigationDecision::Refuse
            }
        }
        "http" | "https" => {
            // `host_str()` returns IPv6 addresses *with* brackets
            // (e.g. "[::1]"), so trim them before comparing. The app only ever
            // serves itself from the wry `tauri.localhost` host or a loopback
            // address; cross-origin http(s) (e.g. a link the model produced)
            // goes to the system browser instead.
            let host = url
                .host_str()
                .map(|h| h.trim_matches(['[', ']']))
                .unwrap_or_default();
            if host == "tauri.localhost"
                || host == "localhost"
                || host == "127.0.0.1"
                || host == "::1"
            {
                NavigationDecision::Allow
            } else {
                NavigationDecision::OpenExternally
            }
        }
        // OS-handled schemes: the user wants the mail client / dialer, not the
        // webview. Route them through the opener so the webview stays put.
        "mailto" | "tel" | "sms" => NavigationDecision::OpenExternally,
        // Resource protocols and anything else are not navigations the app
        // should ever perform at the top level.
        _ => NavigationDecision::Refuse,
    }
}

/// Install the navigation guard as a Tauri plugin.
///
/// The hook returns `true` to permit the navigation and `false` to cancel it.
/// For `OpenExternally` / `Refuse` it cancels *and* either hands the URL to
/// the system (`OpenExternally`) or drops it (`Refuse`).
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|webview, url| match navigation_decision(url) {
            NavigationDecision::Allow => true,
            NavigationDecision::OpenExternally => {
                if let Err(error) = webview.opener().open_url(url.as_str(), None::<&str>) {
                    log::warn!("navigation-guard: failed to open {url} externally: {error}");
                }
                false
            }
            NavigationDecision::Refuse => {
                log::warn!("navigation-guard: refused top-level navigation to {url}");
                false
            }
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::{navigation_decision, NavigationDecision};

    fn decide(url: &str) -> NavigationDecision {
        navigation_decision(&url.parse().expect("valid url"))
    }

    #[test]
    fn allows_the_production_app_origin() {
        assert_eq!(decide("tauri://localhost/"), NavigationDecision::Allow);
        assert_eq!(
            decide("tauri://localhost/notes/foo"),
            NavigationDecision::Allow
        );
    }

    #[test]
    fn allows_the_wry_tauri_localhost_workaround() {
        assert_eq!(decide("http://tauri.localhost/"), NavigationDecision::Allow);
        assert_eq!(
            decide("https://tauri.localhost/"),
            NavigationDecision::Allow
        );
    }

    #[test]
    fn allows_loopback_dev_servers() {
        assert_eq!(decide("http://localhost:5202/"), NavigationDecision::Allow);
        assert_eq!(
            decide("http://127.0.0.1:5202/notes/foo"),
            NavigationDecision::Allow
        );
        assert_eq!(decide("http://[::1]:5173/"), NavigationDecision::Allow);
    }

    #[test]
    fn refuses_a_foreign_tauri_host() {
        assert_eq!(decide("tauri://evil.example/"), NavigationDecision::Refuse);
    }

    #[test]
    fn routes_off_origin_http_to_the_system_browser() {
        assert_eq!(
            decide("https://example.com/"),
            NavigationDecision::OpenExternally
        );
        assert_eq!(
            decide("http://news.example.com/article"),
            NavigationDecision::OpenExternally
        );
    }

    #[test]
    fn routes_os_schemes_to_their_handlers() {
        assert_eq!(
            decide("mailto:luca@example.com"),
            NavigationDecision::OpenExternally
        );
        assert_eq!(
            decide("tel:+1234567890"),
            NavigationDecision::OpenExternally
        );
        assert_eq!(
            decide("sms:+1234567890"),
            NavigationDecision::OpenExternally
        );
    }

    #[test]
    fn refuses_schemes_with_no_safe_external_meaning() {
        assert_eq!(decide("javascript:alert(1)"), NavigationDecision::Refuse);
        assert_eq!(
            decide("data:text/html,<b>hi</b>"),
            NavigationDecision::Refuse
        );
        assert_eq!(
            decide("blob:https://example.com/abc"),
            NavigationDecision::Refuse
        );
        assert_eq!(decide("file:///etc/passwd"), NavigationDecision::Refuse);
        assert_eq!(decide("asset://localhost/foo"), NavigationDecision::Refuse);
        assert_eq!(decide("ipc://localhost"), NavigationDecision::Refuse);
    }
}
