use reqwest::Url;
use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Runtime};
use tauri_plugin_updater::UpdaterExt;

#[cfg(test)]
use std::sync::atomic::{AtomicUsize, Ordering};

/// Moving alpha manifest. Alpha GitHub Releases are prereleases, so
/// `releases/latest/download` does not serve them. The release workflow
/// republishes `alpha-latest.json` onto the `alpha-latest` tag.
pub const ALPHA_UPDATE_FEED: &str =
    "https://github.com/tuckcode/rhizome-agent/releases/download/alpha-latest/alpha-latest.json";

/// Moving stable manifest, published onto the `stable-latest` tag.
pub const STABLE_UPDATE_FEED: &str =
    "https://github.com/tuckcode/rhizome-agent/releases/download/stable-latest/stable-latest.json";

/// Not a minisign key. `pnpm tauri signer generate` replaces this in a
/// follow-up commit. Do not invent a key.
pub const UPDATER_PUBKEY_PLACEHOLDER: &str = "PLACEHOLDER_KNISPO_TAURI_UPDATER_PUBKEY";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateMetadata {
    pub current_version: String,
    pub version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum AppUpdateDownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        chunk_length: usize,
    },
    Finished,
}

/// Stable is the default channel. Only an explicit `alpha` value selects
/// the alpha feed. That matches `normalizeReleaseChannel` in the frontend.
pub fn endpoint_for_release_channel(release_channel: Option<&str>) -> &'static str {
    match release_channel
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("alpha") => ALPHA_UPDATE_FEED,
        _ => STABLE_UPDATE_FEED,
    }
}

/// Shown for check and install while `plugins.updater.pubkey` is still the placeholder.
pub const IN_APP_UPDATES_UNAVAILABLE: &str = "In-app updates aren't available yet.";

/// Stop before any feed request. A placeholder, empty, or whitespace-only
/// key cannot verify a download.
pub fn refuse_placeholder_pubkey(pubkey: &str) -> Result<(), String> {
    let trimmed = pubkey.trim();
    if trimmed.is_empty() || trimmed == UPDATER_PUBKEY_PLACEHOLDER {
        Err(IN_APP_UPDATES_UNAVAILABLE.into())
    } else {
        Ok(())
    }
}

/// Read the feed ourselves. The updater plugin reports every failed status as
/// `ReleaseNotFound`, which would look like "up to date".
///
/// `Ok(None)` is HTTP 404 or 204. 204 matches the plugin's no-update status.
/// 403, 429, and 5xx are errors. A 2xx body that is not a JSON object is an error.
pub fn interpret_feed_response(
    status: u16,
    body: &str,
) -> Result<Option<serde_json::Value>, String> {
    if status == 404 || status == 204 {
        return Ok(None);
    }
    if !(200..300).contains(&status) {
        log::warn!("updater feed responded with status {status}");
        return Err("Could not check for updates.".into());
    }
    match serde_json::from_str::<serde_json::Value>(body) {
        Ok(value) if value.is_object() => Ok(Some(value)),
        _ => {
            log::warn!("updater feed was not a JSON object");
            Err("Could not check for updates.".into())
        }
    }
}

pub fn ensure_expected_version(found: &str, expected: &str) -> Result<(), String> {
    if found == expected {
        Ok(())
    } else {
        Err(format!(
            "The update feed now offers {found}, not {expected}. Check for updates again."
        ))
    }
}

fn configured_updater_pubkey<R: Runtime>(app_handle: &AppHandle<R>) -> String {
    app_handle
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|value| value.get("pubkey"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string()
}

#[cfg(test)]
static FEED_FETCHES: AtomicUsize = AtomicUsize::new(0);

fn fetch_feed(endpoint: &str) -> Result<Option<serde_json::Value>, String> {
    #[cfg(test)]
    FEED_FETCHES.fetch_add(1, Ordering::SeqCst);

    let response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| {
            log::warn!("updater client failed: {error}");
            "Could not check for updates.".to_string()
        })?
        .get(endpoint)
        .send()
        .map_err(|error| {
            log::warn!("updater feed request failed: {error}");
            "Could not check for updates.".to_string()
        })?;
    let status = response.status().as_u16();
    let body = response.text().unwrap_or_default();
    interpret_feed_response(status, &body)
}

fn metadata_from_update(update: &tauri_plugin_updater::Update) -> AppUpdateMetadata {
    AppUpdateMetadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        date: update.date.map(|date| date.to_string()),
        body: update.body.clone(),
    }
}

