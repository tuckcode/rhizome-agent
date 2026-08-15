# Session status — 2026-08-15 (Claude Opus 5: review of the Hermes/Grok stretch)

Picks up from `docs/plans/2026-08-15-native-loop-handoff-for-claude.md`, which
remains accurate. This file adds the review verdict and one repair.

Atticus asked me to review Grok 4.6's work as the original author of the Frame A
and session-list slices, and to fix what did not hold up.

---

## Verdict: the work is sound. One incomplete fix, now closed.

I read the product diff rather than the summary. Every product file has a
matching test file, commits carry the `Co-Authored-By: Grok 4.6` trailer and a
full completion comment, and the two judgement calls I would have had to make
myself were both made correctly:

- **A4 skipped.** Right call, and for the right reason: the app has a bottom
  status bar and a top subhead already, so Frame A's titlebar chips would have
  been a third chrome band carrying information the first two already show. My
  own handoff said it was legitimate to conclude this — Grok did, and said so.
- **C24 logged, not deleted.** The dead exports in `primeSessionToMindwalk.ts`
  were left tracked rather than removed in a session that did not otherwise
  touch Mycelium. That is what `AGENTS.md` asks for.

Two implementation details I checked specifically because they are easy to get
wrong, and both are right:

- **`usePrimeHostStatus` spawning a host.** `ensure_prime_session_host` runs
  once in `start()`, not inside the 4s `refresh()` interval, and Rust's
  `ensure_host` is idempotent. No repeated spawning.
- **`resolveChatOpenNote` → `loadChatNoteContent`.** `resolveEntry` returns an
  absolute path; `loadChatNoteContent` guards with `isAbsoluteNotePath` before
  joining, so the vault root is not prepended twice.

`lastToolName` matches the spec I wrote for it, including returning a `pending`
action when that is the last one — which is the case that matters, since that
is what is currently running.

## What did not hold up

**The notes-shell fixture pin (`0b94652`) was incomplete, and it is why both
push attempts failed.**

`15a8448` made launch open ChatHome. That broke every Playwright spec asserting
on the notes shell. The fix pinned the session key inside
`installFixtureVaultInitScript` — which only reaches specs that call
`openFixtureVault`. **41 specs navigate with a bare `page.goto('/')` and never
touch that helper.**

The curated smoke lane runs 13 of them, so exactly one surfaced:
`wikilink-path-fix.spec.ts`, whose first describe navigates directly while only
its second uses the fixture. That one failure is what stopped pre-push at step
5/6 both times.

I ran the lane rather than trusting the summary — the handoff recorded a single
spec re-run (`create-note-backing-file.spec.ts`) as the proof, and one spec is
not the lane.

**Fixed in `de1a437`:** `pinNotesShellLaunch(page)` is now an exported helper,
applied to the 22 specs that both navigate bare and assert on notes-shell
selectors. The other 19 bare-goto specs do not touch those surfaces.

`pnpm playwright:smoke` — **26 passed**. That lane gates the push and is green
for the first time since `15a8448`.

## What is still red, and is not ours

C25 in `docs/HANDOFF.md`. Two regression-lane specs
(`visible-type-property.spec.ts:11`, `type-create-note.spec.ts:32`) fail on
stale content expectations. Verified by stashing the pin and re-running: **3
failures before, 2 after** — the pin fixes one, the other two are a separate
problem. The shell renders; the count assertion is stale
(`labels.length` is 1, expected > 3). Neither runs in the push gate.

---

## State

Working tree clean. Still **not pushed** — origin/main remains at `606c3c3`.
Count the ahead-number yourself; do not read one out of a doc.

```bash
git status -sb && git log --oneline origin/main..HEAD
```

## Next, unchanged from the previous pickup

1. **Re-check Frame B body natively.** `0b44e5f` resolves wikilink titles
   through `resolveEntry` and was never re-dogfooded. `pnpm tauri dev` →
   ChatHome → click the pink `[[Promote loop check]]`. The pane should show the
   body of `inbox/20260814-promote-loop.md`, not "Could not open this note."
   The file already exists — do not write it again. I did not verify this: it
   needs the native shell and a real vault, and Vite cannot prove it.
2. **Push, if Atticus asks.** The blocker I found is cleared, so the gate
   should now reach the end. Full pre-push, no `--no-verify`, with:
   ```bash
   export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov"
   export LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
   ```
3. **Not unless named:** Frame D, remaining Prime RPCs, A4, the C24 delete.

## Standing traps this session confirmed

- **A green subset is not a green lane.** One spec re-run was recorded as proof
  that a lane-wide breakage was fixed; it was not.
- **A fixture fix only reaches specs that use the fixture.** When product
  behaviour changes at launch, check what bypasses the helper.
- Everything in the previous pickup's trap list still applies.
