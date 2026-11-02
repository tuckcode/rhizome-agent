//! Free-tier settings commands (step 3b). Keys are saved through the
//! existing `save_ai_model_provider_api_key` command, so the keychain stays
//! the one key store. Cloudflare's account id uses the account
//! `cloudflare-ai:account`.

use std::path::PathBuf;

use crate::provider_keys::ProviderKeys;
use crate::rhizome_routing::free_tier::{self, FreeTierOverview, FreeTierSettings};
use crate::rhizome_routing::Catalog;

fn free_tier_settings_path() -> Result<PathBuf, String> {
    crate::settings::preferred_app_config_path(free_tier::SETTINGS_FILE_NAME)
}

/// The user's saved choices, or the defaults when nothing is saved.
pub(crate) fn saved_free_tier_settings() -> Result<FreeTierSettings, String> {
    free_tier::load_at(&free_tier_settings_path()?)
}

/// The providers saved under Settings → AI. One may be the own endpoint.
pub(crate) fn saved_model_providers() -> Result<Vec<crate::ai_models::AiModelProvider>, String> {
    Ok(crate::settings::get_settings()?
        .ai_model_providers
        .unwrap_or_default())
}

/// Reads the overview. This reads the keychain, and the keychain can wait on
/// a macOS password prompt, so it must stay off the main thread.
fn load_free_tier_overview() -> Result<FreeTierOverview, String> {
    Ok(free_tier::overview(
        &Catalog::pinned(),
        &saved_free_tier_settings()?,
        &saved_model_providers()?,
        &ProviderKeys::for_app()?,
    ))
}

async fn on_blocking_thread<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|error| format!("Free tier task failed: {error}"))?
}

// Tauri runs a sync command on the main thread. These two stay async so a
// keychain prompt cannot freeze the window (C100).
#[tauri::command]
pub async fn get_free_tier_overview() -> Result<FreeTierOverview, String> {
    on_blocking_thread(load_free_tier_overview).await
}

/// Saves the choices and returns the overview they produce.
#[tauri::command]
pub async fn save_free_tier_settings(
    settings: FreeTierSettings,
) -> Result<FreeTierOverview, String> {
    on_blocking_thread(move || {
        free_tier::save_at(&free_tier_settings_path()?, &settings)?;
        load_free_tier_overview()
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::on_blocking_thread;

    #[tokio::test]
    async fn blocking_work_leaves_the_calling_thread() {
        let caller = std::thread::current().id();
        let worker = on_blocking_thread(|| Ok(std::thread::current().id()))
            .await
            .unwrap();
        assert_ne!(worker, caller);
    }

    #[tokio::test]
    async fn blocking_work_returns_its_error() {
        let result: Result<(), String> =
            on_blocking_thread(|| Err("keychain locked".to_string())).await;
        assert_eq!(result.unwrap_err(), "keychain locked");
    }
}
