use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Runtime};

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

/// Rhizome has no signing key or published release feed yet (see
/// docs/HANDOFF.md). This used to point at upstream Tolaria's GitHub
/// releases, which ship multiple times a day -- the version check against
/// Rhizome's static tauri.conf.json version always reported an update
/// available, and a real download would have installed an actual Tolaria
/// build. Report no update until Rhizome ships its own signed release feed.
fn no_update_available() -> Result<Option<AppUpdateMetadata>, String> {
    Ok(None)
}

fn updates_not_yet_available() -> Result<(), String> {
    Err("Rhizome doesn't have a release feed configured yet -- updates aren't available.".into())
}

pub async fn check_for_app_update<R: Runtime>(
    _app_handle: AppHandle<R>,
    _release_channel: Option<String>,
) -> Result<Option<AppUpdateMetadata>, String> {
    no_update_available()
}

pub async fn download_and_install_app_update<R: Runtime>(
    _app_handle: AppHandle<R>,
    _release_channel: Option<String>,
    _expected_version: String,
    _on_event: Channel<AppUpdateDownloadEvent>,
) -> Result<(), String> {
    updates_not_yet_available()
}

#[cfg(test)]
mod tests {
    use super::{
        no_update_available, updates_not_yet_available, AppUpdateDownloadEvent, AppUpdateMetadata,
    };
    use serde_json::json;

    #[test]
    fn no_update_available_reports_none() {
        assert_eq!(no_update_available(), Ok(None));
    }

    #[test]
    fn updates_not_yet_available_reports_an_explanatory_error() {
        assert_eq!(
            updates_not_yet_available().unwrap_err(),
            "Rhizome doesn't have a release feed configured yet -- updates aren't available."
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
