mod acp_client;
mod ai_agent_processes;
pub mod ai_agents;
pub(crate) mod ai_model_tools;
pub mod ai_models;
pub mod ai_run_target;
pub mod antigravity_cli;
mod antigravity_config;
mod antigravity_discovery;
mod app_config;
mod app_icon;
pub mod app_updater;
pub mod claude_cli;
mod claude_invocation;
mod cli_agent_runtime;
pub mod codex_cli;
mod commands;
pub mod frontmatter;
pub mod git;
pub mod hermes_cli;
mod hermes_discovery;
pub mod inbox_action;
pub mod inbox_watcher;
pub mod kiro_cli;
mod kiro_discovery;
#[cfg(any(test, all(desktop, target_os = "linux")))]
mod linux_appimage;
pub mod mcp;
#[cfg(desktop)]
pub mod menu;
mod menu_bar_capture;
mod menu_bar_companion;
pub mod model_events;
pub mod mycelium;
pub mod mycelium_judge;
pub mod mycelium_skin;
mod navigation_guard;
pub mod opencode_cli;
mod opencode_config;
mod opencode_discovery;
mod opencode_events;
mod permission_decision;
pub mod pi_cli;
mod pi_config;
mod pi_discovery;
mod pi_events;
pub mod preflight;
pub mod prime_agent_activity;
mod prime_custom_models;
#[cfg(windows)]
mod prime_daemon_pipe;
mod prime_discovery;
mod prime_events;
mod prime_login;
mod prime_packages;
pub mod prime_session_host;
pub mod prime_sessions;
mod prime_settings;
pub mod prime_tool_unwrap;
pub mod prime_update;
mod prime_vault_skill;
mod read_aloud;
pub mod rhizome_api;
pub mod rhizome_commands;
pub mod rhizome_distill;
pub mod rhizome_import;
pub mod rhizome_jobs;
pub mod rhizome_repo_research;
pub mod rhizome_research_formats;
// Loop and engines compile now. Chat must not call them until Phase 6.
pub mod engines;
pub mod rhizome_loop;
// Provider adapter and free-tier routing. They compile now. Chat must not
// call them until Phase 6.
pub mod rhizome_provider_model;
pub mod rhizome_routing;
pub mod rhizome_search;
pub mod rhizome_vault_seed;
pub mod rhizome_write_location;
pub mod search;
mod secure_fs;
pub mod session_import;
pub mod session_transcript_index;
pub mod settings;
pub mod telemetry;
pub mod vault;
pub mod vault_access;
pub mod vault_events;
pub mod vault_list;
pub mod vault_watcher;
#[cfg(desktop)]
mod window_state;

use std::ffi::OsStr;
use std::process::Command;

#[cfg(desktop)]
use std::path::{Path, PathBuf};
#[cfg(desktop)]
use std::process::Child;
#[cfg(desktop)]
use std::sync::Mutex;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub(crate) fn hidden_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    suppress_windows_console(&mut command);
    command
}

#[cfg(windows)]
fn suppress_windows_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_windows_console(_command: &mut Command) {}

#[cfg(desktop)]
/// The running MCP bridge, and the vault set it was started for.
///
/// The vault set is kept so a sync that asks for the same thing can be
/// answered by doing nothing. Without it, every call killed a healthy child
/// and spawned a replacement: 12 restarts in one session on 2026-08-29,
/// several pairs inside the same second, because the caller is a React effect
/// keyed on an array whose identity changes on every render even when its
/// contents do not. Fixed here rather than only there, so no amount of
/// re-calling can cost a restart. #54.
#[cfg(desktop)]
struct RunningBridge {
    child: Child,
    vault: PathBuf,
    active_vaults: Vec<PathBuf>,
}

#[cfg(desktop)]
struct WsBridgeChild(Mutex<Option<RunningBridge>>);

#[cfg(desktop)]
struct AllowedAssetScopeRoots(Mutex<Vec<PathBuf>>);

#[cfg(desktop)]
fn selected_mcp_bridge_vault_paths(vault_list: &vault_list::VaultList) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(active_vault) = vault_list
        .active_vault
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
    {
        push_unique_mcp_bridge_vault_path(&mut paths, active_vault);
    }

    for vault in &vault_list.vaults {
        if vault.mounted == Some(false) {
            continue;
        }
        push_unique_mcp_bridge_vault_path(&mut paths, &vault.path);
    }

    paths
}

#[cfg(desktop)]
fn push_unique_mcp_bridge_vault_path(paths: &mut Vec<PathBuf>, path: &str) {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return;
    }
    let expanded = crate::commands::expand_tilde(trimmed);
    let path = PathBuf::from(expanded.as_ref());
    if crate::commands::is_home_directory(&path) {
        log::warn!("#46: refusing to expose $HOME as an MCP vault root");
        return;
    }
    if paths.iter().any(|existing| existing == &path) {
        return;
    }
    paths.push(path);
}

#[cfg(desktop)]
fn validate_mcp_bridge_vault_path(vault_path: &Path) -> Result<PathBuf, String> {
    let resolved = std::fs::canonicalize(vault_path).map_err(|e| {
        format!(
            "MCP bridge vault is not available: {} ({e})",
            vault_path.display()
        )
    })?;

    if !resolved.is_dir() {
        return Err(format!(
            "MCP bridge vault is not available: {} is not a directory",
            vault_path.display()
        ));
    }

    if crate::commands::is_home_directory(&resolved) {
        return Err(
            "MCP bridge will not use $HOME as a vault — that scopes tools to the whole home directory (#46)"
                .into(),
        );
    }

    Ok(resolved)
}

