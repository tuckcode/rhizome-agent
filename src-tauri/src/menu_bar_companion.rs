//! macOS menu-bar companion (tray icon + capture menu + optional popover).
//!
//! Tray behavior follows GatherOS: the menu is the tool (capture area /
//! window / fullscreen → vault), not just Open/Quit. Left-click opens the
//! menu. "Quick note" still toggles the webview popover for text capture.
//! See `docs/design/shell-final-direction.md` §5 and GatherOS `capture.js`.
//!
//! ## Running-session rows (#52 job 1 / #13)
//!
//! Agents run for minutes with nothing on screen to say so unless the app is
//! frontmost. The tray menu is the one surface that is always reachable, so
//! it now lists sessions that are currently turning, above the capture
//! items. The data comes from `prime_session_host::list_running_sessions` —
//! the same roster read the menu-bar popover already polls
//! (`src/hooks/useMenuBarRunningSessions.ts`) — reused here rather than
//! duplicated. There is no push event for roster changes (the daemon only
//! answers a `list` query; see the doc comment on `list_running_sessions`),
//! so the tray keeps itself current with a background poll, deliberately
//! slower than the popover's 4s: the tray is visible far more of the time
//! the app is running than the popover ever is.
//!
//! The row-shaping logic (`session_title`, `running_session_rows`,
//! `tray_tooltip`, …) is a deliberately simplified mirror of
//! `src/lib/primeRunningSessions.ts`'s `rosterSessionTitle` /
//! `toRunningSessionRows` — same field names, same fallback order, no RLM
//! subagent-family bookkeeping. It is pure (no `tauri::App`), so it is
//! tested directly; only the `tauri::menu::Menu` construction around it
//! needs a live app and is exercised by hand (native QA, see the commit's
//! completion comment).

use serde_json::Value;

/// Stable webview label — also listed in `capabilities/default.json`.
pub const WINDOW_LABEL: &str = "menu-bar-companion";

/// Emitted to the main window when a menu-bar roster row is clicked (#13).
/// Payload is the session file path.
pub const OPEN_SESSION_EVENT: &str = "menu-bar-open-session";

/// How many running sessions the tray menu shows before it stops adding
/// rows. Matches the popover's own cap (`DEFAULT_LIMIT` in
/// `primeRunningSessions.ts`) — the tray is not a scrollable window either.
pub const TRAY_SESSION_ROW_LIMIT: usize = 5;

/// Row title length before truncation. Shorter than the popover's 44 chars:
/// the native tray menu is narrower than the 360px popover.
pub const TRAY_TITLE_MAX_LEN: usize = 36;

/// The item id for the disabled placeholder row shown when nothing is
/// running. Never dispatched — the item is disabled — but named so the click
/// handler's `match` can be exhaustive about ignoring it.
pub const NO_SESSIONS_ITEM_ID: &str = "no-sessions-running";

/// Prefix on a session row's menu-item id. The rest of the id is the
/// session's daemon handle (`activeSessionId`, falling back to `id`), which
/// is unique within one roster snapshot.
const SESSION_ITEM_PREFIX: &str = "session::";

/// One running, top-level (non-subagent) session, shaped for a tray row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionMenuRow {
    /// Daemon handle — `activeSessionId`, falling back to `id`. Used to
    /// build a unique menu-item id, not shown to the user.
    pub id: String,
    pub title: String,
    /// On-disk session file (`switch_prime_session`'s argument). Absent for
    /// a draft session that has never had a message — the row still opens
    /// the app, just not a specific session.
    pub session_file: Option<String>,
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The markers `cli_agent_runtime::build_prompt` composes a prompt with.
/// Kept as literals rather than shared because there is no common crate
/// between this and `primeRunningSessions.ts`'s identical pair — see that
/// file's `userWordsFrom` for the sibling implementation.
const SYSTEM_INSTRUCTIONS_PREFIX: &str = "System instructions:\n";
const USER_REQUEST_MARKER: &str = "\n\nUser request:\n";

/// Recover what the user typed from a composed first message. Mirrors
/// `userWordsFrom` in `primeRunningSessions.ts`.
fn user_words_from(message: &str) -> &str {
    let Some(rest) = message.strip_prefix(SYSTEM_INSTRUCTIONS_PREFIX) else {
        return message;
    };
    match rest.find(USER_REQUEST_MARKER) {
        Some(marker) => &rest[marker + USER_REQUEST_MARKER.len()..],
        None => message,
    }
}

