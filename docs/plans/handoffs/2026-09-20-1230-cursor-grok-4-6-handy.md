---
session: 2026-09-20T12:30-05:00
model: Grok 4.6 (Cursor)
description: >-
  Handy wrap. Local main ffc135f is 11 commits ahead of origin ba7702f.
  App remains b7264d6. Free-only is dirty. Edit-list UX is unfinished.
  Astra recap is the 1228 file. Vite 5202 is stopped.
commits: none this wrap
---

# Handy — 20 September 12:30

**Origin:** Grok 4.6 · Cursor · 2026-09-20 12:30.

## Exact state

| Surface | Value |
|---|---|
| Branch | `main` at `ffc135f` |
| Origin | `ba7702f` — **11 local commits unpushed** (D1–D7 merges + slices) |
| App | `/Applications/Rhizome Agent.app` **07:23**, last stamped `b7264d6` |
| Vite 5202 | **stopped** |
| Prime | 0.9.3. `auth.json` keys: anthropic, deepseek, opencode, opencode-go, openrouter, xai. **No `nvidia`.** |

Dirty (uncommitted):

- `src/lib/primeModels.ts` + test — Free-only from live marks
- `src/components/PrimeModelPicker.tsx` + test
- `src/components/PrimeModelAllowListSection.tsx` + test
- `src/lib/productAnalytics.ts` — `trackPrimeModelsFreeOnly`
- `src/components/ChatComposerDeck.test.tsx` — mock only
- `AGENTS.md` — Learned interrupt line
- `.cursor/rules/one-job-in-flight.mdc` — tally headings
- `docs/HANDOFF.md` + untracked `2026-09-20-1228` recap

Story of the morning:
[`2026-09-20-1228-cursor-grok-4-6-astra-cursor-recap.md`](2026-09-20-1228-cursor-grok-4-6-astra-cursor-recap.md).

## Findings a fresh session will miss

- NVIDIA **is** Prime provider `nvidia` / `NVIDIA_API_KEY`. Missing from this catalog because the key is not in auth. NIM ids have **no** `:free` suffix. OpenRouter still has `nvidia/…:free` twins.
- Free only is a **live** catalog cut (OpenRouter `:free` / `openrouter/free`, OpenCode `-free`). Do not snapshot free ids into the allow-list.
- Empty allow-list still means “show all.” That is why Settings feels like everything is already on. Hermes-style **Edit list** (picker footer + provider check-all + more Settings space) was agreed and **not built**.
- #26 mock apply on 5202 reached “Chat engine is now 0.9.4.” Native Update now on 0.9.3 is **unverified**. Do not close #26.
- D1–D7 are on local `main` only. The installed app does not contain them.
- Atticus replies while he reads. An interrupt is extra work, not a drop of the current job.

## Next action

Finish the Edit-list UX on the dirty picker and Settings files. Keep Free only live. Do not start OmniRoute or trending.

**Done when:** picker has Edit list / Done with per-model and per-provider checks; Settings takes more space in edit mode; focused tests pass; no new `en.json` keys.

Commit, push, and rebuild stay separate verbs. Do not rebuild unless he will launch. `import_jsonl` waits for `1`. Do not merge #66.