#[cfg(desktop)]
fn stop_ws_bridge_child(active_child: &mut Option<RunningBridge>) {
    if let Some(mut running) = active_child.take() {
        let _ = running.child.kill();
        let status = running.child.wait();
        // Say how it went. The old line was "ws-bridge child process stopped"
        // and nothing else, so a log full of restarts could not distinguish a
        // deliberate stop from a crash — the one fact needed to diagnose it.
        match status {
            Ok(status) => log::info!("ws-bridge stopped (killed by us, {status})"),
            Err(error) => log::warn!("ws-bridge stopped, but could not be reaped: {error}"),
        }
    }
}

#[cfg(desktop)]
pub(crate) fn sync_ws_bridge_for_vault(
    app_handle: &tauri::AppHandle,
    vault_path: Option<&Path>,
    active_vault_paths: &[PathBuf],
) -> Result<&'static str, String> {
    use tauri::Manager;

    let state: tauri::State<'_, WsBridgeChild> = app_handle.state();
    let mut active_child = state
        .0
        .lock()
        .map_err(|_| "Failed to lock ws-bridge state".to_string())?;

    let Some(vault_path) = vault_path else {
        stop_ws_bridge_child(&mut active_child);
        return Ok("stopped");
    };

    let resolved_vault_path = match validate_mcp_bridge_vault_path(vault_path) {
        Ok(path) => path,
        Err(e) => {
            stop_ws_bridge_child(&mut active_child);
            return Err(e);
        }
    };

    let resolved_active_vault_paths = active_vault_paths
        .iter()
        .filter_map(|path| validate_mcp_bridge_vault_path(path).ok())
        .collect::<Vec<_>>();

    // Already serving exactly this? Then there is nothing to do. Restarting a
    // healthy bridge costs a process kill, a spawn, and a window where the
    // vault tools answer nothing — for no change at all.
    if let Some(running) = active_child.as_ref() {
        if running.vault == resolved_vault_path
            && running.active_vaults == resolved_active_vault_paths
        {
            return Ok("unchanged");
        }
    }

    stop_ws_bridge_child(&mut active_child);

    let child =
        mcp::spawn_ws_bridge_with_paths(&resolved_vault_path, &resolved_active_vault_paths)?;

    *active_child = Some(RunningBridge {
        child,
        vault: resolved_vault_path,
        active_vaults: resolved_active_vault_paths,
    });
    Ok("started")
}

fn spawn_background_task<F>(thread_name: &'static str, task: F)
where
    F: FnOnce() + Send + 'static,
{
    if let Err(e) = std::thread::Builder::new()
        .name(thread_name.into())
        .spawn(task)
    {
        log::warn!("Failed to start {thread_name}: {e}");
    }
}

#[cfg(desktop)]
fn sync_ws_bridge_for_selected_vault(app_handle: &tauri::AppHandle) {
    let vault_paths = match vault_list::load_vault_list() {
        Ok(vault_list) => selected_mcp_bridge_vault_paths(&vault_list),
        Err(e) => {
            log::warn!("Failed to load active vault for ws-bridge startup: {}", e);
            Vec::new()
        }
    };

    let Some(vault_path) = vault_paths.first() else {
        log::info!("ws-bridge not started: no active vault selected");
        return;
    };

    if let Err(e) = sync_ws_bridge_for_vault(app_handle, Some(vault_path), &vault_paths) {
        log::warn!("Failed to start ws-bridge: {}", e);
    }
}

#[cfg(desktop)]
fn spawn_initial_ws_bridge_sync(app: &tauri::App) {
    let app_handle = app.handle().clone();
    spawn_background_task("tolaria-ws-bridge-startup", move || {
        #[cfg(all(desktop, target_os = "linux"))]
        if linux_appimage::is_running() {
            let app_version = app_handle.package_info().version.to_string();
            if let Err(e) = mcp::extract_mcp_server_to_stable_dir(&app_version) {
                log::warn!("Failed to extract MCP server to stable path: {e}");
            }
        }

        sync_ws_bridge_for_selected_vault(&app_handle);
    });
}

fn setup_common_plugins(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )?;
    }

    app.handle().plugin(tauri_plugin_dialog::init())?;
    Ok(())
}

/// The main window hides on close only when the user opted into the taskbar.
///
/// Default is a full quit: red X stops Rhizome-owned helpers and exits, the
/// same as Cmd+Q. C22 still applies when `keep_in_taskbar` is on — do not
/// destroy `main` while the process lives, or tray/dock/`show()` go dead.
/// Note windows stay disposable. Cmd+Q still raises `ExitRequested`.
pub(crate) fn window_hides_instead_of_closing(label: &str, keep_in_taskbar: bool) -> bool {
    label == "main" && keep_in_taskbar
}

/// Red X quits unless Settings → Keep in taskbar is on. Absent means off.
pub(crate) fn keep_in_taskbar_on_close_enabled(setting: Option<bool>) -> bool {
    setting.unwrap_or(false)
}

