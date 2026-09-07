---
session: 2026-09-06-2157
model: Composer
description: >-
  Confirm-in-app then close GitHub #47 (distinguishable failure states).
  Implementation already shipped; no product code in this slice.
---

# #47 — close checklist (confirm only)

**Origin:** Composer · 2026-09-06 21:57 · planning-only  
**Parent triage:** [2150 Chat leftovers](2026-09-06-2150-composer-chat-leftovers-triage.md) § GitHub #47  
**Verdict from triage:** Implementation complete since 2026-08-27. Open item is **confirm-and-close**, not new product work.

## Shipped (do not re-implement)

| Piece | Commit / path |
|---|---|
| Provider error pass-through | `ea21050` |
| Preflight + remedy | `10cf3d9` — `src-tauri/src/preflight.rs` |
| Banner above composer | `b21211b` — `ChatPreflightBanner` |
| OAuth expiry not “connected” | `0a71d84` tree (`preflight.rs` / Chat preflight) |

Gate claim: [2223 failure-legibility](2026-08-27-2223-claude-opus-5-failure-legibility.md) — “#47 pre-public gate — complete.”

## 1. Confirm in app (~45–60 min native)

No code unless a hole shows. Healthy setup → banner **silent**.

| # | Setup | Expect |
|---|---|---|
| A | Unconnected provider, or expired OAuth | Banner: reason + remedy (Terminal reconnect / connect provider). Chat does **not** look “green.” |
| B | Blocked vault path (TCC / missing folder) | Vault blocker + remedy; provider check secondary. |
| C | Optional: force a provider error turn (402/429/404) | Message is **provider text**, not “finished without a reply.” |

Pass = A+B clean (C optional). Fail = one hole → file **new** issue; leave #47 open only for that hole. Do **not** expand into Settings IA or a new failure taxonomy.

## 2. Close on GitHub (~15 min)

**`gh` auth may be broken** (`keyring` token invalid per 2150). Refresh first:

```bash
gh auth status
# if bad:
gh auth refresh
gh issue view 47
```

If confirm passed:

```bash
gh issue close 47 --comment "$(cat <<'EOF'
Confirmed in-app: preflight banner + provider error pass-through make failure states distinguishable.

Shipped:
- ea21050 provider error pass-through
- 10cf3d9 preflight + remedy (src-tauri/src/preflight.rs)
- b21211b ChatPreflightBanner
- 0a71d84 OAuth expiry no longer counts as connected

Confirm checklist: unconnected/expired provider → banner + remedy; vault blocker → remedy; provider error turn → provider text (not generic empty reply).
EOF
)"
```

Then drop “#47 confirm before closing” from `docs/NEXT.md` §0 / open table (docs-only; same or follow-up docs commit).

If `gh` still broken: paste the same close comment in the GitHub UI, or leave a sticky note for the next session with working auth — **do not claim closed** from docs alone.

## What NOT to do

- No product code unless confirm finds a hole.
- No Settings redesign / failure taxonomy rewrite.
- No commit from a planning-only pass.
- Do not fight other agents’ git index / push files.