fn truncate_title(value: &str, max_len: usize) -> String {
    if value.chars().count() <= max_len {
        return value.to_string();
    }
    let clipped: String = value.chars().take(max_len).collect();
    format!("{}…", clipped.trim_end())
}

/// The daemon handle a roster entry is keyed by. `activeSessionId` first,
/// `id` as a fallback — mirrors `sessionHandle` in `primeRunningSessions.ts`.
fn session_handle(session: &Value) -> Option<String> {
    session["activeSessionId"]
        .as_str()
        .or_else(|| session["id"].as_str())
        .map(str::to_string)
}

/// Whether a roster entry is a subagent rather than a top-level session.
/// Mirrors `isSubagent` in `primeRunningSessions.ts`.
fn is_subagent(session: &Value) -> bool {
    match session["runtimeKind"].as_str() {
        Some("subagent") => true,
        Some("top-level") => false,
        _ => session["rlmDepth"]
            .as_f64()
            .is_some_and(|depth| depth > 0.0),
    }
}

/// Whether a roster entry counts as running. Deliberately mirrors
/// `isRosterSessionRunning` in `primeRunningSessions.ts` — a second,
/// independent definition here would drift from the daemon's over time.
fn is_running(session: &Value) -> bool {
    if session["activeSessionId"].as_str().is_none() {
        return false;
    }
    session["hasActiveHeartbeat"].as_bool() == Some(true)
        || session["activity"].as_str() == Some("working")
        || session["isSessionActive"].as_bool() == Some(true)
        || session["hasRunningRlmChildren"].as_bool() == Some(true)
}

/// Agent-is-turning, as opposed to merely pinned by a heartbeat or a busy
/// child. Mirrors `isWorking` in `primeRunningSessions.ts`.
fn is_working(session: &Value) -> bool {
    session["activity"].as_str() == Some("working")
        || session["isSessionActive"].as_bool() == Some(true)
}

/// The label for a tray session row. See the module doc for why this is a
/// simplified mirror of `rosterSessionTitle`, not a port.
fn session_title(session: &Value, max_len: usize) -> String {
    let named = collapse_whitespace(session["sessionName"].as_str().unwrap_or(""));
    if !named.is_empty() {
        return truncate_title(&named, max_len);
    }

    let first_message = session["firstMessage"].as_str().unwrap_or("");
    let message = collapse_whitespace(user_words_from(first_message));
    if !message.is_empty() {
        return truncate_title(&message, max_len);
    }

    let cwd = session["cwd"].as_str().unwrap_or("").trim_end_matches('/');
    if let Some(folder) = cwd.rsplit('/').find(|segment| !segment.is_empty()) {
        return truncate_title(folder, max_len);
    }

    session_handle(session).unwrap_or_else(|| "Session".to_string())
}

/// How many top-level sessions are running, before the tray's row cap. The
/// tooltip counts this, not `running_session_rows().len()`, so it stays
/// honest when more sessions are running than the menu can show.
pub fn count_running_top_level_sessions(roster: &[Value]) -> usize {
    roster
        .iter()
        .filter(|session| !is_subagent(session))
        .filter(|session| is_running(session))
        .count()
}

/// Running top-level sessions, newest/busiest first, capped for the tray
/// menu. Mirrors `toRunningSessionRows` in `primeRunningSessions.ts` minus
/// the RLM subagent-count bookkeeping — the tray shows what is running, not
/// how deep its subagent tree goes.
pub fn running_session_rows(
    roster: &[Value],
    limit: usize,
    title_max_len: usize,
) -> Vec<SessionMenuRow> {
    let mut sessions: Vec<&Value> = roster
        .iter()
        .filter(|session| !is_subagent(session))
        .filter(|session| is_running(session))
        .collect();

    sessions.sort_by(|left, right| {
        let left_working = is_working(left);
        let right_working = is_working(right);
        if left_working != right_working {
            return right_working.cmp(&left_working);
        }
        let left_activity = left["lastActivityAt"].as_str().unwrap_or("");
        let right_activity = right["lastActivityAt"].as_str().unwrap_or("");
        right_activity.cmp(left_activity)
    });

    sessions
        .into_iter()
        .take(limit)
        .filter_map(|session| {
            let id = session_handle(session)?;
            Some(SessionMenuRow {
                title: session_title(session, title_max_len),
                session_file: session["sessionFile"].as_str().map(str::to_string),
                id,
            })
        })
        .collect()
}

