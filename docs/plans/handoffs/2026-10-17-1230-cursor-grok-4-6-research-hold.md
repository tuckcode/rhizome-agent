---
session: 2026-10-17T12:30Z
model: Cursor Grok 4.6
description: >-
  HOLD on #208: Earth muted empty-state and placeholders, library scan
  request-id race, Retry focus and re-announce, jobs through callHost,
  disabled Generate hint, banner copy and Details chevron.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Ricky/Critiquito HOLD on #208

No Rust. The `rhizome_commands.rs` serde_json fix stays with the other
teammate.

1. Empty-state line uses `text-muted-foreground` (`--text-secondary`
   #4E473C / rgb(78,71,60) in Earth light), same token as the rocket icon.
2. Library scans carry a request id and vault key. Stale results drop.
   Retry is disabled while a scan is in flight (`scanningRef` plus the
   button). The banner clears when a scan starts.
3. Successful Retry focuses the Research heading. A failed Retry remounts
   the alert (`key={attempt}`) and adds an "Attempt N." line.
4. `useRhizomeJobs` starts and cancels through `callHost`. Mock handlers
   for those commands were already present.
5. Disabled Generate uses muted chrome, not faded primary, plus
   "Add a repo URL or folder first".
6. Generate URL and project placeholders use `placeholder:text-muted-foreground`.
7. Banner title and line both say "library". The line tells the user to
   check the folder and retry. Warning icon and amber edge from the
   feedback-warning tokens.
8. Details has a rotating chevron, `aria-controls` on the `<pre>` id, and
   a toggle test.
9. Details text goes through `redactCredentialTokens`.
10. `MOCK_LIBRARY` comment sits on that constant; wiki-graph comment sits
    on `MOCK_WIKI_GRAPH`.
11. Bridge test asserts the mock scan payload and that "mock repo" renders.
12. Button label is "Generate into {vault}", no arrow glyph.
13. Architecture map is a mode choice with the same chrome as the depth
    menu. It still opens the format modal so custom formats stay reachable.
14. Vault picker uses a transparent trigger in both themes, so Graphite
    no longer fills `dark:bg-input/30`.

Review shots in `docs/review-shots/audit-research/` (Graphite + Earth):

- the same ten states as the first slice
- `*-disabled-generate.png`
- error-details shows the open chevron

Localization: none — English only (C18).
PostHog: no event needed because this is scan recovery, contrast, and
copy. The Research generate path already emits its existing events.