fn current_keep_in_taskbar_on_close() -> bool {
    keep_in_taskbar_on_close_enabled(
        crate::settings::get_settings()
            .ok()
            .and_then(|settings| settings.keep_in_taskbar_on_close),
    )
}

/// Should a dock/reopen click restore the main window?
///
/// Only when nothing is already on screen. Clicking the dock while a window is
/// visible must not steal focus or raise a window the user did not ask for.
#[cfg(any(target_os = "macos", test))]
pub(crate) fn should_reopen_main_window(has_visible_windows: bool) -> bool {
    !has_visible_windows
}

/// Idle close of the main window. Work stops; hide only if keep-in-taskbar.
pub(crate) fn idle_main_window_close_intent() -> crate::prime_session_host::SessionCloseIntent {
    crate::prime_session_host::SessionCloseIntent::Stop
}

/// Helpers hide must stop — except the spawned Prime daemon, which stays warm
/// so reopen does not pay a multi-second daemon spawn. Keep-working still
/// matters for session intent; the daemon itself is left running either way.
/// Rhizome-owned MCP is the ws-bridge child, not Prime's own tool processes.
pub(crate) fn hidden_window_helper_stops(_keep_prime_daemon: bool) -> &'static [&'static str] {
    &["ws_bridge", "mindwalk"]
}

/// Full quit stops Rhizome-owned helpers, including a Prime daemon this
/// process spawned — unless Keep working left that session resident.
/// Never send Prime `shutdown`; a user-started shared daemon stays up.
pub(crate) fn quit_helper_stops(keep_prime_daemon: bool) -> &'static [&'static str] {
    if keep_prime_daemon {
        hidden_window_helper_stops(true)
    } else {
        &["spawned_prime_daemon", "ws_bridge", "mindwalk"]
    }
}

/// Prime and MCP helpers this process started. They keep a Dock "running"
/// mark after the window hides if we leave them. The spawned Prime daemon
/// stays warm for fast reopen; ws-bridge and Mindwalk still stop.
#[cfg(desktop)]
pub(crate) fn release_helpers_for_hidden_window(
    app_handle: &tauri::AppHandle,
    _keep_prime_daemon: bool,
) {
    use tauri::Manager;

    log::info!(
        "hide stopping helpers: {:?}",
        hidden_window_helper_stops(_keep_prime_daemon)
    );
    crate::prime_session_host::set_host_suspended(true);

    let state: tauri::State<'_, WsBridgeChild> = app_handle.state();
    if let Ok(mut guard) = state.0.lock() {
        stop_ws_bridge_child(&mut guard);
    }
    let _ = crate::mycelium::stop_mindwalk_sidecar();
}

/// Quit path: same helper stop as hide, plus the spawned Prime supervisor
/// unless Keep working left it resident.
#[cfg(desktop)]
pub(crate) fn release_helpers_on_quit(app_handle: &tauri::AppHandle, keep_prime_daemon: bool) {
    log::info!(
        "quit stopping helpers: {:?}",
        quit_helper_stops(keep_prime_daemon)
    );
    release_helpers_for_hidden_window(app_handle, keep_prime_daemon);
    if !keep_prime_daemon {
        crate::prime_session_host::stop_spawned_daemon();
    }
}

#[cfg(desktop)]
pub(crate) fn focus_main_window(app_handle: &tauri::AppHandle) {
    use tauri::Manager;

    crate::prime_session_host::set_host_suspended(false);

    // Unhide the *application* first. Once C22's fix hides the last window,
    // macOS treats the app as hidden, and `window.show()` alone leaves it
    // off-screen — which is what made the dock and tray look dead even though
    // the window still existed.
    #[cfg(target_os = "macos")]
    if let Err(err) = app_handle.show() {
        log::warn!("could not unhide the application: {err}");
    }

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        if let Err(err) = window.show() {
            log::warn!("could not show the main window: {err}");
        }
        let _ = window.set_focus();
    } else {
        log::warn!("reopen requested but no main window exists");
    }
}

#[cfg(desktop)]
fn with_desktop_entry_plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
}

#[cfg(desktop)]
fn setup_deep_link_runtime_registration(
    _app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;

        _app.deep_link().register_all()?;
    }

    Ok(())
}

#[cfg(desktop)]
fn setup_desktop_plugins(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    setup_macos_webview_shortcut_prevention(app)?;
    setup_deep_link_runtime_registration(app)?;
    app.handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
    app.handle().plugin(tauri_plugin_process::init())?;
    app.handle().plugin(tauri_plugin_opener::init())?;
    if should_use_native_desktop_menu(std::env::consts::OS) {
        menu::setup_menu(app)?;
    }
    setup_custom_window_chrome(app)?;
    window_state::restore_main_window_state(app);
    if let Err(err) = menu_bar_companion::setup(app) {
        log::warn!("menu-bar companion setup failed: {err}");
    }
    show_debug_main_window(app);
    Ok(())
}

#[cfg(debug_assertions)]
fn show_debug_main_window(app: &mut tauri::App) {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.center();
        let _ = window.set_focus();
    }
}

#[cfg(not(debug_assertions))]
fn show_debug_main_window(_app: &mut tauri::App) {}

fn should_use_native_desktop_menu(target_os: &str) -> bool {
    target_os == "macos"
}