/// The tray tooltip's text — reflects the running-session count (#52).
pub fn tray_tooltip(running_count: usize) -> String {
    match running_count {
        0 => "Rhizome".to_string(),
        1 => "Rhizome — 1 session running".to_string(),
        n => format!("Rhizome — {n} sessions running"),
    }
}

/// The menu-item id a session row gets. Exposed so the click handler and the
/// row builder agree on the format without a shared constant leaking further
/// than it needs to.
fn session_item_id(row: &SessionMenuRow) -> String {
    format!("{SESSION_ITEM_PREFIX}{}", row.id)
}

#[cfg(desktop)]
mod desktop {
    use super::{
        count_running_top_level_sessions, running_session_rows, session_item_id, tray_tooltip,
        SessionMenuRow, NO_SESSIONS_ITEM_ID, SESSION_ITEM_PREFIX, TRAY_SESSION_ROW_LIMIT,
        TRAY_TITLE_MAX_LEN, WINDOW_LABEL,
    };
    use crate::menu_bar_capture::{self, CaptureKind};
    use std::{
        collections::HashMap,
        sync::{Mutex, OnceLock},
        thread,
        time::Duration,
    };
    use tauri::{
        image::Image,
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, TrayIcon, TrayIconBuilder, TrayIconEvent},
        AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
    };

    const TRAY_ID: &str = "menu-bar-companion";
    const POPOVER_WIDTH: f64 = 360.0;
    const POPOVER_HEIGHT: f64 = 480.0;
    const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray/mark-template-32.png");

    /// How often the tray re-polls the roster in the background.
    ///
    /// Slower than the popover's 4s (`POLL_INTERVAL_MS` in
    /// `useMenuBarRunningSessions.ts`): that timer only runs while a 360px
    /// popover is on screen, which is rare. This one runs for as long as the
    /// app is open, so it is deliberately not a tight timer — see the module
    /// doc comment.
    const TRAY_REFRESH_INTERVAL: Duration = Duration::from_secs(15);

    /// `session::<id>` → on-disk session file, for the click handler. Rebuilt
    /// wholesale on every tray refresh rather than mutated incrementally —
    /// simpler, and the map is a handful of entries at most.
    static SESSION_ROW_FILES: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();

    fn session_row_files() -> &'static Mutex<HashMap<String, Option<String>>> {
        SESSION_ROW_FILES.get_or_init(|| Mutex::new(HashMap::new()))
    }

    /// Bring up the two menu-bar surfaces, independently.
    ///
    /// The hidden quick-note window and the tray icon have nothing to do with
    /// each other, and this used to run them with `?` between: a failure
    /// creating the window meant the tray was never built, so the app lost its
    /// menu-bar icon for a reason that had nothing to do with the icon. The
    /// caller then folded the whole thing into one `log::warn!`, so the only
    /// symptom was a missing icon and the cause sat in a log nobody reads.
    ///
    /// That matters more since the tray started reporting running sessions
    /// (#52, #13) — it is the one surface that says an agent finished without
    /// the app being opened. Losing it to an unrelated failure loses that.
    ///
    /// Each half is attempted, each failure is logged saying which half died,
    /// and an error comes back only if BOTH failed — one working surface is
    /// not a failed setup. #53.
    pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let window = ensure_companion_window(app.handle());
        if let Err(error) = &window {
            log::warn!("menu-bar quick-note window failed: {error}");
        }

        let tray = setup_tray(app);
        if let Err(error) = &tray {
            log::warn!("menu-bar tray icon failed: {error}");
        }

        if window.is_err() && tray.is_err() {
            return Err("both the menu-bar quick-note window and the tray icon failed".into());
        }
        Ok(())
    }

    fn tray_icon() -> Result<Image<'static>, String> {
        Image::from_bytes(TRAY_ICON_BYTES).map_err(|err| format!("tray icon decode failed: {err}"))
    }

    /// Build the full tray menu for one roster snapshot: running-session rows
    /// (or a disabled placeholder) above a separator, then the existing
    /// capture / quick-note / open / quit items unchanged.
    fn build_menu(app: &AppHandle, rows: &[SessionMenuRow]) -> tauri::Result<Menu<tauri::Wry>> {
        let mut items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();

        if rows.is_empty() {
            let placeholder = MenuItem::with_id(
                app,
                NO_SESSIONS_ITEM_ID,
                "No sessions running",
                false,
                None::<&str>,
            )?;
            items.push(Box::new(placeholder));
        } else {
            for row in rows {
                let item =
                    MenuItem::with_id(app, session_item_id(row), &row.title, true, None::<&str>)?;
                items.push(Box::new(item));
            }
        }
        items.push(Box::new(PredefinedMenuItem::separator(app)?));

        let capture_area = MenuItem::with_id(
            app,
            "capture-area",
            "Capture Area",
            true,
            Some("CmdOrCtrl+Shift+S"),
        )?;
        let capture_full = MenuItem::with_id(
            app,
            "capture-fullscreen",
            "Capture Fullscreen",
            true,
            None::<&str>,
        )?;
        let capture_window =
            MenuItem::with_id(app, "capture-window", "Capture Window…", true, None::<&str>)?;
        items.push(Box::new(capture_area));
        items.push(Box::new(capture_full));
        items.push(Box::new(capture_window));
        items.push(Box::new(PredefinedMenuItem::separator(app)?));

        let quick_note = MenuItem::with_id(app, "quick-note", "Quick Note…", true, None::<&str>)?;
        let open_item = MenuItem::with_id(app, "open-rhizome", "Open Rhizome", true, None::<&str>)?;
        items.push(Box::new(quick_note));
        items.push(Box::new(open_item));
        items.push(Box::new(PredefinedMenuItem::separator(app)?));

        let quit_item = MenuItem::with_id(app, "quit", "Quit Rhizome", true, None::<&str>)?;
        items.push(Box::new(quit_item));

        let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
            items.iter().map(|item| item.as_ref()).collect();
        Menu::with_items(app, &refs)
    }

    fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let menu = build_menu(app.handle(), &[])?;
        let icon = tray_icon().map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

        let tray = TrayIconBuilder::with_id(TRAY_ID)
            .icon(icon)
            .tooltip(tray_tooltip(0))
            .menu(&menu)
            // GatherOS-style: click opens the tool menu (capture), not a blank app.
            .show_menu_on_left_click(true)
            .on_menu_event(|app, event| {
                let id = event.id.as_ref();
                if let Some(session_id) = id.strip_prefix(SESSION_ITEM_PREFIX) {
                    open_session_row(app, session_id);
                    return;
                }
                match id {
                    "capture-area" => spawn_capture(app, CaptureKind::Area),
                    "capture-fullscreen" => spawn_capture(app, CaptureKind::Fullscreen),
                    "capture-window" => spawn_capture(app, CaptureKind::Window),
                    "quick-note" => {
                        if let Err(err) = toggle_companion_window(app, None) {
                            log::warn!("menu-bar quick note failed: {err}");
                        }
                    }
                    "open-rhizome" => focus_main_window(app),
                    "quit" => app.exit(0),
                    // NO_SESSIONS_ITEM_ID is disabled and never dispatches; kept
                    // here so this match documents that explicitly rather than
                    // falling through the wildcard by accident.
                    NO_SESSIONS_ITEM_ID => {}
                    _ => {}
                }
            })
            .on_tray_icon_event(|tray, event| {
                // Double-click only was too easy to miss once the window could
                // be hidden rather than closed (C22): the tray became the main
                // way back and a single click did nothing.
                if let TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } = event
                {
                    focus_main_window(tray.app_handle());
                }
            })
            .build(app)?;

        #[cfg(target_os = "macos")]
        {
            if let Err(err) = tray.set_icon_as_template(true) {
                log::warn!("failed to mark tray icon as template: {err}");
            }
        }

        app.manage(MenuBarTrayState(tray));

        spawn_tray_refresh_loop(app.handle().clone());

        Ok(())
    }

    /// Poll the running-session roster and rebuild the tray menu + tooltip
    /// on a background thread. Runs once immediately (so the tray does not
    /// sit on the empty-state menu for a full interval after launch), then
    /// every `TRAY_REFRESH_INTERVAL`.
    ///
    /// Deliberately not a tight timer, per the module doc: there is no push
    /// event for roster changes, so this is the only way to keep the tray
    /// current, and it shares `list_running_sessions`'s own single-flight
    /// guard with the popover's poll rather than adding a second one.
    fn spawn_tray_refresh_loop(app: AppHandle) {
        thread::Builder::new()
            .name("menu-bar-tray-refresh".into())
            .spawn(move || loop {
                refresh_tray(&app);
                thread::sleep(TRAY_REFRESH_INTERVAL);
            })
            .ok();
    }

    fn refresh_tray(app: &AppHandle) {
        let roster = match crate::prime_session_host::list_running_sessions() {
            Ok(roster) => roster,
            Err(err) => {
                log::warn!("menu-bar tray roster read failed: {err}");
                Vec::new()
            }
        };

        let rows = running_session_rows(&roster, TRAY_SESSION_ROW_LIMIT, TRAY_TITLE_MAX_LEN);
        let running_count = count_running_top_level_sessions(&roster);

        let mut files = HashMap::new();
        for row in &rows {
            files.insert(session_item_id(row), row.session_file.clone());
        }
        if let Ok(mut guard) = session_row_files().lock() {
            *guard = files;
        }

        let Some(state) = app.try_state::<MenuBarTrayState>() else {
            return;
        };
        match build_menu(app, &rows) {
            Ok(menu) => {
                if let Err(err) = state.0.set_menu(Some(menu)) {
                    log::warn!("menu-bar tray menu rebuild failed: {err}");
                }
            }
            Err(err) => log::warn!("menu-bar tray menu build failed: {err}"),
        }
        if let Err(err) = state.0.set_tooltip(Some(tray_tooltip(running_count))) {
            log::warn!("menu-bar tray tooltip update failed: {err}");
        }
    }

    fn open_session_row(app: &AppHandle, session_id: &str) {
        let session_file = session_row_files()
            .lock()
            .ok()
            .and_then(|files| {
                files
                    .get(&format!("{SESSION_ITEM_PREFIX}{session_id}"))
                    .cloned()
            })
            .flatten();
        open_session(app, session_file);
    }

    fn spawn_capture(app: &AppHandle, kind: CaptureKind) {
        let app = app.clone();
        // screencapture blocks the UI thread if run inline — offload.
        std::thread::spawn(move || match menu_bar_capture::capture_to_vault(kind) {
            Ok(Some(result)) => {
                log::info!(
                    "menu-bar capture saved note={} image={}",
                    result.note_relative,
                    result.image_relative
                );
                // Nudge main window so vault refresh / activity can pick up the file.
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.emit("menu-bar-capture-saved", result.note_relative);
                }
            }
            Ok(None) => log::info!("menu-bar capture cancelled"),
            Err(err) => log::warn!("menu-bar capture failed: {err}"),
        });
    }

    fn ensure_companion_window(app: &AppHandle) -> Result<(), String> {
        if app.get_webview_window(WINDOW_LABEL).is_some() {
            return Ok(());
        }

        let url = WebviewUrl::App("index.html?window=menu-bar-companion".into());
        WebviewWindowBuilder::new(app, WINDOW_LABEL, url)
            .title("Rhizome")
            .inner_size(POPOVER_WIDTH, POPOVER_HEIGHT)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .closable(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .focused(false)
            .build()
            .map_err(|err| format!("failed to create menu-bar companion window: {err}"))?;
        Ok(())
    }

    pub fn toggle_companion_window(
        app: &AppHandle,
        tray_rect: Option<tauri::Rect>,
    ) -> Result<(), String> {
        ensure_companion_window(app)?;
        let Some(window) = app.get_webview_window(WINDOW_LABEL) else {
            return Err("menu-bar companion window missing".into());
        };

        let visible = window.is_visible().unwrap_or(false);
        if visible {
            window.hide().map_err(|e| e.to_string())?;
            return Ok(());
        }

        if let Some(rect) = tray_rect {
            position_near_tray(&window, rect)?;
        }

        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    }

    fn position_near_tray(
        window: &tauri::WebviewWindow,
        tray_rect: tauri::Rect,
    ) -> Result<(), String> {
        let scale = window.scale_factor().unwrap_or(1.0);
        let pos = tray_rect.position.to_physical::<f64>(scale);
        let size = tray_rect.size.to_physical::<f64>(scale);

        let width_px = POPOVER_WIDTH * scale;
        let x = pos.x + size.width - width_px;
        let y = pos.y + size.height + (4.0 * scale);

        window
            .set_position(tauri::Position::Physical(PhysicalPosition {
                x: x.round() as i32,
                y: y.round() as i32,
            }))
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn focus_main_window(app: &AppHandle) {
        // Use the same restore path as dock clicks and second-instance opens.
        // On macOS, showing the window is not enough after the last window was
        // hidden: the application itself must be unhidden first.
        crate::focus_main_window(app);
        if let Some(companion) = app.get_webview_window(WINDOW_LABEL) {
            let _ = companion.hide();
        }
    }

    pub fn hide_companion_window(app: &AppHandle) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
            window.hide().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Focus the main window, optionally routing it to a specific session.
    /// Shared by the tray's own click handler and
    /// `open_main_from_menu_bar_companion` (the popover's equivalent command)
    /// so there is one implementation of "open and maybe switch", not two.
    pub fn open_session(app: &AppHandle, session_file: Option<String>) {
        focus_main_window(app);
        let Some(session_file) = session_file.filter(|path| !path.is_empty()) else {
            return;
        };
        let Some(main) = app.get_webview_window("main") else {
            return;
        };
        // Best-effort: the roster row still opened the app, which is the
        // majority of the value, so a failed emit must not read back as
        // "nothing happened".
        if let Err(error) = main.emit(super::OPEN_SESSION_EVENT, session_file) {
            log::warn!("failed to route menu-bar session open: {error}");
        }
    }

    /// The tray icon, stashed with `app.manage` so `refresh_tray` can look it
    /// back up by type on every poll to rebuild its menu and tooltip.
    struct MenuBarTrayState(TrayIcon);
}

#[cfg(desktop)]
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    desktop::setup(app)
}

