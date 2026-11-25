# Rhizome front-end run: brief for Fable 5.2

**From:** Atticus (owner), via Claude · 2026-11-14 · repo `tuckcode/rhizome-agent`, main at `8e70470` (PR #289, Nov 1)

This is a starting point, not a spec. Read it, audit the app yourself, then write your own plan. You are expected to disagree with parts of this brief where the evidence says so.

## 1. Mission

Make Rhizome feel like one designed product. Today it feels like many careful patches. Rhizome is "a coding harness that doesn't forget": a desktop app (Tauri + React) that runs its own agent loop on any model, with memory kept as plain Markdown in a vault the user owns. Aim for these qualities:

- **Calm and legible.** At a glance you can see what the agent is doing, what it did, and what it needs from you.
- **Trustworthy.** Risky actions look risky. Safe ones don't nag.
- **Notes and chat are one place.** The vault is home, not a side panel.
- **Fast to start.** A new user gets from install to a useful first chat without reading docs.

## 2. Where to start: the chat surface and tool approvals

This is the heart of the app and the weakest part of the experience. Evidence:

- `docs/review-shots/audit-chat/earth-approval-two.png`: `rm -rf ~/EVIL` and `echo SAFE` get the same green "Allow once" button. Approvals carry no sense of risk, scope or outcome.
- `docs/design/critiques/agent-window/fix-list.md` (Oct 10): 7 blockers, 23 worth fixing and 26 minor findings. They cover missing live regions for run status, contrast failures, a model chip you can't reach by keyboard, a composer that drops focus while busy, tool cards with no outcome, and state duplicated in three places. **Caveat:** it critiqued an HTML prototype, so check each item against the shipped app before acting on it.
- Key files: `src/components/ToolApprovalCard.tsx`, `approvalDiff.ts`, `AiMessage.tsx` (1045 lines), `AiPanelChrome.tsx` (1408), `ChatRunLiveStatus.tsx`, `AgentActivityBand.tsx`, `SessionActivityHistory.tsx`, `ChatComposer*.tsx`, `AiWorkspace.tsx`.

Problems to solve, not solutions to copy:
- How does a user read a long run with many tool calls without drowning in it?
- How should approval weight scale with risk (read, edit, shell, destructive, network)? Should there be allow-for-session, allow-for-this-path, or a diff-first review?
- How does the user know a run is thinking, waiting on them, stuck, finished or failed, including users of a screen reader?
- What should the user be able to do mid-run (steer, queue, stop, fork) without fighting the UI?

## 3. The other three focus areas, plus related ground

Atticus wants all four focus areas covered in this run: (1) chat and approvals, above, (2) design system coherence, (3) first run and (4) the critique backlog for the editor, vault, graph and navigation. You choose the order and how deep to go in each. The remaining bullets (settings, startup, shell) are related ground you may take on where it serves those four.

- **Design system coherence.** 355 hand-set `text-[Npx]` sizes across 10 values (9 to 15px, including half pixels), 387 inline `style={{}}` blocks and 127 arbitrary px sizes. The 4px spacing scale is not held. Rules exist (`docs/design/ui-rules.md`, `components.md`, `earth-theme/DESIGN.md`, tokens in `src/index.css` and `src/themes.css`), but the code drifts from them.
- **First run.** `WelcomeScreen.tsx`, `OnboardingShell.tsx`, then vault pick, provider connection and first chat. The provider settings screen (`docs/review-shots/chatgpt-signin/`) is a long stack of identical cards with no guidance on which to pick.
- **Settings.** `SettingsPanel.tsx` is 1939 lines. Consider whether its structure matches how people actually configure the app.
- **Critique backlog: editor, vault, graph and navigation.** The critiques folder has fix-lists for the knowledge graph (keyboard navigation, selected-node state), the vault inbox editor and app navigation. Some were made from older builds.
- **Startup and theme.** `docs/design/2026-10-04-ui-audit.md`: the splash screen picks the wrong theme and a flash of the wrong font is visible.
- **Shell.** `App.tsx` is 2749 lines. Restructure it if that unblocks UX work, not for its own sake.

## 4. Your latitude

You may propose and build **new features, changed features, removed features and merged features**. If two panels should be one, merge them. If a control earns nothing, cut it. If the app needs something it lacks (a run timeline, a command bar that does more, a better empty state), add it. Challenge this brief, the critiques and earlier design docs when your audit disagrees. Agent-written docs in this repo are not primary sources; the running app and the code are.

When a change reverses an existing ADR or a recorded product decision, write a short ADR or design note saying why, and flag it for Atticus in the PR. Don't silently undo it.

## 5. Guardrails

- Read `AGENTS.md` first, then `docs/design/ui-rules.md`. Respect the "hard nos" in `docs/NEXT.md`.
- Paint with role tokens only. No raw hex, `rgb()` or `hsl()` in components. Brand UI binds to `primary`. Every text color must pass `scripts/contrast_check.py`.
- Work in PR branches (ADR-0181). The pre-push hook runs the full gates: `tsc -b`, `eslint --max-warnings=0`, `vitest`, the Rust coverage floor and the Playwright smoke suite. Never use `--no-verify`. Stage files by name, never `git add -A`. Sign commits with a `Co-Authored-By` trailer naming your model.
- Use small, reviewable PRs: one coherent change each, with **before and after screenshots** (light and dark) in `docs/review-shots/<topic>/`. Atticus merges. Don't merge your own PRs, and don't rebuild the installed app unless he asks.
- Keep the Prime/Hermes removal (ADR-0189) out of scope unless it directly blocks a UX change. If it does, say so, and remove only what blocks you.
- Everything committed is public. Use no home paths, real emails or personal data in fixtures.
- Keep behaviour tests behavioural. When you redesign a component, rewrite its tests to the new behaviour rather than deleting them to get green.

## 6. What done looks like

- Chat and approvals have been redesigned. Risk is visible, run state is clear, and the agent-window blockers are fixed or explicitly marked won't-fix with a reason.
- The design system is coherent: one type and spacing scale is in use across every screen, and a lint rule or test stops drift from creeping back.
- First run works end to end, from welcome to vault, provider and first chat, and a smoke test on a fresh profile covers it.
- Each critique fix-list item for the editor, vault, graph and navigation is fixed, or marked won't-fix with a reason, after checking it against the current build.
- All gates are green on every PR, with screenshots attached.
- A short handoff in `docs/plans/handoffs/` lists what changed, what you cut or merged, what you'd do next, and any decisions waiting for Atticus.

## 7. First moves

1. **Audit.** Run `pnpm dev` (UI only, at localhost:5202, with mock Tauri). Screenshot the main screens in both themes. Read the critiques and the UI audit, and check them against what you see.
2. **Plan.** Write your plan, or an ADR if it changes product direction, to `docs/plans/`. Include your priorities, the features you'd add, change, cut or merge, and the PR sequence. Open it as the first PR so Atticus can react before you go deep.
3. **Build.** Start with chat and approvals. Ship in small PRs, each with screenshots and green gates.
4. **Report.** Write the handoff. List open questions for Atticus at the top.