#[cfg(all(desktop, any(target_os = "linux", target_os = "windows")))]
fn setup_custom_window_chrome(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_decorations(false);
    }
    Ok(())
}

#[cfg(all(desktop, target_os = "macos"))]
fn setup_custom_window_chrome(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        seat_macos_traffic_lights(&window);
        let watched = window.clone();
        window.on_window_event(move |event| {
            if matches!(
                event,
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. }
            ) {
                seat_macos_traffic_lights(&watched);
            }
        });
    }
    Ok(())
}

/// Center the overlay traffic lights in the 32px `MacOSTitlebar` band.
///
/// tao sets each button's x and the title-bar height, and leaves y alone.
/// On this macOS the buttons stay pinned to the top of that band, so the
/// Command Palette (centered in the 32px strip) sits on a lower line.
#[cfg(all(desktop, target_os = "macos"))]
fn seat_macos_traffic_lights(window: &tauri::WebviewWindow) {
    use objc2::rc::Retained;
    use objc2_app_kit::{NSWindow, NSWindowButton};

    const BAND_CENTER_FROM_TOP: f64 = 16.0;

    let Ok(ptr) = window.ns_window() else {
        return;
    };
    if ptr.is_null() {
        return;
    }

    unsafe {
        let Some(ns_window) = Retained::retain(ptr.cast::<NSWindow>()) else {
            return;
        };
        let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) else {
            return;
        };
        let Some(container) = close.superview().and_then(|view| view.superview()) else {
            return;
        };
        let height = container.frame().size.height;
        let button_height = close.frame().size.height;
        let origin_y = (height - BAND_CENTER_FROM_TOP - button_height / 2.0).max(0.0);
        for kind in [
            NSWindowButton::CloseButton,
            NSWindowButton::MiniaturizeButton,
            NSWindowButton::ZoomButton,
        ] {
            let Some(button) = ns_window.standardWindowButton(kind) else {
                continue;
            };
            let mut origin = button.frame().origin;
            origin.y = origin_y;
            button.setFrameOrigin(origin);
        }
    }
}

#[cfg(not(any(
    all(desktop, any(target_os = "linux", target_os = "windows")),
    all(desktop, target_os = "macos")
)))]
fn setup_custom_window_chrome(_app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(any(test, all(desktop, target_os = "macos")))]
const MACOS_WEBVIEW_RESERVED_COMMAND_KEYS: &[&str] = &["O", "F"];
#[cfg(any(test, all(desktop, target_os = "macos")))]
const MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS: &[&str] = &["L"];

#[cfg(all(desktop, target_os = "macos"))]
fn setup_macos_webview_shortcut_prevention(
    app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_prevent_default::ModifierKey::{MetaKey, ShiftKey};
    use tauri_plugin_prevent_default::{Flags, KeyboardShortcut};

    let mut builder = tauri_plugin_prevent_default::Builder::new().with_flags(Flags::empty());

    // WKWebView can swallow some browser-reserved chords before our shared
    // renderer shortcut handler sees them. Keep this list narrow and verify
    // every addition with native QA.
    for key in MACOS_WEBVIEW_RESERVED_COMMAND_KEYS {
        builder = builder.shortcut(KeyboardShortcut::with_modifiers(key, &[MetaKey]));
    }
    for key in MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS {
        builder = builder.shortcut(KeyboardShortcut::with_modifiers(key, &[MetaKey, ShiftKey]));
    }

    app.handle().plugin(builder.build())?;
    Ok(())
}

#[cfg(not(all(desktop, target_os = "macos")))]
fn setup_macos_webview_shortcut_prevention(
    _app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    setup_common_plugins(app)?;

    #[cfg(desktop)]
    setup_desktop_plugins(app)?;

    if telemetry::init_sentry_from_settings() {
        log::info!("Sentry initialized (crash reporting enabled)");
    }

    #[cfg(desktop)]
    {
        spawn_initial_ws_bridge_sync(app);
        crate::prime_session_host::warm_daemon_in_background();
    }

    Ok(())
}

#[cfg(desktop)]
fn vault_asset_scope_roots(vault_path: &Path) -> Result<Vec<PathBuf>, String> {
    let canonical_vault_path = std::fs::canonicalize(vault_path).map_err(|e| {
        format!(
            "Failed to resolve asset scope for {}: {e}",
            vault_path.display()
        )
    })?;
    let mut roots = vec![canonical_vault_path.clone()];
    let requested_vault_path = vault_path.to_path_buf();
    if requested_vault_path != canonical_vault_path {
        roots.push(requested_vault_path);
    }
    Ok(roots)
}

#[cfg(desktop)]
fn missing_asset_scope_roots(
    allowed_roots: &[PathBuf],
    requested_roots: &[PathBuf],
) -> Vec<PathBuf> {
    requested_roots
        .iter()
        .filter(|root| !allowed_roots.contains(root))
        .cloned()
        .collect()
}

#[cfg(desktop)]
pub(crate) fn sync_vault_asset_scope(
    app_handle: &tauri::AppHandle,
    vault_path: &Path,
) -> Result<(), String> {
    use tauri::Manager;

    let requested_roots = vault_asset_scope_roots(vault_path)?;
    let scope = app_handle.asset_protocol_scope();
    let state: tauri::State<'_, AllowedAssetScopeRoots> = app_handle.state();
    let mut allowed_roots = state
        .0
        .lock()
        .map_err(|_| "Failed to lock asset scope state".to_string())?;
    let roots_to_allow = missing_asset_scope_roots(&allowed_roots, &requested_roots);

    for root in &roots_to_allow {
        scope
            .allow_directory(root, true)
            .map_err(|e| format!("Failed to allow asset access for {}: {e}", root.display()))?;
    }

    allowed_roots.extend(roots_to_allow);
    Ok(())
}

