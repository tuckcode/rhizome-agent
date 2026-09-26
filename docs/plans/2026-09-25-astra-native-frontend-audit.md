# Astra handoff: native frontend audit

**Owner:** Astra. **Requested by:** Atticus, 2026-09-25. **Scope:** Audit the running Rhizome Agent app before public GitHub visibility.

## Job

Use native computer use to operate the app as a first-time user. Find reproducible UI and UX defects. Start with Atticus's report: **the collapsible sidebar chops off chat text**. Produce a ranked audit with evidence and practical fixes. This job is an audit. Record proposed code changes separately from observed defects.

## Start

1. Read the repository `AGENTS.md`, `docs/CROSS-MODEL-HANDOFF.md`, and the current `docs/HANDOFF.md`. Check `git status --short` and `git log --oneline origin/main..HEAD` before reading older plans.
2. Attach to the app that Atticus already has running. Use this harness's native computer-use tools and inspect the current UI before clicking. Record the app path, version or revision if available, window size, display scale, and macOS version. Do not treat a browser build as evidence for native window chrome.
3. Check whether the running executable includes current source changes. The working tree already contains edits to `src/components/CommandRail.tsx` and `CommandRail.test.tsx`. Preserve them. A running installed app may show an older build.

## First reproduction: sidebar and chat text

1. In a chat with enough visible text, capture the initial state. Use synthetic text if a new chat is necessary. Avoid exposing private chat content in screenshots or reports.
2. Collapse and expand the left sessions sidebar with the mouse. Repeat at a narrow window width, with a long chat title, and while the chat is scrolled. Check the sidebar hover or overlay state if present.
3. Record exactly which text is cut: the chat transcript, composer, session row, or another label. Note whether content is clipped, covered, shifted, or inaccessible. Check selection and copy of affected text.
4. Capture a screenshot of each failing state. Record the window dimensions, reproduction steps, expected result, actual result, and whether reopening the sidebar restores the text.

Treat Atticus's report as a finding to verify, not as a diagnosis. Inspect the source and the current dirty diff only after observing the behavior.

## Audit pass

Operate the primary mouse path before keyboard shortcuts. Cover Chat launch and first reply, New chat, session selection, sidebar collapse and resize, Settings, model selection, error and loading states, Notes opening and closing, chat scrolling, text selection and copy, and the four pane presets. Test a small supported window and ordinary full-size window. Check long titles, long replies, and empty states. Note ambiguous controls, hidden actions, focus loss, overlap, clipping, weak contrast, and misleading status text.

Use the current native app for all layout claims. Use browser automation or tests to isolate a defect after native reproduction. Read `docs/plans/2026-09-20-public-readiness-plan.md` section 5 for existing acceptance cases. Avoid duplicating its full publication and security review.

## Evidence and finish

For each finding, provide: severity, user impact, exact reproduction steps, observed and expected behavior, screenshot or short recording, build identity, window dimensions, and likely owning files when known. Mark unverified concerns as hypotheses. Separate source-only findings from behavior observed in the app.

Rank blockers for a public first-use experience first. Finish with a short list of passes, failures, blocked checks, and the three most valuable fixes. State whether the sidebar report reproduced and whether the running app matched the current source. Save the report under `docs/plans/` and link it from the final response.

Do not publish the repository, change visibility, send messages, or modify the user's real notes or sessions for test setup. Use synthetic data. Preserve the running app and existing unsaved work.
