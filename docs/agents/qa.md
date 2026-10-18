# UI and native QA

**Origin:** Claude Opus 5.5 · 2026-10-17 · moved verbatim from `AGENTS.md` by `/doctor` to cut always-loaded context.


**Phase 1 — Playwright (only for core user flows):**

Write Playwright test in `tests/smoke/<slug>.spec.ts` only if feature touches: vault open, note create/save/delete, search, wikilink navigation, git commit/push, conflict resolution. Tag a test with `@smoke` only if it protects a core pre-push workflow. Do NOT tag cosmetic or mock-heavy checks — keep those in the full regression lane. Prefer `.chunk/run-playwright-smoke.sh` on a Chunk sidecar for the curated smoke lane because local Playwright is expensive; keep `pnpm playwright:smoke` available for focused local reproduction. The curated smoke suite must stay under **5 minutes** when sharded on sidecars; use `pnpm playwright:regression` for the full Playwright pass.

```bash
pnpm dev --port 5201 &
sleep 3
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/<slug>.spec.ts
```

### Phase 2 — Native app QA:

Native QA requires either Accessibility permission for osascript or a real `.app` bundle built with `pnpm tauri build`. See §3 "QA scripts" for the local-script gotcha. Use `computer-use` for native UI interaction (click, hover, drag, scroll, type) and Playwright for deterministic text-input coverage.

```bash
pnpm tauri dev &
sleep 10
# Use computer-use to interact with the native app window
# Focus: click the tray mark → type in the search field → verify results
```

Use computer-use/browser-control style interaction for native UI QA when available: click, hover, drag, select, scroll, and type the way a real user would with the mouse and trackpad. For every UI feature, test the primary mouse-driven path first, then verify any relevant keyboard shortcut or keyboard-first workflow still works. Rhizome is still a keyboard-first app, but QA must not assume users only interact by keyboard.

Use `osascript` for app focus, keyboard shortcuts, and keyboard-specific checks. **⚠️ WKWebView:** `osascript keystroke` can be blocked inside editor content — use computer use for native editor interaction when possible, and rely on Playwright for deterministic text-input coverage. Record the result (✅ or ❌) in the commit message or completion comment.

## QA scripts

Use `computer-use` for native app focus, keyboard shortcuts, and screenshot capture. For keyboard-first checks: use Playwright for text input and deterministic assertions; use `osascript` only for app-focus and menu-shortcut verification (note: WKWebView blocks `osascript keystroke` inside editor content).
