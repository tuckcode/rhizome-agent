---
session: 2026-09-04T23:16:08Z
model: GPT-6
description: >-
  Reviewed the six uncommitted note-preview files and verified Back, Close,
  label, and pointer-collapse/reopen in a rebuilt native app. Approval pending.
---

# Note preview review

- Startup found six modified files and no commits ahead of origin/main; HEAD is 45562a5.
- Source and tests were left unchanged. Independent standards/spec reviews found removed hover round-trip test coverage and an obsolete always-true noteHoverArmed flag.
- Re-ran ChatHome and ChatNotePane tests: 16 passed. git diff --check passed.
- pnpm tauri build --debug --bundles app passed, including tsc -b and frontend build.
- Codex native computer controls verified the rebuilt debug bundle: NOTE PREVIEW label; Back restores the existing Notes navigation and list; X removes preview, context chip, and hover edge; leaving the preview collapses it and returning to the edge reopens it. Pointer movement was exercised through native coordinate clicks because the exposed API has no hover method.
- The initial running bundle was old (NOTE / Hide note). After rebuild, direct attachment failed; opening the exact bundle through Finder restored a controllable window. Saved transcript loaded without sending any prompt or using Grok OAuth. Orca was not used.
- Full pre-push/security gates have not been rerun. No commit or push: user explicitly requires approval first.

## Next

Await approval before commit/push and full pre-push/security gates.

## Follow-up corrections from Atticus

- The requested label was the collapsed edge, not the open preview header. Final chosen copy: Inbox. Header remains NOTE PREVIEW. Restored component/browser hover round-trip assertions and removed always-true noteHoverArmed state.
- Screenshot also reported Wiki Graph Open note doing nothing and Key both overlapping filters and occupying too much space.
- App integration regression reproduced Graph remaining visible after Open note. Fixed Graph's App callback to resolve via vaultBridge.openNoteByPath and leave Graph via handleRailSelectChat. Test now confirms graph removal, exact active note path, and visible editor.
- Key defaults closed, expands to at most 40% of graph height with scrolling. Filters use the remaining upper area with scrolling. A 30-type browser fixture proves separation at 1500x900 and 900x600. Headless Chromium required software WebGL rendering; initial failures were graphics-context creation, not layout.
- Verification: 97 tests across App/ChatHome/ChatNotePane/GraphView/GraphControls/GraphLegend; focused preview browser flow; graph layout browser flow; typecheck; lint; detector (zero findings); native debug bundle build all passed.
- Final native launch through Finder was attempted, but Codex native attachment timed out twice. Do not report these final graph/Inbox changes as native visually verified. Earlier Back/Close checks above were verified before this correction. No OAuth, Orca, commit, or push.

## White-window recovery (C60)

Atticus reported a white window after the final build. Native screenshot reproduced it while the accessibility tree exposed the complete functioning UI. Selecting Graph drew canvas nodes but no surrounding controls. Native zoom, reload shortcut, and view changes did not recover painting. Only one Rhizome process was running, at the exact debug-bundle path. Fully quit through native controls, verified no Rhizome process remained, and opened the bundle through Finder. Screenshot then showed sidebar, chat, composer, and status bar correctly. This restores usability; root cause remains unproven. No source change was made for the white-window symptom.


## Native journey audit — closed 2026-09-05

Scope: launch/reopen, one real chat round trip and saved history, disposable note create/save/close/reopen, preview and graph navigation. This is a bounded user-journey audit, not release certification or a full security/performance audit. No further feature building is part of this audit.

### Verified passes

- Native preview: NOTE PREVIEW header, collapsed Inbox edge, pointer leave/re-enter, X removes edge and context; Back restores Notes workspace.
- Native graph: Key starts collapsed; expanded Key scrolls below filters; Open note leaves graph and visibly opens the requested editor. Browser fixture additionally verified nonoverlap at 1500×900 and 900×600.
- Native chat: sent only “This is a UI audit. Reply exactly QA_OK. Do not use tools or read files.” in demo-vault-v2 through the existing NVIDIA Nemotron/OpenRouter selection; received QA_OK. No Grok OAuth. The saved prompt and response reopened after navigation and after quit/relaunch.
- Native notes: created a disposable demo note; saved a controlled Markdown title and AUDIT_SAVE_20260904 body; verified exact body on disk and in the reopened native editor. No user note was edited.
- Native restart: clean quit/relaunch restored visible rendering; a later quit/relaunch also painted correctly and restored the saved audit reply when selected. These few observations cannot establish intermittent-failure frequency.

### Findings, ordered by user impact

1. C61: confirmed unsent draft loss on Chat → Graph → Chat, twice. The second run first captured exact input AUDIT_DRAFT_KEEP_ME, then an empty composer on return. Current conversation also disappeared visually; selecting the saved session restored sent history. An App regression test failed with expected draft / received empty before the keep-mounted change, then passed. Later panel build browser draft check passed. Current Claude-edited source still needs separate review; do not claim native verification of its final fix.
2. C60: white native window reproduced once despite live accessibility controls; graph canvas alone could paint. Full quit/relaunch recovered it; root cause and durable fix remain unproven.
3. C62: after automatic new-note rename, Inbox showed both old untitled row and renamed row although only renamed file existed on disk. After relaunch the count returned to one. Saved content survived; stale list state is the observed defect.
4. C63: filtering the real graph to one note produced a roughly 500px-wide dot, filling most of the canvas. Selection and Open note still worked. Camera framing needs a bounded single-node case.
5. C64: startup briefly reported Prime not installed while the header said Prime session live. It self-corrected and a real send succeeded. This is misleading loading-state copy, not evidence of a missing installation.

### Boundaries and handoff

Audit checks above are complete with explicit failures; they do not mean all defects are fixed. Existing panel review is a separate follow-up. User reports Claude addressed the reviewer's five new-panel findings. Preserve those edits. Final native attach on September 5 timed out; it provides no evidence of a new blank window. No commit/push authorized or performed. Full pre-push/security suite not run. Test artifacts no longer appear in git status; the saved QA chat remains as evidence.


### Follow-up spot check of Claude panel edits

After closing the audit, read current ConnectionsPanel, SessionActivityHistory, App/AiPanel integration and useVaultBridge. Shared note-open handling, host-backed path availability checks, visited-tab preservation and selected touched-file indication are present. Ran App + ConnectionsPanel + SessionActivityHistory tests: 52 passed. This is a source/test spot check, not final native signoff or a claim that all five prior reviewer items are closed. Native attach timed out; no source edits were made during this follow-up. Handoff shape and diff whitespace checks pass.
