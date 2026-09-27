# Astra native frontend audit report

**Date:** 2026-09-25  
**Auditor:** Astra native observations, initial report assembled by Luna. Corrections checked against this chat on 2026-09-26.  
**Scope:** Partial native UI audit of the running Rhizome Agent app. This is not a completed first-use acceptance review.  
**Build observed:** `/Applications/Rhizome Agent.app`, version `0.1.0`, executable modified 2026-09-23.  
**Source state:** `HEAD` was `f4bc854`. The executable modification date precedes the current `CommandRail.tsx` edits. This suggests a different source state, but the installed commit and bundled contents were not verified.  
**Environment:** macOS 27.2, Apple M5 Pro. The external display reported 3840×2160 physical pixels and a 1920×1080 logical desktop. Full-window captures were 3840×2100 image pixels. Quarter-screen captures were approximately 1922×1052 image pixels, consistent with approximately 961×526 logical points. CSS viewport dimensions were not measured.

## Executive result

The reported sidebar defect reproduced through the expand control. The expanded sessions rail covers the left side of the transcript and composer. The overlap also hides an unsent draft. Pinning or collapsing the rail restores readable content. Hover-only reproduction was not independently established.

The audit also found an authentication-error auto-save problem. With “Auto-save chat knowledge to the vault” enabled, the test turn produced a new concept note titled `Not logged in · Please run /login`. The setting text says authentication and tooling failures are skipped. This behavior needs source tracing and a fresh build verification.

## Ranked findings

### P1 — Expanded sessions rail covers Chat content

**Observed:** Reproduced at full size and at a quarter-screen window.

**Steps:**

1. Open Chat with a long reply.
2. Click the rail's expand control.
3. Leave the rail expanded over the Chat transcript.

**Actual:** The expanded rail overlays the left edge of transcript text. The composer remains under the rail. Focusing the composer does not close the overlay. A draft remains present but is visually covered while the rail is expanded.

**Expected:** Chat content remains readable and interactive. An overlay rail should either reserve space, close before covering Chat, or provide a clear modal boundary with no hidden controls.

**Evidence:** [02-chat-overlay.png](evidence/2026-09-25-native-audit/02-chat-overlay.png), [03-overlay-hides-draft.png](evidence/2026-09-25-native-audit/03-overlay-hides-draft.png), [07-small-overlay.png](evidence/2026-09-25-native-audit/07-small-overlay.png).

**Likely owners:** `src/components/CommandRail.tsx`, the Chat shell layout in `src/App.tsx`, and the Chat content container.

**Source boundary:** The current uncommitted `CommandRail.tsx` edits add `overflow-hidden` inside the rail and raise the footer stacking order. They were preserved. Neither their presence in the installed app nor their effect on this defect was verified. Source also uses a negative margin and elevated stacking order for overlay mode. That supports the overlap mechanism but does not establish hover behavior.

### P1 — Authentication failure is written into the vault by auto-save

**Observed:** One new concept note appeared after the synthetic Chat turn, timestamped 19:31. Its title and body were `Not logged in · Please run /login`. Eight matching files existed when inspected. The audit did not establish that this run created all eight. The earlier chat claim that it did was incorrect.

**Steps:**

1. Open Chat with automatic chat saving enabled.
2. Send the synthetic request for 20 numbered lines, with no tool use or note saving requested.
3. Wait for the turn to finish.
4. Inspect Inbox or Concepts.

**Actual:** Chat successfully returned the requested synthetic text. A separate authentication-error note appeared afterward. Automatic saving was enabled. The timing supports automatic saving as the likely route, but no event or process trace established the complete cause.

**Expected:** Authentication, OAuth, and tooling errors must not become durable knowledge. The Settings description explicitly says those failures are skipped.

**Evidence:** [09-auth-error-note-read.png](evidence/2026-09-25-native-audit/09-auth-error-note-read.png). Settings evidence: [08-settings-auto-save.png](evidence/2026-09-25-native-audit/08-settings-auto-save.png).

**Source clues:** `src/components/useAiPanelController.ts` enables the path when `session_auto_distill_enabled === true`. `src/utils/sessionAutoDistill.ts` owns the post-turn path. `src-tauri/src/rhizome_distill.rs` rejects several junk titles, but the native result shows that this path either bypasses that guard, uses a stale packaged implementation, or writes through another route.