macro_rules! app_invoke_handler {
    () => {
        tauri::generate_handler![
            commands::list_vault,
            commands::list_vault_folders,
            commands::get_note_content,
            commands::validate_note_content,
            commands::create_note_content,
            commands::save_note_content,
            commands::update_frontmatter,
            commands::delete_frontmatter_property,
            commands::rename_note,
            commands::rename_note_filename,
            commands::move_note_to_folder,
            commands::move_note_to_workspace,
            commands::auto_rename_untitled,
            commands::detect_renames,
            commands::update_wikilinks_for_renames,
            commands::get_file_history,
            commands::get_modified_files,
            commands::get_file_diff,
            commands::get_file_diff_at_commit,
            commands::get_vault_pulse,
            commands::git_commit,
            commands::git_author_identity,
            commands::get_build_number,
            commands::get_last_commit_info,
            commands::git_pull,
            commands::git_push,
            commands::git_remote_status,
            commands::git_file_url,
            commands::git_add_remote,
            commands::get_conflict_files,
            commands::git_resolve_conflict,
            commands::git_commit_conflict_resolution,
            commands::git_discard_file,
            commands::is_git_repo,
            commands::init_git_repo,
            commands::check_claude_cli,
            commands::get_ai_agents_status,
            commands::get_agent_docs_path,
            commands::get_vault_ai_guidance_status,
            commands::restore_vault_ai_guidance,
            commands::stream_claude_chat,
            commands::stream_ai_agent,
            commands::speak_reply,
            commands::abort_ai_agent_stream,
            commands::get_prime_session_host_status,
            commands::list_prime_running_sessions,
            commands::get_prime_session_stats,
            commands::list_prime_session_summaries,
            commands::latest_prime_session_for_restore,
            commands::set_prime_session_archived,
            commands::get_prime_model_allow_list,
            commands::set_prime_model_allow_list,
            commands::rename_prime_session,
            commands::read_prime_session_transcript,
            commands::load_session_transcript_index,
            commands::save_session_transcript_index,
            commands::switch_prime_session,
            commands::get_available_prime_models,
            commands::get_prime_commands,
            commands::export_prime_session,
            commands::set_prime_model,
            commands::set_prime_thinking_level,
            commands::get_prime_thinking_levels,
            commands::get_prime_supported_thinking_levels,
            commands::fork_prime_session,
            commands::settle_prime_session,
            commands::finish_main_window_close,
            commands::get_prime_agent_activity,
            commands::manage_prime_heartbeat,
            commands::cancel_prime_scheduled_work,
            commands::create_prime_scheduled_work,
            commands::set_prime_goal,
            commands::clear_prime_goal,
            commands::steer_prime_session,
            commands::follow_up_prime_session,
            commands::get_prime_session_queue,
            commands::clear_prime_session_queue,
            commands::mutate_prime_queued_message,
            commands::get_prime_session_tree,
            commands::navigate_prime_session_tree,
            commands::cancel_prime_rlm_child,
            commands::compact_prime_session,
            commands::ensure_prime_session_host,
            commands::prime_session_new_session,
            commands::abort_prime_session_turn,
            commands::stream_prime_session,
            commands::list_prime_sessions,
            commands::get_connected_providers,
            commands::get_prime_provider_status,
            commands::sign_in_prime_provider,
            commands::save_prime_provider_key,
            commands::list_prime_packages,
            commands::install_prime_package,
            commands::ensure_nous_portal_models,
            commands::preflight_chat,
            commands::start_mindwalk_sidecar,
            commands::stop_mindwalk_sidecar,
            commands::stream_ai_model,
            commands::native_chat_start,
            commands::native_chat_send,
            commands::native_chat_cancel,
            commands::native_chat_approval_reply,
            commands::native_chat_end,
            commands::save_ai_model_provider_api_key,
            commands::delete_ai_model_provider_api_key,
            commands::test_ai_model_provider,
            commands::reload_vault,
            commands::reload_vault_entry,
            commands::sync_vault_asset_scope_for_window,
            commands::open_vault_file_external,
            commands::save_image,
            commands::copy_image_to_vault,
            commands::delete_note,
            commands::batch_delete_notes,
            commands::batch_delete_notes_async,
            commands::create_vault_folder,
            commands::rename_vault_folder,
            commands::delete_vault_folder,
            commands::get_settings,
            commands::get_ai_workspace_sessions,
            commands::check_for_app_update,
            commands::check_prime_update,
            commands::apply_prime_update,
            commands::update_menu_state,
            commands::update_app_icon,
            commands::trigger_menu_command,
            commands::update_current_window_min_size,
            commands::perform_current_window_titlebar_double_click,
            commands::save_settings,
            commands::save_ai_workspace_sessions,
            commands::download_and_install_app_update,
            commands::load_vault_list,
            commands::save_vault_list,
            commands::git_clone::clone_git_repo,
            commands::search_vault,
            commands::create_empty_vault,
            commands::create_getting_started_vault,
            commands::preview_claude_code_session_import,
            commands::run_claude_code_session_import,
            commands::check_vault_exists,
            commands::is_wiki_vault,
            commands::get_default_vault_path,
            commands::register_mcp_tools,
            commands::remove_mcp_tools,
            commands::check_mcp_status,
            commands::get_mcp_config_snippet,
            commands::get_opencode_mcp_config_snippet,
            commands::copy_text_to_clipboard,
            commands::read_text_from_clipboard,
            commands::sync_mcp_bridge_vault,
            commands::get_process_memory_snapshot,
            commands::repair_vault,
            commands::seed_portent_type_definitions,
            commands::reinit_telemetry,
            commands::should_use_external_media_preview,
            commands::print_current_webview,
            commands::can_export_current_webview_pdf,
            commands::export_current_webview_pdf,
            commands::resolve_sheet_external_formula_inputs,
            commands::list_views,
            commands::save_view_cmd,
            commands::delete_view_cmd,
            vault_watcher::start_vault_watcher,
            vault_watcher::stop_vault_watcher,
            inbox_watcher::start_inbox_watcher,
            inbox_watcher::stop_inbox_watcher,
            rhizome_commands::call_rhizome_tool,
            rhizome_commands::list_research_formats,
            rhizome_commands::save_research_format,
            rhizome_commands::delete_research_format,
            rhizome_jobs::start_rhizome_job,
            rhizome_jobs::cancel_rhizome_job,
            menu_bar_companion::hide_menu_bar_companion,
            menu_bar_companion::open_main_from_menu_bar_companion
        ]
    };
}

