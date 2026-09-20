# Lane B diagnostic recipe: Chat reliability

**Origin:** Cursor Grok 4.6 · 2026-09-20 · worktree `.worktrees/lane-b` at `4f9b4c4`
**Status:** source diagnosis and fixtures. Native live sample is not in this lane.
**Does not change:** thinking defaults, thinking Off as a forced policy, provider defaults.

## 1. What to record on every live miss

Ask Q for one synthetic turn. Record all of these before anyone changes a default:

| Field | Why it matters |
|---|---|
| Build identity | Installed app last documented as `6860762`. Source baseline here is `4f9b4c4`. |
| Model id | Do not infer Flash behavior from Sonnet, or the reverse. |
| Provider | OpenRouter refusals and local worker deaths are different. |
| Thinking level | Off / low / medium / high as the picker shows it. |
| Terminal event | `thinking_delta` present? `text_delta` present? `agent_end` fields? stream `Error`? host exit? |
| Visible outcome | Exact transcript text, including `Error:` prefix if any. |
| Draft fate | Composer empty, preserved, or duplicated. |

Do not classify from one of those fields alone.

## 2. Four endings that must stay separate

Source of truth for classification: this table. Live stream copy is
still the generic empty reply in `aiAgentStreamCallbacks`. Those tests
pin current behaviour. They do not change it. A later slice can wire
distinct sentences. Do not force thinking Off from one sample.

| Kind | Terminal cue | What Chat should show | Not this |
|---|---|---|---|
| **Provider rejection** | Empty `agent_end` with `stopReason: error` + `errorMessage`, or `usage.input == 0` | Provider sentence. Host emits `Error`. | Generic empty reply |
| **Worker startup** | Spawn/auth/not-installed/too-old, or vault `EPERM` / `uv_cwd` (C53) | Actionable install/login/folder copy. Preflight can say this before send. | A model that said nothing |
| **Transport loss** | Host process exited, socket unreachable, hide-paused, broken pipe | Transport sentence. Mid-turn Enter/`steer` returns `failed` and keeps the draft. | Permission to start a second turn |
| **Empty completion** | `agent_end` with no error and `usage.input > 0`, or Done with no `text_delta` | `Prime Agent finished without returning a reply.` Thinking-only is this kind. | A refusal, a dead worker, or a dropped socket |

Thinking deltas never count as an answer. `prime_session_host` sets `saw_text` only on `text_delta`.

## 3. How to reproduce each kind without guessing

Use the fixtures first. They are deterministic. Then, if Q has the app slot:

1. **Provider rejection.** Select an unavailable or unpaid model. Send one short turn. Expect the provider sentence, not the generic empty reply. Input must remain recoverable.
2. **Worker startup.** Missing Prime, expired auth, or a TCC-blocked vault. Expect the preflight banner *or* a spawn/auth error. Do not spend a thinking turn to learn this.
3. **Transport loss.** Stop the daemon or hide until the host is paused, then Enter or Steer. Expect `failed`, draft kept, no silent second send.
4. **Empty completion / thinking-no-answer.** Named model + named thinking level. If thinking streams and no `text_delta` arrives, classify as empty completion unless `agent_end` carries a provider error or `usage.input == 0`. Do **not** force thinking Off from that one sample.

## 4. #41 remainder (source vs native)

Source already wires:

- Enter mid-turn → `follow_up` once the daemon accepts it.
- Steer button → `steer`. Empty composer → Stop.
- `failed` and stale `not-running` keep the draft.
- Accepted follow-up appears under the composer queue.

Still unverified here: live Enter-once, live Steer, Stop, hide, Keep working, reopen, tray Done. Queue mutation (`mutate_queued_message`) stays parked.

## 5. Titles

Mycelium already unwrapped `<conversation_history>` blobs. The session list did not.
This lane unwraps at the list display (`primeSessionRowTitles`) and at naming (`session_title_from_exchange`, `summarize_lines`).
Model-generated naming is unchanged. A human rename that is not a history blob stays intact.

## 6. C76 display truncate (do not tighten)

`normalizeReasoningDisplay` drops from an leftover unterminated
`<conversation_history>` open tag through the end of the string.
Reasoning that names that tag mid-sentence loses the rest. Display-only.
Low risk. Do not tighten the matcher from this recipe.

## 7. What this lane did not run

- Native QA on the installed `6860762` app or a debug bundle.
- Full coverage, Playwright smoke, commit, push, rebuild.
- Coordinator files: `normalizeReasoningDisplay.ts`, its test, `AiMessage.test.tsx`.
