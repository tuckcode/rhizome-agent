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

#[tauri::command]
pub fn get_free_tier_overview() -> Result<FreeTierOverview, String> {
    Ok(free_tier::overview(
        &Catalog::pinned(),
        &saved_free_tier_settings()?,
        &ProviderKeys::for_app()?,
    ))
}

/// Saves the choices and returns the overview they produce.
#[tauri::command]
pub fn save_free_tier_settings(settings: FreeTierSettings) -> Result<FreeTierOverview, String> {
    free_tier::save_at(&free_tier_settings_path()?, &settings)?;
    get_free_tier_overview()
}
