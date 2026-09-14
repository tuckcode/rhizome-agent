---
session: 2026-09-14T15:32-05:00
model: Grok 4.6 (Cursor)
description: >-
  Exact git commit -- paths for D6. Regenerated 15:32.
  Do not run until ~15:45. Never git add -A. lib.rs once.
---

# D6 commit -- paths

Dirty 279+. Orphans: ['.cursor/'] (ship-skill only).
Named files after 15:32 ride group 5. Do not `git add` dirs.
Use `git commit -- path1 path2` with the message drafts.
Co-author: `Cursor Grok 4.6 <noreply@cursor.com>`.

Do not add `.cursor/`. Do not add the 2026-09-12 thinking-pill handoff.

Later `docs/plans/handoffs/2026-09-14-*` files written after this list
still ride group 5. Name them. Do not `git add` the handoffs folder.

## C72 (10)

```
docs/plans/c72-notes-delta.md
src/components/KeyboardShortcutsDialog.test.tsx
src/components/KeyboardShortcutsDialog.tsx
src/hooks/appCommandCatalog.test.ts
src/hooks/appCommandCatalog.ts
src/hooks/commands/navigationCommands.c72.test.ts
src/hooks/commands/viewCommands.c72.test.ts
src/hooks/commands/viewCommands.ts
src/lib/locales/en.json
src/shared/appCommandManifest.json
```

## D2/D3 (7)

```
src/components/AiPanelChrome.tsx
src/components/ChatComposerDeck.contextPill.test.tsx
src/components/ChatComposerDeck.tsx
src/components/ChatComposerFoot.test.tsx
src/components/ChatComposerFoot.tsx
src/components/ChatPreflightBanner.test.tsx
src/components/ChatPreflightBanner.tsx
```

## neighbor tests (44)

```
src/App.layout-edges.test.ts
src/App.test.tsx
src/components/AiMessage.test.tsx
src/components/AiPanel.test.tsx
src/components/AiPanelChrome.scroll.test.tsx
src/components/AiPanelComposer.queue.test.tsx
src/components/BreadcrumbBar.test.tsx
src/components/ChatHome.test.tsx
src/components/CommandRail.test.tsx
src/components/LinuxTitlebar.test.tsx
src/components/MyceliumView.test.tsx
src/components/NoteList.contextMenu.test.tsx
src/components/PrimeActiveCloseDialog.test.tsx
src/components/PrimeExtensionsSection.test.tsx
src/components/PrimeModelPicker.test.tsx
src/components/PrimeProviderStatusSection.test.tsx
src/components/PrimeSessionList.test.tsx
src/components/PrimeSessionSubhead.test.tsx
src/components/PrimeThinkingToggle.test.tsx
src/components/SessionImportSettingsSection.test.tsx
src/components/SettingsPanel.test.tsx
src/components/StatusBar.test.tsx
src/components/VaultContentSettingsSection.test.ts
src/components/WelcomeScreen.test.tsx
src/components/WelcomeScreen.tsx
src/components/editor-content/EditorContentLayout.test.tsx
src/components/graph/GraphControls.test.tsx
src/components/usePrimeSessionSwitcher.test.tsx
src/hooks/useNavigationGestures.test.ts
src/hooks/useNoteLockMode.test.ts
src/hooks/usePrimeHostStatus.test.ts
src/hooks/usePrimeSessionRestore.test.ts
src/lib/aiAgentPermissionMode.test.ts
src/lib/composerPromptHistory.test.ts
src/lib/parked-organs.test.ts
src/lib/replySuggestions.test.ts
src/utils/aiPromptBridge.test.ts
src/utils/gettingStartedVault.test.ts
src/utils/gettingStartedVault.ts
src/utils/messageTimestamp.test.ts
src/utils/nativeContextMenu.test.ts
src/utils/streamAiAgent.test.ts
tests/smoke/getting-started-template.spec.ts
tests/smoke/offline-onboarding-status.spec.ts
```

## native 4+7 (8)

```
src-tauri/src/ai_models.rs
src-tauri/src/lib.rs
src-tauri/src/prime_session_host.rs
src-tauri/src/prime_vault_skill.rs
src-tauri/src/secure_fs.rs
src-tauri/src/settings.rs
src-tauri/src/telemetry.rs
src-tauri/src/vault_list.rs
```