async fn find_update<R: Runtime>(
    app_handle: &AppHandle<R>,
    release_channel: Option<&str>,
) -> Result<Option<tauri_plugin_updater::Update>, String> {
    // Local config only. Do not touch the network while the key is a placeholder.
    refuse_placeholder_pubkey(&configured_updater_pubkey(app_handle))?;

    let endpoint = endpoint_for_release_channel(release_channel).to_string();
    let endpoint_for_probe = endpoint.clone();
    let manifest = tokio::task::spawn_blocking(move || fetch_feed(&endpoint_for_probe))
        .await
        .map_err(|error| {
            log::warn!("updater feed probe panicked: {error}");
            "Could not check for updates.".to_string()
        })??;
    if manifest.is_none() {
        return Ok(None);
    }

    let url = Url::parse(&endpoint).map_err(|error| {
        log::warn!("updater endpoint was not a URL: {error}");
        "Could not check for updates.".to_string()
    })?;
    let updater = app_handle
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|error| {
            log::warn!("updater builder rejected the endpoint: {error}");
            "Could not check for updates.".to_string()
        })?
        .build()
        .map_err(|error| {
            log::warn!("updater builder failed: {error}");
            "Could not check for updates.".to_string()
        })?;

    match updater.check().await {
        Ok(update) => Ok(update),
        Err(error) => {
            log::warn!("updater plugin check failed: {error}");
            Err("Could not check for updates.".into())
        }
    }
}

pub async fn check_for_app_update<R: Runtime>(
    app_handle: AppHandle<R>,
    release_channel: Option<String>,
) -> Result<Option<AppUpdateMetadata>, String> {
    find_update(&app_handle, release_channel.as_deref())
        .await
        .map(|update| update.as_ref().map(metadata_from_update))
}

