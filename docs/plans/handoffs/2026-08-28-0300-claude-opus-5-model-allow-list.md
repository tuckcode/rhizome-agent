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

## Nous Portal works — confirmed live

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

**Then confirmed with a real key** (`NOUS_API_KEY`, Env storage):
`nousresearch/hermes-4-405b` returned **HTTP 200** and the content `OK`.

So **#45's custom-provider work is not needed to use Nous for chat.** Settings
to enter: kind **Custom provider**, base URL
`https://inference-api.nousresearch.com/v1`, model
`nousresearch/hermes-4-405b`, key storage **Env** → `NOUS_API_KEY`.

Rhizome's own env probe was replayed verbatim and finds the variable.
`zsh -lc` does *not* read `.zshrc`, which is why a naive presence check says
"not set"; `rc_source_command` (`shell_env.rs:160`) sources it explicitly
before probing. That path is correct — no defect there.

The remaining gap is `api_model` targets bypassing Prime (`ChatHome.tsx:66`),
which is by design and unchanged.

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
3. **`pricing.prompt == 0` does not mean callable.** `tencent/hy3:free`
   returns **400 — "missing tags"** with a valid key, while the paid
   `hermes-4-405b` returns 200. The free ids carry a `synthesizedFreeVariant`
   marker the paid entries lack, so they are synthesized routes needing
   something extra. A free-only filter that trusts the price field would offer
   models that 400. Third strike against a naive one.
4. **No "fetch models" button, and no Nous preset.** `/v1/models` is public and
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

## ⚠️ The documented Rust coverage command fails on a healthy tree

`AGENTS.md`'s check suite said

```
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

while `.husky/pre-push` runs it with
`--ignore-filename-regex "lib\.rs|main\.rs|menu\.rs"`. Excluding those three
files of largely untestable wiring is worth about **0.8pp**:

| command | lines | exit |
|---|---|---|
| as documented, `--no-clean` | 83.87% | 1 |
| as documented, clean | 84.88% | 1 |
| **as the hook runs it** | **85.68%** | **0** |

The documented command fails on a tree the gate passes. `AGENTS.md` is fixed;
C54 carries the detail.

**I got this wrong first, and the way I got it wrong is the lesson.** I read
an exit code out of a shell pipeline — `cargo llvm-cov … | tail -3` reports
`tail`'s status, which is always 0 — and concluded from a "passing" baseline
that `--no-clean` was inflating a false failure. `--no-clean` does skew the
number after a toolchain bump (that run's table listed profile data from two
rustc versions), but it was never the cause. Redirect to a file and read `$?`.

## Image attachments shipped (`ee73666`..`c9081df`)

Pasting or dropping a screenshot into the composer attaches it and sends it to
Prime. Four commits: the conversion lib, the Rust send path, the composer, and
the model gating. Non-image files are still refused, unchanged.

Two gates had to learn that **an attachment is a message**: `shouldIgnorePrompt`
and the composer's send button both tested text alone. "What is this?" with a
pasted screenshot and no words is the ordinary case.

`toPrimeImages` / `prompt_images_field` return **nothing**, not an empty array,
when there is no attachment — a text-only turn stays byte-identical to what
Rhizome sent before this existed, and tests pin it on both sides.

`modelAcceptsImages` is tri-state and the third state is the point: `null`
means Prime did not report modalities, and silence is not a refusal. Only a
model Prime explicitly calls text-only produces a warning. Same rule as
`partitionModelsByConnection` and `check_provider_connected`.

Caps are 5 MB and 4 images, enforced in the composer **and** in Rust — the
daemon speaks newline-delimited JSON over a socket, so an oversized paste is
one enormous line the session waits behind.

**Live-checked end to end, 2026-08-28 05:30.** Rebuilt, relaunched, and pasted
a generated 240x120 PNG — an orange rectangle on navy `#121830` — into a live
Prime session on `muse-spark-1.2-contributor-free` (`images: yes`). Asked for
the colours and the shape. The model answered:

> I see an orange square on a dark navy blue background.

Nothing in the prompt named either colour, so that answer is only reachable
from the image. Confirmed along with it: the chip appears on paste
(`image.png ×`), the send button activates with **no text typed**, the chip
clears on send, and the context meter moved 0 → 19.0k.

The text-only warning path was not exercised — the model in the session
accepts images. Still unverified in the app: a model Prime reports as
text-only, and drag-and-drop (only paste was driven).

## Pick up here

- **Nous live check is closed** — 200 + `OK`. Not yet done through the app's
  own Settings → API providers UI; the request shape is identical, so this is
  a UI confirmation, not a risk.
- **Rotate the key used for that test.** It was pasted into a chat transcript.
- **#45 step 2** — the free-only quick-filter, now with finding 2 above: real
  prices for `api_model` targets, naming heuristic for Prime ones. Label it as
  a heuristic where it is one.
- **#45 step 3** — default-model picker in settings.
- **Multi-model provider rows** (finding 1). Small, and it is the thing that
  actually blocks "use Nous in Rhizome" as a daily driver.
- Still undecided from the last session: the duplicate Mycelium entry point
  (recommendation was option 3, fold scope into the view).
- **#46 and #47 are done in code but still open on GitHub.**