## docs + ship (201)

```
.cursor/skills/rhizome-ship/SKILL.md
.gitignore
AGENTS.md
docs/ABSTRACTIONS.md
docs/ARCHITECTURE.md
docs/ASTRA_GOD_PLAN.md
docs/ASTRA_PACKET.md
docs/BOARD.md
docs/CROSS-MODEL-HANDOFF.md
docs/GETTING-STARTED.md
docs/HANDOFF.md
docs/IDENTITY.md
docs/MORNING.md
docs/NEXT.md
docs/WINDOWS-DEV.md
docs/YOU-SHOULD-KNOW.md
docs/design/brand/2026-09-13/README.md
docs/design/brand/2026-09-14-handoff/ASSET-GALLERY.md
docs/design/brand/2026-09-14-handoff/ASSET-MANIFEST.json
docs/design/brand/2026-09-14-handoff/CURSOR-FIVE-HOUR-PLAN.md
docs/design/brand/2026-09-14-handoff/D5-DOCK-AND-SITE.md
docs/design/brand/2026-09-14-handoff/FRONTEND-DESIGN.md
docs/design/brand/2026-09-14-handoff/INTEGRATION.md
docs/design/brand/2026-09-14-handoff/MEMORY-DIRECTION.md
docs/design/brand/2026-09-14-handoff/PROMPTS.md
docs/design/brand/2026-09-14-handoff/README.md
docs/design/brand/2026-09-14-handoff/REPO-STATE.md
docs/design/brand/2026-09-14-handoff/START-HERE.md
docs/design/import-jsonl-routes.md
docs/design/memory-loop.md
docs/design/prime-agent-surface.md
docs/design/prime-spoken-surface.md
docs/plans/c66-agent-profile.md
docs/plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md
docs/plans/handoffs/2026-09-14-1115-cursor-grok-4-6-morning-pickup.md
docs/plans/handoffs/2026-09-14-1118-composer-w2-issue-snapshot.md
docs/plans/handoffs/2026-09-14-1120-cursor-grok-4-6-w4-source-remainder.md
docs/plans/handoffs/2026-09-14-1122-cursor-grok-4-6-w7-46-checklist.md
docs/plans/handoffs/2026-09-14-1124-composer-w9-tray-evidence.md
docs/plans/handoffs/2026-09-14-1125-composer-w10-bridge-evidence.md
docs/plans/handoffs/2026-09-14-1128-composer-w7-codacy.md
docs/plans/handoffs/2026-09-14-1130-composer-36-52-57-implementability.md
docs/plans/handoffs/2026-09-14-1140-composer-reserve-hygiene.md
docs/plans/handoffs/2026-09-14-1145-cursor-grok-4-6-docked-questions.md
docs/plans/handoffs/2026-09-14-1148-cursor-grok-4-6-five-hour-burn.md
docs/plans/handoffs/2026-09-14-1155-cursor-grokbot-leftover-review.md
docs/plans/handoffs/2026-09-14-1156-composer-mycelium-chip.md
docs/plans/handoffs/2026-09-14-1200-composer-w7-extra-tests.md
docs/plans/handoffs/2026-09-14-1210-cursor-grok-4-6-astra-pickup-slot.md
docs/plans/handoffs/2026-09-14-1215-cursor-grok-4-6-c72-label-review.md
docs/plans/handoffs/2026-09-14-1216-cursor-grok-4-6-41-steer-gap.md
docs/plans/handoffs/2026-09-14-1217-cursor-grok-4-6-paper-audit.md
docs/plans/handoffs/2026-09-14-1220-cursor-grok-4-6-d2-readability.md
docs/plans/handoffs/2026-09-14-1221-cursor-grok-4-6-d4-gallery.md
docs/plans/handoffs/2026-09-14-1225-cursor-grok-4-6-d3-status.md
docs/plans/handoffs/2026-09-14-1230-cursor-grok-4-6-d5-dock-site.md
docs/plans/handoffs/2026-09-14-1235-cursor-grok-4-6-d1-about-visual.md
docs/plans/handoffs/2026-09-14-1240-cursor-grok-4-6-d2-visual.md
docs/plans/handoffs/2026-09-14-1245-cursor-grok-4-6-d3-test-gap.md
docs/plans/handoffs/2026-09-14-1246-cursor-grok-4-6-s3-s4-redaction.md
docs/plans/handoffs/2026-09-14-1250-cursor-grok-4-6-ship-skill-gitignore.md
docs/plans/handoffs/2026-09-14-1255-cursor-grok-4-6-s1-s2-mcp-boundary.md
docs/plans/handoffs/2026-09-14-1258-cursor-grok-4-6-r1-env-ignore.md
docs/plans/handoffs/2026-09-14-1300-cursor-grok-4-6-dep-triage.md
docs/plans/handoffs/2026-09-14-1305-cursor-grok-4-6-r2-r4-secure-fs.md
docs/plans/handoffs/2026-09-14-1308-cursor-grok-4-6-dep-patch.md
docs/plans/handoffs/2026-09-14-1310-cursor-grok-4-6-tiptap-reachability.md
docs/plans/handoffs/2026-09-14-1312-cursor-grok-4-6-cursor-ignore.md
docs/plans/handoffs/2026-09-14-1316-cursor-grok-4-6-trivy-rescan.md
docs/plans/handoffs/2026-09-14-1318-cursor-grok-4-6-c72-c57-stamps.md
docs/plans/handoffs/2026-09-14-1321-cursor-grok-4-6-thinking-tmp.md
docs/plans/handoffs/2026-09-14-1324-cursor-grok-4-6-memory-loop-import.md
docs/plans/handoffs/2026-09-14-1326-cursor-grok-4-6-session-filter.md
docs/plans/handoffs/2026-09-14-1328-cursor-grok-4-6-action-icons.md
docs/plans/handoffs/2026-09-14-1330-cursor-grok-4-6-getting-started.md
docs/plans/handoffs/2026-09-14-1332-cursor-grok-4-6-secure-fs-parent.md
docs/plans/handoffs/2026-09-14-1334-cursor-grok-4-6-s1-js-tag.md
docs/plans/handoffs/2026-09-14-1336-cursor-grok-4-6-ship-skill-pointer.md
docs/plans/handoffs/2026-09-14-1338-cursor-grok-4-6-d6-rust-dirt.md
docs/plans/handoffs/2026-09-14-1340-cursor-grok-4-6-s4-hyphen-key.md
docs/plans/handoffs/2026-09-14-1342-cursor-grok-4-6-c64-stamp.md
docs/plans/handoffs/2026-09-14-1344-cursor-grok-4-6-home-slash.md
docs/plans/handoffs/2026-09-14-1346-cursor-grok-4-6-home-slash-looks.md
docs/plans/handoffs/2026-09-14-1350-cursor-grok-4-6-d6-inventory.md
docs/plans/handoffs/2026-09-14-1354-cursor-grok-4-6-graph-find-label.md
docs/plans/handoffs/2026-09-14-1356-cursor-grok-4-6-note-split-place.md
docs/plans/handoffs/2026-09-14-1358-cursor-grok-4-6-ysk-43.md
docs/plans/handoffs/2026-09-14-1400-cursor-grok-4-6-vault-stays-bar.md
docs/plans/handoffs/2026-09-14-1402-cursor-grok-4-6-mycelium-iframe.md
docs/plans/handoffs/2026-09-14-1404-cursor-grok-4-6-rail-notes-label.md
docs/plans/handoffs/2026-09-14-1406-cursor-grok-4-6-chat-stays-canvas.md
docs/plans/handoffs/2026-09-14-1408-cursor-grok-4-6-next-order.md
docs/plans/handoffs/2026-09-14-1410-cursor-grok-4-6-hide-cancel.md
docs/plans/handoffs/2026-09-14-1412-cursor-grok-4-6-escape-prefill.md
docs/plans/handoffs/2026-09-14-1414-cursor-grok-4-6-c72-shortcuts.md
docs/plans/handoffs/2026-09-14-1416-cursor-grok-4-6-prime-default.md
docs/plans/handoffs/2026-09-14-1418-cursor-grok-4-6-api-default-warn.md
docs/plans/handoffs/2026-09-14-1420-cursor-grok-4-6-properties-not-close.md
docs/plans/handoffs/2026-09-14-1422-cursor-grok-4-6-research-center.md
docs/plans/handoffs/2026-09-14-1424-cursor-grok-4-6-import-vault-only.md
docs/plans/handoffs/2026-09-14-1426-cursor-grok-4-6-ask-note.md
docs/plans/handoffs/2026-09-14-1428-cursor-grok-4-6-note-lock.md
docs/plans/handoffs/2026-09-14-1430-cursor-grok-4-6-s1-coffee-search.md
docs/plans/handoffs/2026-09-14-1432-cursor-grok-4-6-s3-xai.md
docs/plans/handoffs/2026-09-14-1434-cursor-grok-4-6-queue-stays.md
docs/plans/handoffs/2026-09-14-1436-cursor-grok-4-6-s3-gsk-pat.md
docs/plans/handoffs/2026-09-14-1440-cursor-grok-4-6-ask-excerpt.md
docs/plans/handoffs/2026-09-14-1441-cursor-grok-4-6-s3-rest.md
docs/plans/handoffs/2026-09-14-1442-cursor-grok-4-6-r4-rest.md
docs/plans/handoffs/2026-09-14-1443-cursor-grok-4-6-s3-ghr.md
docs/plans/handoffs/2026-09-14-1444-cursor-grok-4-6-agents-pill-home.md
docs/plans/handoffs/2026-09-14-1445-cursor-grok-4-6-s3-slack.md
docs/plans/handoffs/2026-09-14-1446-cursor-grok-4-6-sessions-drag.md
docs/plans/handoffs/2026-09-14-1447-cursor-grok-4-6-gutter-prime.md
docs/plans/handoffs/2026-09-14-1448-cursor-grok-4-6-w4-still-not-run.md
docs/plans/handoffs/2026-09-14-1449-cursor-grok-4-6-welcome-download-copy.md
docs/plans/handoffs/2026-09-14-1450-cursor-grok-4-6-welcome-offline.md
docs/plans/handoffs/2026-09-14-1451-cursor-grok-4-6-notes-hide-compact.md
docs/plans/handoffs/2026-09-14-1452-cursor-grok-4-6-gs-created-toast.md
docs/plans/handoffs/2026-09-14-1453-cursor-grok-4-6-last-idle-wire.md
docs/plans/handoffs/2026-09-14-1454-cursor-grok-4-6-gs-create-error.md
docs/plans/handoffs/2026-09-14-1455-cursor-grok-4-6-graph-changes-only.md
docs/plans/handoffs/2026-09-14-1456-cursor-grok-4-6-chat-no-vault.md
docs/plans/handoffs/2026-09-14-1457-cursor-grok-4-6-hover-mutate.md
docs/plans/handoffs/2026-09-14-1458-cursor-grok-4-6-preflight-no-vault.md
docs/plans/handoffs/2026-09-14-1459-cursor-grok-4-6-gs-rust-skip.md
docs/plans/handoffs/2026-09-14-1460-cursor-grok-4-6-leftover-inventory.md
docs/plans/handoffs/2026-09-14-1461-cursor-grok-4-6-chat-center-hide.md
docs/plans/handoffs/2026-09-14-1462-cursor-grok-4-6-prime-keep-inbox.md
docs/plans/handoffs/2026-09-14-1463-cursor-grok-4-6-w4-hide-restamp.md
docs/plans/handoffs/2026-09-14-1464-cursor-grok-4-6-d2-chip-queue.md
docs/plans/handoffs/2026-09-14-1465-cursor-grok-4-6-c68-c57-amber.md
docs/plans/handoffs/2026-09-14-1466-cursor-grok-4-6-host-no-vault.md
docs/plans/handoffs/2026-09-14-1467-cursor-grok-4-6-chathome-host-d6.md
docs/plans/handoffs/2026-09-14-1468-cursor-grok-4-6-restore-c18.md
docs/plans/handoffs/2026-09-14-1469-cursor-grok-4-6-sessions-no-ensure.md
docs/plans/handoffs/2026-09-14-1470-cursor-grok-4-6-new-chat-no-vault.md
docs/plans/handoffs/2026-09-14-1471-cursor-grok-4-6-c46-trap.md
docs/plans/handoffs/2026-09-14-1472-cursor-grok-4-6-thinking-no-vault.md
docs/plans/handoffs/2026-09-14-1473-cursor-grok-4-6-picker-switch-no-vault.md
docs/plans/handoffs/2026-09-14-1474-cursor-grok-4-6-composer-no-vault.md
docs/plans/handoffs/2026-09-14-1475-cursor-grok-4-6-oauth-reconnect.md
docs/plans/handoffs/2026-09-14-1476-cursor-grok-4-6-home-name-history.md
docs/plans/handoffs/2026-09-14-1477-cursor-grok-4-6-copy-no-vault-pill.md
docs/plans/handoffs/2026-09-14-1478-cursor-grok-4-6-c57-mouse-rust.md
docs/plans/handoffs/2026-09-14-1479-cursor-grok-4-6-rename-no-create.md
docs/plans/handoffs/2026-09-14-1480-cursor-grok-4-6-pulse-packages.md
docs/plans/handoffs/2026-09-14-1481-cursor-grok-4-6-xhigh-docked.md
docs/plans/handoffs/2026-09-14-1482-cursor-grok-4-6-c70-linux-case2.md
docs/plans/handoffs/2026-09-14-1483-cursor-grok-4-6-action-tooltips-mycelium.md
docs/plans/handoffs/2026-09-14-1484-cursor-grok-4-6-gs-folders-lock.md
docs/plans/handoffs/2026-09-14-1485-cursor-grok-4-6-d6-orphan-audit.md
docs/plans/handoffs/2026-09-14-1486-cursor-grok-4-6-d6-message-drafts.md
docs/plans/handoffs/2026-09-14-1487-cursor-grok-4-6-d6-paths-ok.md
docs/plans/handoffs/2026-09-14-1488-cursor-grok-4-6-d6-group-audit.md
docs/plans/handoffs/2026-09-14-1489-cursor-grok-4-6-copy-path-parked.md
docs/plans/handoffs/2026-09-14-1490-cursor-grok-4-6-tiptap-medium-parked.md
docs/plans/handoffs/2026-09-14-1491-cursor-grok-4-6-c68-ephemeral.md
docs/plans/handoffs/2026-09-14-1492-cursor-grok-4-6-import-one-lock.md
docs/plans/handoffs/2026-09-14-1493-cursor-grok-4-6-d6-recount.md
docs/plans/handoffs/2026-09-14-1494-cursor-grok-4-6-cwd-home-lock.md
docs/plans/handoffs/2026-09-14-1495-cursor-grok-4-6-hide-home-name.md
docs/plans/handoffs/2026-09-14-1496-cursor-grok-4-6-rust-ghr-parked.md
docs/plans/handoffs/2026-09-14-1497-cursor-grok-4-6-d6-commands.md
docs/plans/handoffs/2026-09-14-1498-cursor-grok-4-6-import-restore.md
docs/plans/handoffs/2026-09-14-1499-cursor-grok-4-6-d6-regen.md
docs/plans/handoffs/2026-09-14-1500-cursor-grok-4-6-c72-inbox-lock.md
docs/plans/handoffs/2026-09-14-1501-cursor-grok-4-6-thinking-find-pill.md
docs/plans/handoffs/2026-09-14-1502-cursor-grok-4-6-show-notes-escape.md
docs/plans/handoffs/2026-09-14-1503-cursor-grok-4-6-notes-seam-stop.md
docs/plans/handoffs/2026-09-14-1504-cursor-grok-4-6-settings-gear.md
docs/plans/handoffs/2026-09-14-1505-cursor-grok-4-6-mycelium-agents-marker.md
docs/plans/handoffs/2026-09-14-1506-cursor-grok-4-6-properties-research.md
docs/plans/handoffs/2026-09-14-1507-cursor-grok-4-6-prime-keep.md
docs/plans/handoffs/2026-09-14-1508-cursor-grok-4-6-hide-filter-history.md
docs/plans/handoffs/2026-09-14-1509-cursor-grok-4-6-settings-catalog-wait.md
docs/plans/handoffs/2026-09-14-1510-cursor-grok-4-6-graph-changes-lock.md
docs/plans/handoffs/2026-09-14-1511-cursor-grok-4-6-xhigh-leftover.md
docs/plans/handoffs/2026-09-14-1512-cursor-grok-4-6-action-tooltips.md
docs/plans/handoffs/2026-09-14-1513-cursor-grok-4-6-reconnect-add-key.md
docs/plans/handoffs/2026-09-14-1514-cursor-grok-4-6-linux-scaffold.md
docs/plans/handoffs/2026-09-14-1515-cursor-grok-4-6-picker-queue.md
docs/plans/handoffs/2026-09-14-1516-cursor-grok-4-6-c57-limited.md
docs/plans/handoffs/2026-09-14-1517-cursor-grok-4-6-d6-ready.md
docs/plans/handoffs/2026-09-14-1518-cursor-grok-4-6-ask-excerpt.md
docs/plans/handoffs/2026-09-14-1519-cursor-grok-4-6-rename-no-create.md
docs/plans/handoffs/2026-09-14-1520-cursor-grok-4-6-d6-start.md
docs/plans/handoffs/2026-09-14-1521-cursor-grok-4-6-handoff-prune.md
docs/plans/hide-on-close-helpers.md
docs/plans/import-jsonl-decision.md
docs/plans/issue-36-timezone-setting.md
docs/plans/issue-52-menu-bar-done.md
docs/plans/issue-57-ghost-compat.md
docs/plans/living-docs-audit.md
docs/plans/morning-native-observer.md
docs/plans/mutate-queued-message.md
docs/plans/pr-66-supersession.md
docs/plans/rhizome-ship-skill.md
docs/plans/s-plans/2026-09-13-astra/README.md
docs/plans/s-plans/2026-09-13-astra/W1-living-truth.md
docs/plans/s-plans/2026-09-13-astra/W10-bridge.md
docs/plans/s-plans/2026-09-13-astra/W11-parked-cards.md
docs/plans/s-plans/2026-09-13-astra/W2-issue-evidence.md
docs/plans/s-plans/2026-09-13-astra/W3-pr66.md
docs/plans/s-plans/2026-09-13-astra/W4-chat-reliability.md
docs/plans/s-plans/2026-09-13-astra/W5-prime-surface.md
docs/plans/s-plans/2026-09-13-astra/W6-import-decision.md
docs/plans/s-plans/2026-09-13-astra/W7-security.md
docs/plans/s-plans/2026-09-13-astra/W8-notes-clarity.md
docs/plans/s-plans/2026-09-13-astra/W9-tray.md
docs/plans/s-plans/2026-09-14-d6-commit-commands.md
docs/plans/s-plans/2026-09-14-d6-commit-groups.md
docs/plans/s-plans/2026-09-14-d6-commit-messages.md
docs/plans/s-plans/2026-09-14-d6-commit-paths.md
docs/plans/s-plans/2026-09-14-five-hour-burn.md
docs/plans/s-plans/2026-09-14-morning-wave-2.md
docs/plans/s-plans/2026-09-14-morning-wave-3.md
docs/plans/s-plans/2026-09-14-morning-wave-4.md
docs/plans/s-plans/2026-09-14-morning-wave-5-tests.md
docs/plans/s-plans/2026-09-14-morning-wave-5.md
docs/plans/session-mouse-back.md
docs/plans/w11-card-status.md
src/components/AboutSettingsSection.test.tsx
src/hooks/C64.md
```

## S1-S4 (10)

```
docs/plans/s-plans/2026-09-14-security-audit/README.md
mcp-server/agent-instructions.js
mcp-server/vault.js
mcp-server/vault.security.test.js
src/lib/feedbackDiagnostics.test.ts
src/lib/feedbackDiagnostics.ts
src/lib/sensitiveTextRedaction.test.ts
src/lib/sensitiveTextRedaction.ts
src/lib/telemetry.test.ts
src/lib/telemetry.ts
```

## dep pins (3)

```
mcp-server/package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

