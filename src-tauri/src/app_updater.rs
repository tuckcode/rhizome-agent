use reqwest::Url;
use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Runtime};
use tauri_plugin_updater::UpdaterExt;

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

/// The updater plugin returns this when the tag or asset is not published yet.
pub fn feed_has_no_release(message: &str) -> bool {
    message
        .to_ascii_lowercase()
        .contains("could not fetch a valid release json")
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

/// The updater plugin rejects a platform entry that has no `signature`.
/// Unsigned release feeds stay downloadable, and they are not installable.
pub fn updater_platform_signature(
    feed: &serde_json::Value,
    target: &str,
) -> Result<String, String> {
    let platforms = feed
        .get("platforms")
        .and_then(|value| value.as_object())
        .ok_or_else(|| "Update feed is missing platforms.".to_string())?;
    let platform = platforms
        .get(target)
        .ok_or_else(|| format!("Update feed has no {target} build."))?;
    platform
        .get("signature")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Update feed has no signature for {target}."))
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
    let endpoint = endpoint_for_release_channel(release_channel);
    let url = Url::parse(endpoint).map_err(|error| error.to_string())?;
    let updater = app_handle
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())?;

    match updater.check().await {
        Ok(update) => Ok(update),
        Err(error) if feed_has_no_release(&error.to_string()) => Ok(None),
        Err(error) => Err(format!("Could not read the update feed: {error}")),
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
        .map_err(|error| format!("Could not install the update: {error}"))?;

    let _ = on_event.send(AppUpdateDownloadEvent::Finished);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        endpoint_for_release_channel, ensure_expected_version, feed_has_no_release,
        updater_platform_signature, AppUpdateDownloadEvent, AppUpdateMetadata, ALPHA_UPDATE_FEED,
        STABLE_UPDATE_FEED, UPDATER_PUBKEY_PLACEHOLDER,
    };
    use serde_json::json;

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
    fn tauri_config_points_at_the_alpha_feed_and_a_placeholder_key() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();

        assert_eq!(config["bundle"]["createUpdaterArtifacts"], true);
        assert_eq!(
            config["plugins"]["updater"]["endpoints"][0],
            ALPHA_UPDATE_FEED
        );
        assert_eq!(
            config["plugins"]["updater"]["pubkey"],
            UPDATER_PUBKEY_PLACEHOLDER
        );
    }

    #[test]
    fn a_missing_feed_is_not_an_update() {
        assert!(feed_has_no_release(
            "Could not fetch a valid release JSON from the remote"
        ));
        assert!(!feed_has_no_release(
            "the platform `darwin-aarch64` was not found in the response `platforms` object"
        ));
        assert!(!feed_has_no_release("error sending request"));
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
    fn a_platform_without_a_signature_is_not_installable() {
        let signed = json!({
            "version": "2026.10.17-alpha.1",
            "platforms": {
                "darwin-aarch64": {
                    "signature": "sig-contents",
                    "url": "https://github.com/tuckcode/rhizome-agent/releases/download/alpha-v2026.10.17-alpha.0001/app.tar.gz"
                }
            }
        });
        assert_eq!(
            updater_platform_signature(&signed, "darwin-aarch64").unwrap(),
            "sig-contents"
        );

        let unsigned = json!({
            "version": "2026.10.17-alpha.1",
            "platforms": {
                "darwin-aarch64": {
                    "url": "https://example.com/app.tar.gz",
                    "download_url": "https://example.com/app.tar.gz"
                }
            }
        });
        assert_eq!(
            updater_platform_signature(&unsigned, "darwin-aarch64").unwrap_err(),
            "Update feed has no signature for darwin-aarch64."
        );
        assert!(updater_platform_signature(&signed, "linux-x86_64").is_err());
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