fn with_invoke_handler(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(app_invoke_handler!())
}

#[cfg(desktop)]
fn handle_run_event(app_handle: &tauri::AppHandle, event: &tauri::RunEvent) {
    window_state::handle_run_event(app_handle, event);

    // macOS dock click. Without this, a window hidden by the C22 close fix has
    // no way back: `focus_main_window` is only reached by the tray and by a
    // second app instance, neither of which a dock click triggers.
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Reopen {
        has_visible_windows,
        ..
    } = event
    {
        if should_reopen_main_window(*has_visible_windows) {
            focus_main_window(app_handle);
        }
    }

    if let tauri::RunEvent::Exit = event {
        use tauri::Manager;
        if let Some(chats) = app_handle.try_state::<crate::commands::NativeChats>() {
            crate::commands::settle_native_chats_on_quit(&chats);
        }
        // Quitting settles this client's session (ADR-0167): foreground-owned
        // work stops; explicitly promoted work stays resident. A daemon this
        // process started is stopped unless Keep working left it resident.
        // We still never send Prime's `shutdown` RPC — that would kill other
        // clients. See #12.
        let keep_prime_daemon = match crate::prime_session_host::settle_session_on_quit() {
            Ok(disposition) => {
                log::info!("Prime session on quit: {disposition:?}");
                matches!(
                    disposition,
                    crate::prime_session_host::QuitDisposition::KeepSessionRunning
                )
            }
            // Never block the exit on this.
            Err(error) => {
                log::debug!("Could not settle the Prime session on quit: {error}");
                false
            }
        };
        release_helpers_on_quit(app_handle, keep_prime_daemon);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(all(desktop, target_os = "linux"))]
    linux_appimage::apply_startup_env_overrides();

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = with_desktop_entry_plugins(builder);

    // #43 — a window-level navigation guard. Stops any webview (the main
    // window is config-declared, so we use the plugin hook, not the
    // WebviewWindowBuilder method) from navigating away from the app
    // origin; off-origin links go to the system browser instead.
    let builder = builder.plugin(navigation_guard::init());

    #[cfg(desktop)]
    let builder = builder
        .manage(WsBridgeChild(Mutex::new(None)))
        .manage(AllowedAssetScopeRoots(Mutex::new(Vec::new())))
        .manage(window_state::MainWindowFrameState::default())
        .manage(vault_watcher::VaultWatcherState::new())
        .manage(inbox_watcher::InboxWatcherState::default())
        .manage(rhizome_search::service::RhizomeSearchService::default())
        .manage(commands::NativeChats::new());

    with_invoke_handler(builder)
        .on_window_event(|window, event| {
            // Deliberately not `#[cfg(desktop)]`-gated inside the closure: a cfg
            // that did not hold would delete the body and leave a handler that
            // silently does nothing, which is indistinguishable from the bug it
            // fixes. `WindowEvent` is core to Tauri on every target.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let keep_in_taskbar = current_keep_in_taskbar_on_close();
                if window_hides_instead_of_closing(window.label(), keep_in_taskbar) {
                    use tauri::{Emitter, Manager};
                    api.prevent_close();
                    if crate::prime_session_host::is_streaming() {
                        log::info!(
                            "main window close requested while Prime is working — asking (ADR-0167)"
                        );
                        if let Err(err) = window.emit("prime-active-close-requested", ()) {
                            log::warn!("could not ask about the active close: {err}");
                        }
                        return;
                    }
                    log::info!(
                        "main window close requested — stopping owned work and hiding (keep in taskbar)"
                    );
                    let keep_prime_daemon = match crate::prime_session_host::settle_session(
                        idle_main_window_close_intent(),
                    ) {
                        Ok(disposition) => matches!(
                            disposition,
                            crate::prime_session_host::QuitDisposition::KeepSessionRunning
                        ),
                        Err(error) => {
                            log::debug!("Could not settle the Prime session on hide: {error}");
                            false
                        }
                    };
                    #[cfg(desktop)]
                    release_helpers_for_hidden_window(window.app_handle(), keep_prime_daemon);
                    if let Err(err) = window.hide() {
                        log::warn!("main window hide failed, it will close: {err}");
                    }
                } else if window.label() == "main" {
                    use tauri::{Emitter, Manager};
                    // Do not destroy `main` while the process lives (C22). Exit
                    // the app so the Exit path settles and stops owned helpers.
                    api.prevent_close();
                    if crate::prime_session_host::is_streaming() {
                        log::info!(
                            "main window close requested while Prime is working — asking (ADR-0167)"
                        );
                        if let Err(err) = window.emit("prime-active-close-requested", ()) {
                            log::warn!("could not ask about the active close: {err}");
                        }
                        return;
                    }
                    log::info!(
                        "main window close requested — quitting and stopping owned helpers"
                    );
                    window.app_handle().exit(0);
                }
            }
        })
        .setup(setup_app)
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(desktop)]
            handle_run_event(app_handle, &event);
        });
}