### Unverified concern — Transcript boundary near the composer

**Observed:** At quarter-screen size, the transcript ends visually above the context-window and composer region. The screenshot shows a partial line at that boundary.

**Assessment:** This can be normal clipping at a scroll boundary. Scrolling reached `AUDIT-END`. The audit did not prove covered or inaccessible content. Remove this from the confirmed defect list unless a focused reproduction establishes a failure.

**Remaining check:** Verify that the final response line and its actions remain reachable at the minimum supported size.

**Evidence:** [06-small-scrolled-pinned.png](evidence/2026-09-25-native-audit/06-small-scrolled-pinned.png).

### P2 — Notes header truncates at narrow width

**Observed:** In the half-screen layout, the Notes heading rendered as `N...` beside its controls.

**Expected:** The heading should remain identifiable, or the controls should move into an accessible overflow menu.

**Evidence:** [05-narrow-notes-header.png](evidence/2026-09-25-native-audit/05-narrow-notes-header.png).

### P2 — Numbered reply loses its visible numbers

**Observed:** The synthetic reply displayed 20 lines without visible list numbers, including with the sidebar collapsed. Copy response returned `1.` through `20.` and `AUDIT-END`.

**Reproduction:** Request 20 numbered lines. Compare the displayed response with Copy response pasted into the unsent composer.

**Expected:** The displayed ordered list retains its numbers. Numbering carries meaning in procedures and references.

**Evidence:** [01-chat-collapsed.png](evidence/2026-09-25-native-audit/01-chat-collapsed.png) and the recorded accessibility text after the copy/paste check. No separate clipboard evidence file was saved.

**Likely owners:** `src/index.css` and `src/components/MarkdownContent.tsx`. The inspected list rules set margins and indentation but do not explicitly restore list marker styles. This is a source clue, not a verified fix.

## Checks that passed

- Collapsing the sessions rail restored the full Chat width.
- Pinning the rail changed Chat from overlay mode to a reserved column.
- The unsent composer draft survived rail expansion, pane switching, and the narrow-window check.
- Copy response preserved all 20 synthetic lines and `AUDIT-END`.
- Model picker opened and changed the session to DeepSeek V4 Flash.
- View presets Chat, Notes, Read, and Workbench responded to menu selection. Full usability checks for each preset were not completed.
- The native window restored to ordinary full size after the narrow checks.

## Checks not completed

- The running app was not rebuilt, so current source edits were not native-verified.
- The initial inspection displayed an existing chat and real Inbox entries. Saved full-window evidence then used synthetic Chat text. A cropped Notes image limits unrelated content.
- The audit did not change Settings or save the synthetic draft.
- No fix was applied during the audit.
- Cold launch, controlled failure recovery, complete session switching, hover-only behavior, minimum-size coverage, and manual selection of obscured text remain unverified.
- The installed commit remains unknown. Model selection changed visibly, but persistence across restart was not tested.

## Audit side effects and limits

The audit created a synthetic session. It changed that session's model to DeepSeek V4 Flash and entered an unsent draft. It also exercised rail width, pinning, window size, and pane controls. The window returned to full size. Complete restoration of all UI preferences was not verified before the interruption. The automatically created error note was inspected without editing or deleting it. Existing source edits were preserved.

## Highest-value fixes

1. Make explicit sidebar expansion reserve Chat space, or dismiss the overlay when Chat receives focus. Verify hover separately.
2. Trace the auto-save error path and add a native regression test that proves authentication errors never create notes.
3. Restore visible ordered-list numbers and verify them in the native app.

## Visual review — September 26

This pass reviewed all nine saved screenshots. It adds design judgments and layout proposals, not new native interaction tests. Findings describe the captured build. Its source revision remains unknown. The proposals below are not implemented or usability-tested.

### Central finding: controls outrank content as space decreases

The interface preserves diagnostic information and secondary controls while conversation text, note identity, and drafts lose space. The wide layout has the opposite problem: content stretches across a large canvas without a shared reading column. These are related hierarchy problems, not isolated padding defects.

### 1. Sidebar expansion separates Send from its message

In [03-overlay-hides-draft.png](evidence/2026-09-25-native-audit/03-overlay-hides-draft.png), the rail conceals the draft while Send remains available. [07-small-overlay.png](evidence/2026-09-25-native-audit/07-small-overlay.png) shows the same problem at smaller width. This strengthens the existing P1 finding: the user can act on content they cannot inspect.

