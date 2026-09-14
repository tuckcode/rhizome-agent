---
session: 2026-09-14T11:24-05:00
model: Composer 2.5 (Cursor)
description: >-
  W9 closure check for #53. Source PASS — tray survives quick-note window
  failure (e469ee4, still on HEAD). Native NOT RUN — no forced-failure repro.
---

# W9 — tray / quick-note closure evidence

**Origin:** Composer 2.5 · 2026-09-14 · W9 packet from Astra s-plan

## Verdict

| Check | Result |
|---|---|
| Source: tray survives quick-note window failure | **PASS** |
| Native: forced quick-note window failure, tray still appears | **NOT RUN** |
| Issue #53 state | **CLOSED** (do not reopen) |

**Overall:** Implementation closure is **accepted on source evidence**. Native proof of the failure path is still absent.

## Issue #53 (closed)

GitHub [#53](https://github.com/tuckcode/rhizome-agent/issues/53): *A failure creating the quick-note window silently costs you the menu bar icon.*

**Bug:** `menu_bar_companion::setup` ran `ensure_companion_window(app)?` then `setup_tray(app)?`. A window failure short-circuited before tray creation. `lib.rs` logged one combined warning, so users saw a missing icon with no clear cause.

**Fix requested:** Attempt both halves independently; log each failure by name; return error only when **both** fail.

## Fix commit

`e469ee48fb5a25ea4384459ba424f84c5435cbdf` — *fix: the tray icon no longer dies with the quick-note window (#53)* (2026-08-29).

Ancestor of current HEAD (`4416411`). Single-file change: `src-tauri/src/menu_bar_companion.rs`.

## Source trace (current HEAD)

### 1. Independent setup — `desktop::setup`

```293:307:src-tauri/src/menu_bar_companion.rs
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
```

**Control flow:**

1. Window creation is attempted; failure is logged, not propagated with `?`.
2. `setup_tray(app)` runs **unconditionally** after the window attempt.
3. `Ok(())` when either half succeeds — tray alone is sufficient for successful setup.
4. `Err` only when window **and** tray both fail.

This matches #53 acceptance exactly.

### 2. Caller — `lib.rs`

```453:455:src-tauri/src/lib.rs
    if let Err(err) = menu_bar_companion::setup(app) {
        log::warn!("menu-bar companion setup failed: {err}");
    }
```

The outer warning now fires only on the dual-failure path. A window-only failure leaves setup `Ok(())` and produces the per-half log line instead.

### 3. Quick-note window vs tray at runtime

- **Window:** `ensure_companion_window` builds hidden webview `menu-bar-companion` (`WebviewWindowBuilder`, visible=false).
- **Tray:** `setup_tray` builds `TrayIconBuilder`, menu, refresh loop — no dependency on window existing first.
- **Quick Note menu item:** `toggle_companion_window` calls `ensure_companion_window` again at use time; tray menu works even if initial window creation failed (Quick Note would warn on click).

### 4. Tests

Existing tests cover tray row shaping, tooltips, and `WINDOW_LABEL` stability. **No unit test** injects a window-build failure and asserts tray setup still runs. Commit QA note: *"verified by reading the control flow rather than by triggering it."*

## Native evidence

**NOT RUN.**

- #53 and `e469ee4` both state window creation does not fail in normal dev/QA environments.
- No recorded native run forcing `WebviewWindowBuilder::build` failure while observing tray presence.
- MORNING (2026-09-14) lists W9 as *"closed on GitHub. Native leftover only."*

**What native would need (future regression only):** inject or simulate companion-window build failure at startup, confirm menu-bar icon appears and `menu-bar quick-note window failed` appears in logs without `menu-bar companion setup failed`.

## Contradictions

None found. No stale open-state in s-plan; no source regression since `e469ee4`.

## Capacity release

No tray refactor warranted. W4/W7 may proceed; `lib.rs` outer warn path unchanged and acceptable per #53 scope.