#[cfg(test)]
mod tests {
    use super::should_reopen_main_window;
    use super::should_use_native_desktop_menu;
    use super::window_hides_instead_of_closing;

    /// Red X quits by default. Hide is opt-in so C22 does not return: never
    /// destroy `main` while the process stays alive.
    #[test]
    fn the_main_window_quits_on_close_unless_kept_in_the_taskbar() {
        assert!(!window_hides_instead_of_closing("main", false));
        assert!(window_hides_instead_of_closing("main", true));
        assert!(!super::keep_in_taskbar_on_close_enabled(None));
        assert!(!super::keep_in_taskbar_on_close_enabled(Some(false)));
        assert!(super::keep_in_taskbar_on_close_enabled(Some(true)));
    }

    /// Closing the window must stop owned work. Detach left Prime helpers
    /// running after a hide, which looked like a hang in the Dock.
    #[test]
    fn idle_window_close_stops_owned_work() {
        assert_eq!(
            super::idle_main_window_close_intent(),
            crate::prime_session_host::SessionCloseIntent::Stop
        );
    }

    /// Board pile 6 / hide-on-close-helpers.md: hide stops Rhizome-owned
    /// helpers. Keep-working leaves the spawned Prime daemon; everything
    /// else (ws-bridge MCP child, Mindwalk) still stops.
    #[test]
    fn hide_stops_owned_helpers_except_keep_working_prime() {
        let hide = super::hidden_window_helper_stops(false);
        let keep_working = super::hidden_window_helper_stops(true);
        assert_eq!(hide, ["ws_bridge", "mindwalk"]);
        assert_eq!(keep_working, ["ws_bridge", "mindwalk"]);
        assert!(
            !hide.contains(&"spawned_prime_daemon"),
            "hide must leave the spawned Prime daemon warm for fast reopen"
        );
        assert!(
            !keep_working.contains(&"spawned_prime_daemon"),
            "Keep working also leaves the spawned Prime daemon"
        );
        for name in ["ws_bridge", "mindwalk"] {
            assert!(hide.contains(&name), "{name} still stops on hide");
            assert!(
                keep_working.contains(&name),
                "{name} still stops when Keep working"
            );
        }
    }

    /// Full quit stops a Prime daemon this process spawned, plus the same
    /// Rhizome helpers hide already stops. Keep working leaves that daemon.
    #[test]
    fn quit_stops_owned_helpers_including_spawned_prime() {
        let quit = super::quit_helper_stops(false);
        let keep_working = super::quit_helper_stops(true);
        assert_eq!(quit, ["spawned_prime_daemon", "ws_bridge", "mindwalk"]);
        assert_eq!(keep_working, ["ws_bridge", "mindwalk"]);
        assert!(
            !keep_working.contains(&"spawned_prime_daemon"),
            "Keep working leaves the spawned Prime daemon so resident work lives"
        );
    }

    /// A dock click with a window already up must not steal focus.
    #[test]
    fn reopen_restores_only_when_nothing_is_on_screen() {
        assert!(should_reopen_main_window(false));
        assert!(!should_reopen_main_window(true));
    }

    /// Note windows are disposable — keeping them alive hidden would leak a
    /// window per note opened.
    #[test]
    fn other_windows_still_close_for_real() {
        assert!(!window_hides_instead_of_closing("note-1", false));
        assert!(!window_hides_instead_of_closing("note-1", true));
        assert!(!window_hides_instead_of_closing("ai-workspace", true));
        assert!(!window_hides_instead_of_closing("", false));
    }
    use super::MACOS_WEBVIEW_RESERVED_COMMAND_KEYS;
    use super::MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS;

    #[cfg(desktop)]
    use super::{
        missing_asset_scope_roots, selected_mcp_bridge_vault_paths, validate_mcp_bridge_vault_path,
    };
    #[cfg(desktop)]
    use crate::vault_list::{VaultEntry, VaultList};
    #[cfg(desktop)]
    use std::path::PathBuf;