/// Downloads and installs through the updater plugin.
///
/// macOS and Linux do not relaunch inside `download_and_install`. The
/// existing Restart control calls `restartApp`, which uses the process
/// plugin. Windows install mode `passive` relaunches from the installer.
pub async fn download_and_install_app_update<R: Runtime>(
    app_handle: AppHandle<R>,
    release_channel: Option<String>,
    expected_version: String,
    on_event: Channel<AppUpdateDownloadEvent>,
) -> Result<(), String> {
    let Some(update) = find_update(&app_handle, release_channel.as_deref()).await? else {
        return Err("No update is available to install.".into());
    };
    ensure_expected_version(&update.version, &expected_version)?;

    let mut announced = false;
    update
        .download_and_install(
            |chunk_length, content_length| {
                if !announced {
                    announced = true;
                    let _ = on_event.send(AppUpdateDownloadEvent::Started { content_length });
                }
                let _ = on_event.send(AppUpdateDownloadEvent::Progress { chunk_length });
            },
            || {},
        )
        .await
        .map_err(|error| {
            log::warn!("updater install failed: {error}");
            "Could not install the update.".to_string()
        })?;

    let _ = on_event.send(AppUpdateDownloadEvent::Finished);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        endpoint_for_release_channel, ensure_expected_version, find_update,
        interpret_feed_response, refuse_placeholder_pubkey, AppUpdateDownloadEvent,
        AppUpdateMetadata, ALPHA_UPDATE_FEED, FEED_FETCHES, IN_APP_UPDATES_UNAVAILABLE,
        STABLE_UPDATE_FEED, UPDATER_PUBKEY_PLACEHOLDER,
    };
    use serde_json::json;
    use std::sync::atomic::Ordering;

    #[test]
    fn alpha_channel_uses_the_moving_alpha_tag() {
        assert_eq!(
            endpoint_for_release_channel(Some("alpha")),
            ALPHA_UPDATE_FEED
        );
        assert_eq!(
            endpoint_for_release_channel(Some(" ALPHA ")),
            ALPHA_UPDATE_FEED
        );
        assert!(!ALPHA_UPDATE_FEED.contains("/releases/latest/"));
    }

    #[test]
    fn other_channels_use_the_moving_stable_tag() {
        assert_eq!(endpoint_for_release_channel(None), STABLE_UPDATE_FEED);
        assert_eq!(endpoint_for_release_channel(Some("")), STABLE_UPDATE_FEED);
        assert_eq!(
            endpoint_for_release_channel(Some("stable")),
            STABLE_UPDATE_FEED
        );
        assert_eq!(
            endpoint_for_release_channel(Some("beta")),
            STABLE_UPDATE_FEED
        );
        assert!(!STABLE_UPDATE_FEED.contains("/releases/latest/"));
    }

    #[test]
    fn empty_and_whitespace_pubkeys_match_the_placeholder() {
        for pubkey in [
            UPDATER_PUBKEY_PLACEHOLDER,
            "",
            "   ",
            "\n\t",
            "  PLACEHOLDER_KNISPO_TAURI_UPDATER_PUBKEY  ",
        ] {
            assert_eq!(
                refuse_placeholder_pubkey(pubkey).unwrap_err(),
                IN_APP_UPDATES_UNAVAILABLE,
                "pubkey {pubkey:?} must refuse before a request"
            );
        }
        assert!(refuse_placeholder_pubkey("dW50cnVzdGVkIGNvbW1lbnQ").is_ok());
    }

    // Tauri's `test` feature compiles its mock runtime into the lib test
    // binary. On Windows that binary exits with STATUS_ENTRYPOINT_NOT_FOUND
    // before any test runs, so this mock app stays off that target.
    #[tokio::test]
    #[cfg(not(windows))]
    async fn find_update_refuses_a_placeholder_config_before_any_request() {
        FEED_FETCHES.store(0, Ordering::SeqCst);
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!(
                "fixtures/tauri.conf.json",
                test = true
            ))
            .expect("updater placeholder app");
        let pubkey = app
            .config()
            .plugins
            .0
            .get("updater")
            .and_then(|value| value.get("pubkey"))
            .and_then(|value| value.as_str())
            .unwrap_or("");
        assert_eq!(pubkey, UPDATER_PUBKEY_PLACEHOLDER);

        let error = match find_update(app.handle(), Some("stable")).await {
            Err(error) => error,
            Ok(_) => panic!("placeholder config must not check the feed"),
        };
        assert_eq!(error, IN_APP_UPDATES_UNAVAILABLE);
        assert_eq!(FEED_FETCHES.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn find_update_treats_only_404_and_204_as_no_update() {
        assert!(interpret_feed_response(404, "missing").unwrap().is_none());
        assert!(interpret_feed_response(204, "").unwrap().is_none());
        for status in [403, 429, 500, 502] {
            assert!(
                interpret_feed_response(status, "nope").is_err(),
                "status {status} must not look like up to date"
            );
        }
    }

    #[test]
    fn find_update_rejects_a_malformed_feed() {
        assert!(interpret_feed_response(200, "not-json").is_err());
        assert!(interpret_feed_response(200, "[]").is_err());
        let feed = interpret_feed_response(200, r#"{"version":"2026.10.17-alpha.1"}"#).unwrap();
        assert_eq!(feed.unwrap()["version"], "2026.10.17-alpha.1");
    }

    #[test]
    fn install_refuses_a_feed_that_changed_version() {
        assert!(ensure_expected_version("2026.10.17-alpha.2", "2026.10.17-alpha.2").is_ok());
        assert_eq!(
            ensure_expected_version("2026.10.17-alpha.3", "2026.10.17-alpha.2").unwrap_err(),
            "The update feed now offers 2026.10.17-alpha.3, not 2026.10.17-alpha.2. Check for updates again."
        );
    }

    #[test]
    fn update_metadata_serializes_for_frontend_consumers() {
        let metadata = AppUpdateMetadata {
            current_version: "2026.4.1".into(),
            version: "2026.4.2".into(),
            date: Some("2026-04-30T12:00:00Z".into()),
            body: Some("Bug fixes".into()),
        };

        assert_eq!(
            serde_json::to_value(metadata).unwrap(),
            json!({
                "currentVersion": "2026.4.1",
                "version": "2026.4.2",
                "date": "2026-04-30T12:00:00Z",
                "body": "Bug fixes"
            })
        );
    }

    #[test]
    fn download_events_serialize_as_tagged_frontend_events() {
        let events = [
            (
                AppUpdateDownloadEvent::Started {
                    content_length: Some(4096),
                },
                json!({
                    "event": "Started",
                    "data": { "contentLength": 4096 }
                }),
            ),
            (
                AppUpdateDownloadEvent::Progress { chunk_length: 512 },
                json!({
                    "event": "Progress",
                    "data": { "chunkLength": 512 }
                }),
            ),
            (
                AppUpdateDownloadEvent::Finished,
                json!({ "event": "Finished" }),
            ),
        ];

        for (event, expected) in events {
            assert_eq!(serde_json::to_value(event).unwrap(), expected);
        }
    }
}
