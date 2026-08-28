---
session: 2026-08-27T22:23-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Made failures legible. One ambiguous sentence was hiding three unrelated
  bugs; fixed all three (C51 empty-turn promote, C53 vault in ~/Documents,
  provider refusals), completed the #47 pre-public gate, and cut the model
  picker's unusable fifth.
commits: 2360cb5, 9e50a8d, be23da8, aa5ab69, ea21050, e90e37c, 10cf3d9, b21211b, eaa1c69, bb00152
---

# Failure legibility — stop here 2026-08-27

## The one thing to take away

**"Prime Agent finished without returning a reply" was standing in for at
least three unrelated failures**, and that single ambiguous sentence cost
about two days across two sessions:

| actually happening | looked like |
|---|---|
| Prime session worker dying on `uv_cwd` (C53) | a flaky model |
| provider refusing: 402 / 429 / 404 / 403 | a flaky model |
| a model genuinely saying nothing | a flaky model |

`stealth/ox-alpha` was written off as unreliable. It was returning **404 —
the Stealth Ox Alpha testing period ended**. `openrouter/auto-beta` was 0
for 12 because the account **never purchased credits**. Neither was
discoverable from inside the app.

Everything below follows from that.

## What landed

**C51 — promote wrote a placeholder into the vault** (`2360cb5`, `9e50a8d`).
Save to vault promoted the empty-turn placeholder as if it were the reply.
Guarded with `isTransientAgentFailureText`, the predicate auto-distill
already used, which widened the fix to error payloads and auth failures for
free. A second variant was found while adding the test seam: OpenCode's
empty-turn string differs from the generic one and was still promotable.
`MOCK_EMPTY_REPLY_PROMPT` exists because the empty-turn path was
**unreachable in mock mode** — plausibly why the bug shipped.

**C53 — a vault in `~/Documents` broke every chat turn** (`be23da8`).
`Info.plist` declared only `NSLocalNetworkUsageDescription`, so macOS never
prompted for Documents/Desktop/Downloads and the app could not obtain access
even when properly bundled. Prime's session worker died at launch on
`process.cwd()` and the supervisor timed out after 30s. **Not dev-only.**
Guarded by `src/utils/macOsFolderAccessConfig.test.ts`.

**Provider errors now surface** (`ea21050`) — **verified live** against a
real 402. Prime records `stopReason: "error"` and a human-readable
`errorMessage`; Rhizome discarded both. Now passed through verbatim, because
the provider names the account, model or limit at fault better than we can.

**#46 — `$HOME` clobbered Prime's global config** (`e90e37c`). Chat without
a vault is supported, `normalize_cwd("")` returns `$HOME`, and
`$HOME/.prime/agent/settings.json` *is* Prime's global config. `looks_like_vault`
could not catch it: one stray `.md` satisfies it, and this machine's home has
five plus a `.rhizome` dir. Guard is explicit. The stale entry was also
removed from the user's live config.

**#47 pre-public gate — complete.** Items 1 and 2 above; item 3 is
`src-tauri/src/preflight.rs` (`10cf3d9`) plus `ChatPreflightBanner`
(`b21211b`) above the composer.

**#45 — model picker** (`eaa1c69`, `bb00152`). Filter box; models whose
provider has no credentials moved behind a "Not connected" toggle;
Settings → AI agents lists connection state and flags expired OAuth.

## Design rules these share — keep them

- **A failure report must carry a remedy.** `CheckResult::Failed` makes
  `remedy` required, and a test enforces every path fills it.
- **Never guess a failure.** Unknown credentials → show everything, say
  nothing. A banner that cries wolf on a healthy setup gets scrolled past,
  and then it is worth less than nothing. Applies in
  `check_provider_connected`, `partitionModelsByConnection`, and the banner
  itself (silent when the check errors).
- **Separate, don't hide.** Unusable models stay reachable so "why can't I
  find X?" remains answerable.
- **Re-check, don't check once.** C53 broke a setup that *had been working*,
  so a first-run-only check would have reported "all good".

## Numbers worth not re-deriving

- **501 models** offered; **105 (20%)** from `prime-inference`, which this
  account never signed into.
- Per-model reliability, 40 recent sessions: `hy3-free` 45/0, `grok-4.5`
  86/0, `claude-opus-5` 20/0, `deepseek-v4-flash-free` 7/33,
  `stealth/ox-alpha` 14/18, **`auto-beta` 0/12**. Not credits, not provider
  — per **model**.
- Prime supports six providers: `anthropic`, `opencode`, `opencode-go`,
  `openrouter`, `prime-inference`, `xai`. **No Nous Portal**, and
  `settings.json` has no custom-provider/baseURL mechanism.
- Prime's daemon has **no auth/login command** in any of its 102, so
  connecting a provider from Rhizome needs an ADR, not a button.

## Still open

- **#24** — promote is fixed, unit-tested and Playwright-covered, but never
  got its native live check. Close on that evidence or run the check.
- **C52** — `ai-chat-history.spec.ts` fails all 4; its setup predates
  ADR-0166. Working setup is in `promote-refuses-empty-turn.spec.ts`.
- **Not live-verified:** the preflight banner and the provider settings
  section. Both need a genuinely blocked vault or unconnected provider;
  `prime-inference` is the easy repro.

## Process note

Four causal explanations were asserted before being tested this session —
"flaky model", "OpenRouter credits", "TCC per-process cache", "code-signature
invalidation". All four were wrong, and the answer was on disk each time.
**Read `~/.prime/agent/sessions/*.jsonl` and `~/.prime/agent/logs/` before
theorising.** The user called this out; it is the most useful thing in this
file.
