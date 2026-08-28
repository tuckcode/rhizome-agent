---
session: 2026-08-28T00:10-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Post-push triage. Closed #24, specced model settings on #45, corrected a
  wrong "blocked upstream" claim (Rhizome already supports OpenAI-compatible
  endpoints), filed #48 for OmniRoute, and found a real Mycelium UX defect
  that is still undecided.
commits: none — issues and design only
---

# Model settings triage — stop here 2026-08-28

No code changed in this stretch. Everything from the previous session is on
`origin/main` at `9619851`; the tree is clean. This is design, triage, and one
correction that matters.

Continues
[2026-08-27-2223-claude-opus-5-failure-legibility.md](2026-08-27-2223-claude-opus-5-failure-legibility.md).

## The correction — read this before touching #45

I told the user that connecting Nous Portal was **blocked upstream**. That is
**wrong**, and it was wrong because I only checked Prime's side.

**Rhizome already supports custom OpenAI-compatible endpoints.**
`AiModelProvider` (`src-tauri/src/ai_models.rs`) carries `base_url`,
`api_key_storage`, `api_key_env_var`, `headers` and a `models` list, and
`AiModelProviderKind` includes **`OpenAiCompatible`**. Requests go to
`{base_url}/chat/completions`. The surface is Settings → API providers
(`AiProviderSettings`, `mode="api"`).

The real constraint is narrower: `api_model` targets **bypass Prime entirely**
(`ChatHome.tsx:66`, `isPrimeTarget = kind !== 'api_model' && agent === 'prime'`).

| want | status |
|---|---|
| custom OpenAI-compatible endpoint for **chat** | **works today** |
| same endpoint **inside a Prime session** | blocked — Prime has no custom-provider mechanism |

**Nobody has tested the existing flow against Nous Portal.** Do that before
building anything; the gap may be smaller than the issue implies.

## #24 closed

Promote was live-checked 2026-08-26; every mechanical part of its AC held
(path shape, frontmatter, title derivation, wikilink preservation, same-path
refuse). The one defect it found was C51, fixed in `2360cb5` and widened in
`9e50a8d`. Close comment carries the evidence and one honest caveat: the C51
*fix* was never re-run natively, because that attempt was blocked by C53.

## #45 — target design captured

From the user, in their words: a conventional provider page — OAuth-connectable
providers listed separately from API-key ones, with a **direct link to each
provider's key page** — then pick a **default model**, then **curate which
models appear** in the chat dropdown. Motivating case: show only OpenRouter's
free models, not the paid ones.

Two constraints found while grounding it:

1. **Connecting cannot be a button yet.** No auth/login command exists in any
   of Prime's 102, and `settings.json` has no custom-provider mechanism. Needs
   an ADR; the credential store stays Prime's under ADR-0168.
2. **"Free only" cannot read a price field — there isn't one.**
   `prime-agent model list` exposes provider, model, context, max-out,
   thinking, images. Free is inferable only from the id, and the convention
   differs per provider: `-free` on OpenCode (`hy3-free`), `:free` on
   OpenRouter (`google/gemma-4-31b-it:free`). 26 models carry a marker. So a
   **manual allow-list is the reliable mechanism**; a "free only" quick-filter
   is a naming heuristic and must be labelled as one.

Suggested order, 1–3 unblocked: curated allow-list → free-only quick-filter →
default-model picker in settings → connect-from-Rhizome (after the ADR).

## #48 — OmniRoute, filed

MIT self-hosted gateway, one **OpenAI-compatible** endpoint in front of ~290
providers / ~500 models, ~90 free. `npm i -g omniroute`, default port 20128.
github.com/diegosouzapw/OmniRoute

Small feature, because both halves already exist here: the endpoint shape is
`OpenAiCompatible`, and the "you have to run `omniroute` first" problem is the
one `mycelium.rs` already solved for Mindwalk (spawn on demand, parse the
banner URL, supervise the child, Retry instead of a blank pane).
`start_mindwalk_sidecar` is the template.

**Not installed on this machine** — nothing in #48 is verified against a
running instance. Confirm port and endpoint path first.

## Undecided: the duplicate Mycelium entry point

The user flagged the icon in the chat subhead as a redundant old link. It is
**not** a leftover — it is `prime-session-footprint`, labelled "This run",
opening Mycelium scoped to the current session, versus the rail which opens
all sessions. Two deliberate entry points from #22.

**But the reaction is the finding.** Both use the *same glyph*,
`CirclesThree` (`CommandRail.tsx:187` and `PrimeSessionSubhead.tsx:189`), so
they are visually identical with different scope. The app's own author read it
as a duplicate.

Three options were put to the user and none chosen yet:

1. Remove it — simplest, loses per-session scoping entirely.
2. Differentiate it — different icon or visible label; still two places.
3. **Fold scope into Mycelium itself** — rail as the only entry, with a
   *This run / All sessions* toggle inside the view. Removes the duplicate
   without amputating the feature; `MyceliumView` already branches on
   `focusSessionPath`. The work is getting the current session id to the rail,
   which the subhead has and the rail does not.

Recommended 3. **Do not just delete the icon** — that is removing a working
feature on a misread.

## Pick up here

- Test the existing OpenAI-compatible flow against Nous Portal. Cheapest way
  to find out whether #45's custom-provider work is even needed.
- #45 step 1: curated allow-list, persisted, edited from settings.
- Decide the Mycelium entry-point question above.
- Not live-verified yet: the preflight banner (`b21211b`) and provider status
  section (`bb00152`). `prime-inference` is the easy repro for both — 105
  models, never signed into.
- **#46 and #47 are done in code but still open on GitHub.** Same
  close-on-live-check drift the briefing warns about.
