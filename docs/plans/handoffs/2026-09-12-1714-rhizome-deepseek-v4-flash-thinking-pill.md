---
session: 2026-09-12T22:14Z
model: DeepSeek V4 Flash (Rhizome Chat)
description: >-
  The composer thinking pill now offers only the levels the attached model can
  run, and says so when the list is short. deepseek-v4-flash has no medium, so
  picking Medium silently landed back on High.
commits: f58611f
---

# Thinking pill offers only the levels the model can run — 2026-09-12

**Origin:** Rhizome Chat · Atticus: "It doesn't change whenever I try to change
from high to medium from the pill."

## What was actually wrong

Not the pill's plumbing. **Prime clamps every thinking-level pick to the
model's own set** (`clampThinkingLevel` in `@earendil-works/pi-ai`), and the
session's model was `deepseek/deepseek-v4-flash`:

```js
thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high",
                    xhigh: "max", max: null }
```

`null` means the model does not have that level, so that model runs **Off /
High / X-High** only. The clamp scans *upward* first, so `medium` → `high`,
`low` → `high`, `minimal` → `high`, `max` → `xhigh`. A pick that does not
change the level writes no session entry and fires no event — which is why
nothing at all happened.

Evidence, in the order it was gathered:

1. Read `clampThinkingLevel` and `getSupportedThinkingLevels` in the installed
   bundle, plus `AgentSession.setThinkingLevel`, which clamps before applying.
2. Ran a throwaway print-mode session with `--thinking medium` on that model.
   Prime recorded `thinkingLevel: high`.
3. Read the session log: **one** `thinking_level_change` entry, `high`, at
   session start. `settings.json` says `defaultThinkingLevel: medium`; the
   clamp turned it into `high` when the session opened.
4. Probed the live daemon over RPC: `get_state`'s model and
   `get_available_models` (525 models) both carry `thinkingLevelMap`.

So the defect was Rhizome's: the pill drew its menu from
`get_prime_thinking_levels`, which returns the static host scale, and never
asked what the model could run. Four of seven options were clicks that could
not apply.

## The fix

- `prime_session_host::supported_thinking_levels(reasoning, map)` — Prime's
  own rule, copied deliberately and commented: an explicit `null` excludes a
  level, and `xhigh`/`max` count only when the map names them. `None` means
  Prime did not say, which is *not* "no levels".
- `PrimeHost` caches the set from `get_state`'s model in `apply_state_data`,
  beside the model fields and inside the same non-null guard — a payload with
  a null model must not widen a correct menu back to the full scale.
- `supported_thinking_levels_for_session()` falls back to the full scale when
  no model is known. A menu narrower than the truth hides a level the user
  has, which is worse than showing one the model refuses.
- New host command `get_prime_supported_thinking_levels`, registered in
  `lib.rs` and answered by the browser mock with the full scale.
- `offeredThinkingLevels(all, supported)` in `primeThinkingLevels.ts` — pure,
  keeps the host's order, falls back to `all` on an empty or unusable answer.
- The pill and the model picker both read the subset through `callHostOr`, so
  a failed read widens the menu instead of emptying it. When the menu is
  shorter than the scale it shows **"Limited by this model"**, because a
  missing level with no explanation is the same dead end in a quieter form.

Docs corrected in the same pass, since all three had become false:
`ARCHITECTURE.md`, `GETTING-STARTED.md` (component table + the rule), and
`YOU-SHOULD-KNOW.md`'s "menu of every host level" line.

## Gates run (all green, 2026-09-12)

- `pnpm test` — 6100 passed, 585 files
- `pnpm test:mcp` — 69 passed
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — 1789 passed, 24 ignored
- `cargo clippy -- -D warnings`, `cargo fmt -- --check`, `pnpm lint`, `pnpm typecheck`
- `pnpm handoff:check`

`pnpm build` was run after the first full suite and passed; the numbers above
come from the earlier, pre-comment-only run. Playwright smoke and coverage
shards did not run.

Landed as **`f58611f`** ("fix: offer only thinking levels the model can run"),
committed from another session's daily-drive batch and merged to `main` in
`c9d7776`. The committed message and its `Co-Authored-By` lines are that
session's, not this one's.

## Open

- ~~`pnpm prime:surface` fails against 0.9.3~~ **closed by `316e119`** in the
  same batch, which refreshed `docs/prime-adapter-surface.json` for installed
  0.9.3 and noted the new daemon names without wiring them. `pnpm prime:surface`
  now reports "unchanged" on both sides.
- The same class of defect is worth a second look elsewhere: any control whose
  list comes from the host's *scale* rather than the model's *capabilities*.