**Proposal:** Reserve space for the rail in a wide window. In a narrow window, use a temporary drawer that closes after conversation selection. The pinned layout in [04-pinned-sidebar.png](evidence/2026-09-25-native-audit/04-pinned-sidebar.png) already demonstrates the benefit of reserved space. Verify hover behavior separately.

### 2. Pane identity loses priority to diagnostics and tools

The Chat header exposes a session identifier, vault path, connection state, and uptime without giving the conversation title comparable prominence. In [09-auth-error-note-read.png](evidence/2026-09-25-native-audit/09-auth-error-note-read.png), the note title and close control are not visible, while placement controls and several action icons remain. This observation does not establish that closing the note is impossible through other routes.

**Proposal:** Give each pane a persistent title and obvious close control. Place session details behind a status control. Move secondary note actions into an overflow menu before sacrificing the title.

### 3. The composer consumes too much vertical space

Context usage, provider, model, reasoning, agents, skills, Goal, Schedule, readiness, and keyboard hints compete around the input. In [06-small-scrolled-pinned.png](evidence/2026-09-25-native-audit/06-small-scrolled-pinned.png), this stack occupies roughly a quarter of the window height, estimated from the image. A context meter showing about 1% receives a full row. Multiple areas communicate idle or connected states.

**Proposal:** Combine routine settings into one compact row. Reveal context details on request. Give active work and failures more prominence than idle systems. Preserve the message field and Send as the primary controls.

### 4. Notes needs an explicit order for shrinking its header

[05-narrow-notes-header.png](evidence/2026-09-25-native-audit/05-narrow-notes-header.png) shows more than a truncated Notes heading. Inbox text overlaps the action area, while verbose creation metadata remains. This extends the existing P2 finding.

**Proposal:** Preserve note identity, navigation, and the primary action first. Move optional tools into overflow next. Shorten or hide secondary metadata before truncating the title. Test the resulting order at the minimum supported window size.

### 5. Wide Chat lacks a shared reading column

In [01-chat-collapsed.png](evidence/2026-09-25-native-audit/01-chat-collapsed.png), the prompt, response, and composer occupy different horizontal extents. Large empty areas do not help the user follow the conversation.

**Proposal:** Align these elements within a bounded reading area. Allow tables and code to use extra width when needed. Keep the restrained palette and existing pane concept.

### Additional Settings observation

In [08-settings-auto-save.png](evidence/2026-09-25-native-audit/08-settings-auto-save.png), AI Agents is selected, but the preceding Show Unsupported Files section still occupies substantial space above its heading. The footer and navigation further reduce the visible settings area. This captured state suggests weak section positioning. Recheck navigation and scrolling before treating it as a reproducible defect.

**Proposal:** Place the selected section heading consistently near the top. Explain auto-save in plain language, with technical details available separately. The screenshot alone cannot establish all navigation behavior.

## Three layout directions

| Direction | Arrangement | Best use |
| --- | --- | --- |
| Conversation first | Session rail, bounded conversation column, compact composer. Notes opens on demand. | Default daily chat. |
| Research desk | Conversation and selected note share the workspace. Both retain a title and close control. | Comparing, extracting, and writing. |
| Focused window | One content pane with labeled Chat and Notes tabs. Sessions opens temporarily. | Small windows where simultaneous panes become cramped. |

**Recommendation:** Make these responsive states of one workspace. Start with the conversation. Opening a note creates the research desk when space permits. At smaller widths, preserve both contexts through tabs instead of compressing both panes. Choose transition widths through content-fit testing rather than device labels.

## Product opportunity: show where knowledge came from

Make the relationship between a response and its saved knowledge visible. A successful save could place a small “Saved to…” link beside the relevant response. A failed save should remain a recoverable error there, with an appropriate retry action. It should not become a concept note. This is a proposed interaction, not an observed capability.

## Suggested implementation order

1. Fix the hidden-draft interaction and trace the authentication-error save route.
2. Restore visible ordered-list numbers.
3. Establish persistent pane titles and compact composer controls.
4. Introduce responsive pane states and Notes overflow behavior.
5. Validate wide reading alignment and the visible connection between responses and saved notes.
