---
session: 2026-08-28T03:00-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Tested the OpenAI-compatible provider path against Nous Portal — it is
  compatible today, only an API key is untested — and shipped #45 step 1, the
  persisted chat-model allow-list. Also corrects a coverage-gate false alarm
  caused by `cargo llvm-cov --no-clean` after a toolchain change.
commits: daf3127..74c77dc
---

# Chat model allow-list — stop here 2026-08-28

Continues
[2026-08-28-0010-claude-opus-5-model-settings-triage.md](2026-08-28-0010-claude-opus-5-model-settings-triage.md).

## Nous Portal: compatible today, one input short of proven

The previous handoff was right to correct "blocked upstream", and the flow it
pointed at holds up. Verified without a key:

| check | result |
|---|---|
| `GET https://inference-api.nousresearch.com/v1/models` | **200**, 335 models, OpenRouter-shaped |
| `POST /v1/chat/completions`, no auth | 402 (x402 crypto-payment offer) |
| same POST, invalid bearer | **401** with a readable message naming the fix |

The POST body was byte-for-byte what Rhizome's **Test** button sends —
`ai_models.rs:213` builds `{base_url}/chat/completions`, `apply_auth_headers`
sends `bearer_auth`, `openai_chat_payload` sends `{model, messages,
stream:false}`. Nous accepts that shape, and its 401 is exactly the provider
error `ea21050` now surfaces verbatim.

**Untested: a valid key returning 200 through the app.** Reading the key from
the macOS keychain is blocked by policy and should be. Settings to enter:
kind **Custom provider**, base URL `https://inference-api.nousresearch.com/v1`,
model e.g. `tencent/hy3:free`, key storage **Env** → `NOUS_API_KEY`.

### Three findings that change #45's shape

1. **One model per provider row.** `AiProviderSettings.tsx:87` hardcodes
   `models: [{ id: draft.modelId }]`. Six free Nous models is six provider
   entries, each with its own key save. *That* is the api-provider gap — not
   "custom endpoints are unsupported".
2. **"There is no price field" is true of Prime only.** Nous's `/v1/models`
   returns `pricing.prompt`, and 5 of its 335 are genuinely $0. So a free-only
   filter is a naming heuristic **for Prime targets**; for `api_model` targets
   it can read the real number. The previous handoff's claim needs that
   qualifier.
3. **No "fetch models" button, and no Nous preset.** `/v1/models` is public and
   unauthenticated — the app could populate a picker instead of making you type
   ids. `aiModelProviderCatalog.json` has 7 kinds, none of them Nous.

## #45 step 1 shipped — `daf3127..74c77dc`

`settings.prime_model_allow_list` (`"provider/id"` keys) →
`partitionModelsByAllowList` → the picker → `PrimeModelAllowListSection` in
Settings → AI agents. Documented in `ARCHITECTURE.md` → *Prime Agent* → *The
chat model menu*.

**The design rule worth keeping:** two states are refused outright, both being
the same failure — an empty menu with no way out of itself. An empty list means
*never curated* (normalized to `None` in Rust, mirrored in the frontend), and a
list matching no live model shows everything, because Prime's catalog moves
underneath a saved list. `activeModelKey` keeps the running model listed.

**Pass order is load-bearing, and cost one bug.** Curation is applied to the
whole catalog *before* the search box; applying it after read every narrow
query as a stale list and silently dropped the curation. Then search, then
credentials. Each pass separates rather than hides.

**One defect only the running app found** (`fea9c1f`): the allow-list was
fetched in the same effect as the model catalog, which is deliberately cached.
Curate in Settings, reopen the chip, and it still showed the old shortlist. The
catalog is a daemon round-trip and stays cached; the allow-list is a local read
edited on another surface, so it re-reads on every open. Tests pin both halves.
Nothing in the unit suite would have caught this — it needed `pnpm dev`.

## ⚠️ `cargo llvm-cov --no-clean` gave a false coverage failure

`--no-clean` (the command in `AGENTS.md`'s check suite) reported **83.87%
lines, exit 1**. A clean run of the same tree reports **84.88%, exit 0**. The
stale run's output listed profile data from **two rustc versions** (1.97.1 and
1.98.0) — `--no-clean` had merged artifacts from before a toolchain bump.

Confirmed by running a worktree at `087880d`, the commit before this session:
**84.88%, exit 0** — identical to HEAD. This session moved Rust coverage by
0.00%, and the pre-push hook's own Rust lane passed.

**If the Rust coverage gate fails, re-run it without `--no-clean` before
believing it.** Tracked as C54.

## Pick up here

- Give the key and close the Nous live check. One command:
  `echo 'export NOUS_API_KEY=...' >> ~/.zshrc && source ~/.zshrc`
- **#45 step 2** — the free-only quick-filter, now with finding 2 above: real
  prices for `api_model` targets, naming heuristic for Prime ones. Label it as
  a heuristic where it is one.
- **#45 step 3** — default-model picker in settings.
- **Multi-model provider rows** (finding 1). Small, and it is the thing that
  actually blocks "use Nous in Rhizome" as a daily driver.
- Still undecided from the last session: the duplicate Mycelium entry point
  (recommendation was option 3, fold scope into the view).
- **#46 and #47 are done in code but still open on GitHub.**