    #[cfg(all(desktop, unix))]
    use super::vault_asset_scope_roots;

    #[test]
    fn macos_webview_shortcut_prevention_includes_ai_panel_shortcut() {
        assert_eq!(MACOS_WEBVIEW_RESERVED_COMMAND_KEYS, ["O", "F"]);
        assert_eq!(MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS, ["L"]);
    }

    #[cfg(desktop)]
    #[test]
    fn selected_mcp_bridge_vault_paths_puts_persisted_active_vault_first() {
        let list = VaultList {
            vaults: vec![
                VaultEntry {
                    label: "Secondary".to_string(),
                    path: "/tmp/Secondary Vault".to_string(),
                    mounted: Some(true),
                    ..VaultEntry::default()
                },
                VaultEntry {
                    label: "Hidden".to_string(),
                    path: "/tmp/Hidden Vault".to_string(),
                    mounted: Some(false),
                    ..VaultEntry::default()
                },
                VaultEntry {
                    label: "Selected".to_string(),
                    path: "/tmp/Selected Vault".to_string(),
                    mounted: Some(true),
                    ..VaultEntry::default()
                },
            ],
            active_vault: Some("/tmp/Selected Vault".to_string()),
            default_workspace_path: None,
            hidden_defaults: Vec::new(),
        };

        assert_eq!(
            selected_mcp_bridge_vault_paths(&list),
            vec![
                PathBuf::from("/tmp/Selected Vault"),
                PathBuf::from("/tmp/Secondary Vault"),
            ]
        );
    }

    #[cfg(desktop)]
    #[test]
    fn selected_mcp_bridge_vault_paths_ignores_blank_active_vault() {
        let list = VaultList {
            vaults: Vec::new(),
            active_vault: Some("  ".to_string()),
            default_workspace_path: None,
            hidden_defaults: Vec::new(),
        };

        assert!(selected_mcp_bridge_vault_paths(&list).is_empty());
    }

    #[cfg(desktop)]
    #[test]
    fn selected_mcp_bridge_vault_paths_skips_the_home_directory() {
        let Some(home) = dirs::home_dir() else {
            return;
        };
        let list = VaultList {
            vaults: vec![
                VaultEntry {
                    label: "Home".to_string(),
                    path: home.to_string_lossy().into_owned(),
                    mounted: Some(true),
                    ..VaultEntry::default()
                },
                VaultEntry {
                    label: "Real".to_string(),
                    path: "/tmp/Real Vault".to_string(),
                    mounted: Some(true),
                    ..VaultEntry::default()
                },
            ],
            active_vault: Some(home.to_string_lossy().into_owned()),
            default_workspace_path: None,
            hidden_defaults: Vec::new(),
        };

        assert_eq!(
            selected_mcp_bridge_vault_paths(&list),
            vec![PathBuf::from("/tmp/Real Vault")]
        );
    }

    #[cfg(desktop)]
    #[test]
    fn validate_mcp_bridge_vault_path_requires_existing_directory() {
        let dir = tempfile::tempdir().unwrap();
        let vault = dir.path().join("Vault With Spaces");
        std::fs::create_dir(&vault).unwrap();

        let resolved = validate_mcp_bridge_vault_path(&vault).unwrap();
        assert_eq!(resolved, vault.canonicalize().unwrap());

        let missing = dir.path().join("Missing Vault");
        let err = validate_mcp_bridge_vault_path(&missing).unwrap_err();
        assert!(err.contains("MCP bridge vault is not available"));
    }

    #[cfg(desktop)]
    #[test]
    fn validate_mcp_bridge_vault_path_refuses_the_home_directory() {
        let Some(home) = dirs::home_dir() else {
            return;
        };
        let err = validate_mcp_bridge_vault_path(&home).unwrap_err();
        assert!(err.contains("#46"));
    }

    #[cfg(all(desktop, unix))]
    #[test]
    fn vault_asset_scope_roots_include_requested_symlink_path() {
        let dir = tempfile::tempdir().unwrap();
        let canonical_vault = dir.path().join("Getting Started");
        let symlinked_vault = dir.path().join("Symlinked Getting Started");
        std::fs::create_dir(&canonical_vault).unwrap();
        std::os::unix::fs::symlink(&canonical_vault, &symlinked_vault).unwrap();

        let roots = vault_asset_scope_roots(&symlinked_vault).unwrap();

        assert_eq!(roots[0], canonical_vault.canonicalize().unwrap());
        assert!(roots.contains(&symlinked_vault));
    }

    #[cfg(desktop)]
    #[test]
    fn missing_asset_scope_roots_keeps_previously_allowed_vaults() {
        let vault_a = PathBuf::from("/vault-a");
        let vault_b = PathBuf::from("/vault-b");
        let allowed_roots = vec![vault_a.clone()];

        assert_eq!(
            missing_asset_scope_roots(&allowed_roots, std::slice::from_ref(&vault_b)),
            vec![vault_b]
        );
        assert!(
            missing_asset_scope_roots(&allowed_roots, std::slice::from_ref(&vault_a)).is_empty()
        );
    }

    #[test]
    fn native_desktop_menu_is_macos_only() {
        assert!(should_use_native_desktop_menu("macos"));
        assert!(!should_use_native_desktop_menu("windows"));
        assert!(!should_use_native_desktop_menu("linux"));
    }
}
