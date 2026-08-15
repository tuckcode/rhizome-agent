//! macOS menu-bar companion (tray icon + capture menu + optional popover).
//!
//! Tray behavior follows GatherOS: the menu is the tool (capture area /
//! window / fullscreen → vault), not just Open/Quit. Left-click opens the
//! menu. "Quick note" still toggles the webview popover for text capture.
//! See `docs/design/shell-final-direction.md` §5 and GatherOS `capture.js`.

/// Stable webview label — also listed in `capabilities/default.json`.
pub const WINDOW_LABEL: &str = "menu-bar-companion";

#[cfg(desktop)]
mod desktop {
    use super::WINDOW_LABEL;
    use crate::menu_bar_capture::{self, CaptureKind};
    use tauri::{
        image::Image,
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
        AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
    };

    const TRAY_ID: &str = "menu-bar-companion";
    const POPOVER_WIDTH: f64 = 360.0;
    const POPOVER_HEIGHT: f64 = 480.0;
    const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray/mark-template-32.png");

    pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        ensure_companion_window(app.handle())?;
        setup_tray(app)?;
        Ok(())
    }

    fn tray_icon() -> Result<Image<'static>, String> {
        Image::from_bytes(TRAY_ICON_BYTES).map_err(|err| format!("tray icon decode failed: {err}"))
    }

    fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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
        let quick_note = MenuItem::with_id(app, "quick-note", "Quick Note…", true, None::<&str>)?;
        let sep1 = PredefinedMenuItem::separator(app)?;
        let open_item = MenuItem::with_id(app, "open-rhizome", "Open Rhizome", true, None::<&str>)?;
        let sep2 = PredefinedMenuItem::separator(app)?;
        let quit_item = MenuItem::with_id(app, "quit", "Quit Rhizome", true, None::<&str>)?;

        let menu = Menu::with_items(
            app,
            &[
                &capture_area,
                &capture_full,
                &capture_window,
                &sep1,
                &quick_note,
                &open_item,
                &sep2,
                &quit_item,
            ],
        )?;
        let icon = tray_icon().map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

        let tray = TrayIconBuilder::with_id(TRAY_ID)
            .icon(icon)
            .tooltip("Rhizome")
            .menu(&menu)
            // GatherOS-style: click opens the tool menu (capture), not a blank app.
            .show_menu_on_left_click(true)
            .on_menu_event(|app, event| match event.id.as_ref() {
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
                _ => {}
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

        #[allow(dead_code)]
        struct MenuBarTray(tauri::tray::TrayIcon);
        app.manage(MenuBarTray(tray));
        Ok(())
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
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
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

#[tauri::command]
pub fn open_main_from_menu_bar_companion(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        desktop::focus_main_window(&app);
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("menu-bar companion is desktop-only".into())
    }
}

#[cfg(test)]
mod tests {
    use super::WINDOW_LABEL;

    #[test]
    fn companion_window_label_is_stable() {
        assert_eq!(WINDOW_LABEL, "menu-bar-companion");
    }
}