#[tauri::command]
pub fn toggle_menu_bar_companion(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        desktop::toggle_companion_window(&app, None)
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("menu-bar companion is desktop-only".into())
    }
}

#[tauri::command]
pub fn hide_menu_bar_companion(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        desktop::hide_companion_window(&app)
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("menu-bar companion is desktop-only".into())
    }
}

/// Focus the main window, optionally landing on a specific Prime session.
///
/// `session_file` is the roster's `sessionFile` — the same path
/// `switch_prime_session` takes. The switch itself happens in the main
/// window (it owns the transcript state), so this focuses and then emits;
/// a companion popover cannot drive another window's React tree directly.
#[tauri::command]
pub fn open_main_from_menu_bar_companion(
    app: tauri::AppHandle,
    session_file: Option<String>,
) -> Result<(), String> {
    #[cfg(desktop)]
    {
        desktop::open_session(&app, session_file);
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, session_file);
        Err("menu-bar companion is desktop-only".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn companion_window_label_is_stable() {
        assert_eq!(WINDOW_LABEL, "menu-bar-companion");
    }

    // ── tray_tooltip ─────────────────────────────────────────────────────

    #[test]
    fn tray_tooltip_says_rhizome_when_idle() {
        assert_eq!(tray_tooltip(0), "Rhizome");
    }

    #[test]
    fn tray_tooltip_is_singular_for_one_session() {
        assert_eq!(tray_tooltip(1), "Rhizome — 1 session running");
    }

    #[test]
    fn tray_tooltip_is_plural_for_multiple_sessions() {
        assert_eq!(tray_tooltip(2), "Rhizome — 2 sessions running");
        assert_eq!(tray_tooltip(11), "Rhizome — 11 sessions running");
    }

    // ── session_title ────────────────────────────────────────────────────

    #[test]
    fn session_title_prefers_session_name() {
        let session = json!({ "sessionName": "  My   Session  ", "firstMessage": "ignored" });
        assert_eq!(session_title(&session, 40), "My Session");
    }

    #[test]
    fn session_title_falls_back_to_first_message_stripped_of_system_prefix() {
        let session = json!({
            "firstMessage": "System instructions:\nYou are working inside Rhizome.\n\nUser request:\nFix the login bug"
        });
        assert_eq!(session_title(&session, 40), "Fix the login bug");
    }

    #[test]
    fn session_title_falls_back_to_cwd_folder_when_no_message() {
        let session = json!({ "cwd": "/Users/dtc/code/projects/rhizome-agent/" });
        assert_eq!(session_title(&session, 40), "rhizome-agent");
    }

    #[test]
    fn session_title_falls_back_to_handle_when_nothing_else_is_present() {
        let session = json!({ "activeSessionId": "abc123" });
        assert_eq!(session_title(&session, 40), "abc123");
    }

    #[test]
    fn session_title_falls_back_to_session_literal_when_totally_empty() {
        let session = json!({});
        assert_eq!(session_title(&session, 40), "Session");
    }

    #[test]
    fn session_title_truncates_on_a_char_boundary_with_ellipsis() {
        let session = json!({ "sessionName": "a very long session title that goes on and on" });
        let title = session_title(&session, 10);
        assert!(title.chars().count() <= 11, "got {title:?}");
        assert!(title.ends_with('…'));
    }

    // ── running_session_rows / count_running_top_level_sessions ────────────

    fn working_session(id: &str) -> Value {
        json!({ "activeSessionId": id, "activity": "working", "firstMessage": id })
    }

    #[test]
    fn running_session_rows_excludes_subagents() {
        let roster = vec![
            working_session("root"),
            json!({ "activeSessionId": "child", "activity": "working", "runtimeKind": "subagent" }),
        ];
        let rows = running_session_rows(&roster, 5, 40);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "root");
    }

    #[test]
    fn running_session_rows_excludes_sessions_that_are_not_running() {
        let roster = vec![
            working_session("busy"),
            json!({ "activeSessionId": "idle", "activity": "idle" }),
        ];
        let rows = running_session_rows(&roster, 5, 40);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "busy");
    }

    #[test]
    fn running_session_rows_requires_an_active_session_id() {
        let roster = vec![json!({ "id": "no-active-session-id", "activity": "working" })];
        assert!(running_session_rows(&roster, 5, 40).is_empty());
    }

    #[test]
    fn running_session_rows_respects_the_limit() {
        let roster: Vec<Value> = (0..8).map(|i| working_session(&format!("s{i}"))).collect();
        let rows = running_session_rows(&roster, 3, 40);
        assert_eq!(rows.len(), 3);
    }

    #[test]
    fn running_session_rows_sorts_actively_working_sessions_first() {
        let roster = vec![
            json!({ "activeSessionId": "waiting", "hasActiveHeartbeat": true }),
            working_session("working"),
        ];
        let rows = running_session_rows(&roster, 5, 40);
        assert_eq!(rows[0].id, "working");
        assert_eq!(rows[1].id, "waiting");
    }

    #[test]
    fn running_session_rows_carries_the_session_file_through() {
        let roster = vec![json!({
            "activeSessionId": "s1",
            "activity": "working",
            "sessionFile": "/vault/.rhizome/sessions/s1.jsonl"
        })];
        let rows = running_session_rows(&roster, 5, 40);
        assert_eq!(
            rows[0].session_file.as_deref(),
            Some("/vault/.rhizome/sessions/s1.jsonl")
        );
    }

    #[test]
    fn running_session_rows_is_empty_for_an_empty_roster() {
        assert!(running_session_rows(&[], 5, 40).is_empty());
    }

    #[test]
    fn count_running_top_level_sessions_matches_the_filtered_total_ignoring_the_cap() {
        let roster: Vec<Value> = (0..8).map(|i| working_session(&format!("s{i}"))).collect();
        assert_eq!(count_running_top_level_sessions(&roster), 8);
        assert_eq!(running_session_rows(&roster, 3, 40).len(), 3);
    }

    #[test]
    fn count_running_top_level_sessions_excludes_subagents() {
        let roster = vec![
            working_session("root"),
            json!({ "activeSessionId": "child", "activity": "working", "runtimeKind": "subagent" }),
        ];
        assert_eq!(count_running_top_level_sessions(&roster), 1);
    }
}
