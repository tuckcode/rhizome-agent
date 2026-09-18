import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('parked organs leftover', () => {
  it('does not vendor TokenJuice or add kanban.db', () => {
    const pkg = readFileSync(`${process.cwd()}/package.json`, 'utf8')
    const cargo = readFileSync(`${process.cwd()}/src-tauri/Cargo.toml`, 'utf8')
    expect(pkg).not.toMatch(/tokenjuice|tinyhumans/i)
    expect(cargo).not.toMatch(/kanban/i)
  })

  it('does not invent selected-text Copy path on the note editor', () => {
    // Highlight-in-note Copy path is leftover. Session list already has
    // Copy path. Note list already has Copy file path. Do not invent a
    // third path this window.
    const editor = readFileSync(`${process.cwd()}/src/components/Editor.tsx`, 'utf8')
    const single = readFileSync(`${process.cwd()}/src/components/SingleEditorView.tsx`, 'utf8')
    expect(editor).not.toMatch(/Copy path/)
    expect(single).not.toMatch(/Copy path/)
  })

  it('keeps rhizome-ship as three verbs', () => {
    const skill = readFileSync(
      `${process.cwd()}/.cursor/skills/rhizome-ship/SKILL.md`,
      'utf8',
    )
    expect(skill).toMatch(/## 1\. commit/)
    expect(skill).toMatch(/## 2\. push/)
    expect(skill).toMatch(/## 3\. rebuild/)
    expect(skill).toMatch(/Never invent a fourth verb/)
  })

  it('keeps the #52 finished-session tray helper', () => {
    const tray = readFileSync(
      `${process.cwd()}/src-tauri/src/menu_bar_companion.rs`,
      'utf8',
    )
    expect(tray).toContain('fn reconcile_finished_sessions')
    expect(tray).toContain('Done: {title}')
    expect(tray).not.toMatch(/UNUserNotification|NSUserNotification/)
  })

  it('does not encode a C66 agent-profile store', () => {
    const settings = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(settings).not.toMatch(/agentProfile|agent_profile|C66/)
  })

  it('does not bump Tiptap or Medium deps this window', () => {
    const pkg = readFileSync(`${process.cwd()}/package.json`, 'utf8')
    const workspace = readFileSync(`${process.cwd()}/pnpm-workspace.yaml`, 'utf8')
    expect(pkg).toContain('"@tiptap/pm": "3.22.5"')
    expect(workspace).toContain("'@tiptap/extension-link@3.19.0'")
    expect(workspace).toContain('hono: 4.12.34')
    expect(workspace).toContain('qs: 6.15.2')
    expect(workspace).not.toMatch(/@tiptap\/core.*3\.30/)
  })

  it('keeps list-import blocked until Atticus types 1', () => {
    const agents = readFileSync(`${process.cwd()}/AGENTS.md`, 'utf8')
    expect(agents).toContain('stays blocked until Atticus says `1`')
  })

  it('does not change blank-cwd HOME fallback — Chat-without-vault', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(host).toContain('normalize_cwd_falls_back_to_home_for_blank_paths')
  })

  it('keeps hide-on-close helper names', () => {
    const lib = readFileSync(`${process.cwd()}/src-tauri/src/lib.rs`, 'utf8')
    expect(lib).not.toContain('["spawned_prime_daemon", "ws_bridge", "mindwalk"]')
    expect(lib).toContain('["ws_bridge", "mindwalk"]')
  })

  it('keeps clock-first HOME session names', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(host).toContain('Rhizome · Sep 6 · 3:35p · dtc · f65c06')
  })

  it('does not widen rust Sentry for ghr_ or Stripe underscore keys', () => {
    const telemetry = readFileSync(
      `${process.cwd()}/src-tauri/src/telemetry.rs`,
      'utf8',
    )
    expect(telemetry).toContain(
      'scrub_secrets_does_not_yet_cover_ghr_or_stripe_underscore_keys',
    )
  })

  it('keeps Welcome Download words in en.json — C18', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(en).toContain('"Download the Getting Started vault"')
  })

  it('keeps packaged MCP generated and gitignored', () => {
    const ignore = readFileSync(`${process.cwd()}/src-tauri/.gitignore`, 'utf8')
    expect(ignore).toContain('/resources/mcp-server/')
  })

  it('does not invoke import_jsonl from Settings', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/SessionImportSettingsSection.tsx`,
      'utf8',
    )
    expect(source).toContain('Import to vault')
    expect(source).not.toMatch(/invoke<[^>]+>\(\s*['"]import_jsonl['"]/)
    expect(source).not.toMatch(/invoke\(\s*['"]import_jsonl['"]/)
  })

  it('restores the last conversation without a vault path', () => {
    const restore = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeSessionRestore.ts`,
      'utf8',
    )
    expect(restore).not.toMatch(/vaultPath/)
  })

  it('keeps C72 View names and Inbox as the folder', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(en).toContain('"command.view.editorNoteList": "Notes, Browse closed"')
    expect(en).toContain('"command.view.fullLayout": "Notes, Browse open"')
    expect(en).toContain('"rail.notes": "Notes"')
    expect(rail).toContain("label={t('rail.notes')}")
    expect(rail).not.toMatch(/label=\{t\('rail\.inbox'\)\}/)
  })

  it('keeps thinking Limited-by-model, Graph Find a note, no composer vault pill', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const deck = readFileSync(
      `${process.cwd()}/src/components/ChatComposerDeck.tsx`,
      'utf8',
    )
    expect(en).toContain('"ai.composer.thinkingModelLimited": "Limited by this model"')
    expect(en).toContain('"graph.controls.searchPlaceholder": "Find a note…"')
    expect(deck).not.toContain('composer-vault-pill')
    expect(deck).not.toMatch(/Switch vault/)
  })

  it('keeps Show Notes at command-rail width and Escape leave-Chat', () => {
    const restore = readFileSync(
      `${process.cwd()}/src/components/VaultPanel.tsx`,
      'utf8',
    )
    const chatHome = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    const lights = readFileSync(
      `${process.cwd()}/src/utils/trafficLights.ts`,
      'utf8',
    )
    expect(restore).toContain("const label = 'Show Notes'")
    expect(restore).toContain('COMMAND_RAIL_WIDTH_PX')
    expect(lights).toContain('export const COMMAND_RAIL_WIDTH_PX = 46')
    expect(chatHome).toContain('onClose={onExit}')
  })

  it('keeps Notes sidebar seam and Stop click-only', () => {
    const css = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')
    const foot = readFileSync(
      `${process.cwd()}/src/components/ChatComposerFoot.tsx`,
      'utf8',
    )
    expect(css).toContain(
      '/* Inner seam against Chat — keep this visible so the column reads as a panel. */',
    )
    expect(css).toContain('border-left: 1px solid var(--sidebar-border);')
    expect(foot).toContain('Stop is click-only')
  })

  it('keeps expanded Settings as a gear, not the word Settings', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).toContain('The Settings gear is')
    expect(rail).toContain('testId="command-rail-settings"')
    expect(rail).not.toMatch(/label=\{['"]Settings['"]\}/)
  })

  it('keeps Mycelium CirclesThree chip, Agents pill, and latest-reply marker', () => {
    const mycelium = readFileSync(
      `${process.cwd()}/src/components/MyceliumView.tsx`,
      'utf8',
    )
    const subhead = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionSubhead.tsx`,
      'utf8',
    )
    const chatHome = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    const chrome = readFileSync(
      `${process.cwd()}/src/components/AiPanelChrome.tsx`,
      'utf8',
    )
    expect(mycelium).toContain('CirclesThree')
    expect(mycelium).not.toContain('window.open')
    expect(subhead).toContain('data-testid="prime-session-footprint"')
    expect(subhead).toContain("title={t('mycelium.title')}")
    expect(chatHome).toContain('skillsLabel="rhizome-vault"')
    expect(chatHome).toContain('<AgentsPill')
    expect(chrome).toContain('isLatestReply={index === latestReplyIndex}')
  })

  it('keeps breadcrumb Properties separate from Close note', () => {
    const breadcrumb = readFileSync(
      `${process.cwd()}/src/components/BreadcrumbBar.tsx`,
      'utf8',
    )
    expect(breadcrumb).toContain("label: translate(locale, 'editor.toolbar.openProperties')")
    expect(breadcrumb).toContain("copy={{ label: translate(locale, 'editor.toolbar.closeNote') }}")
    expect(breadcrumb).toContain('testId="breadcrumb-close-note"')
  })

  it('keeps Research as a rail destination, not a Chat overlay', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).toContain("label={t('rail.research')}")
    expect(rail).toContain('testId="command-rail-research"')
  })

  it('keeps Chat on Prime when Settings default is an API model', () => {
    const chatHome = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    expect(chatHome).toContain(
      'global default must not strip Prime chrome or route chat away from Prime',
    )
    expect(chatHome).toContain("if (defaultAiTarget?.kind === 'api_model')")
    expect(chatHome).toContain("target.agent === 'prime'")
  })

  it('keeps hide Cancel, session filter fields, and composer ArrowUp history', () => {
    const close = readFileSync(
      `${process.cwd()}/src/components/PrimeActiveCloseDialog.tsx`,
      'utf8',
    )
    const meta = readFileSync(
      `${process.cwd()}/src/lib/primeSessionMeta.ts`,
      'utf8',
    )
    const history = readFileSync(
      `${process.cwd()}/src/lib/composerPromptHistory.ts`,
      'utf8',
    )
    expect(close).toContain('onCancel')
    expect(close).toContain("t('ai.close.keepWorking')")
    expect(close).toContain("t('common.cancel')")
    expect(meta).toContain(
      'const fields = [displayTitle, session.title, session.cwd, session.gitBranch]',
    )
    expect(history).toContain('ArrowUp → older, ArrowDown → newer')
  })

  it('waits to load Settings catalogs until Agents or Packages is opened', () => {
    const settings = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(settings).toContain(
      'props.initialSectionId === SETTINGS_SECTION_IDS.ai',
    )
    expect(settings).toContain(
      'props.initialSectionId === SETTINGS_SECTION_IDS.extensions',
    )
    expect(settings).toContain(
      "if (id === SETTINGS_SECTION_IDS.ai) setLoadModelCatalog(true)",
    )
    expect(settings).toContain(
      "if (id === SETTINGS_SECTION_IDS.extensions) setLoadExtensionCatalog(true)",
    )
    expect(settings).toContain(
      'Keep this on Prime for Chat with vault tools.',
    )
  })

  it('mounts Graph and Mycelium only on Changes, not Inbox', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain('chatCentered && isChangesSelection ? (')
    expect(app).not.toMatch(/isInboxSelection[\s\S]{0,80}GraphView/)
  })

  it('keeps X-High in the thinking-level set', () => {
    const levels = readFileSync(
      `${process.cwd()}/src/lib/primeThinkingLevels.ts`,
      'utf8',
    )
    expect(levels).toContain("xhigh: 'X-High'")
    expect(levels).toContain("const LOUD_LEVEL_IDS = ['high', 'xhigh', 'max']")
  })

  it('keeps Chat message actions as icons with hover tooltips', () => {
    const message = readFileSync(
      `${process.cwd()}/src/components/AiMessage.tsx`,
      'utf8',
    )
    expect(message).toContain('ActionTooltip')
    expect(message).toContain('copy={{ label: regenerateLabel }}')
    expect(message).toContain('copy={{ label: copyLabel }}')
    expect(message).toContain('copy={{ label: saveLabel }}')
    expect(message).toContain('copy={{ label: forkLabel }}')
  })

  it('keeps Anthropic Reconnect and DeepSeek Add key on Settings cards', () => {
    const providers = readFileSync(
      `${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`,
      'utf8',
    )
    expect(providers).toContain("anthropic: 'Anthropic'")
    expect(providers).toContain("deepseek: 'DeepSeek'")
    expect(providers).toContain("connected || provider.expired ? 'Reconnect' : 'Sign in'")
    expect(providers).toContain("return 'Add key'")
  })

  it('keeps Linux titlebar drag and first-run scaffold leftover', () => {
    const linux = readFileSync(
      `${process.cwd()}/src/components/LinuxTitlebar.tsx`,
      'utf8',
    )
    const gs = readFileSync(
      `${process.cwd()}/src/utils/gettingStartedVault.ts`,
      'utf8',
    )
    expect(linux).toContain('useDragRegion')
    expect(linux).toContain('const { dragRegionRef } = useDragRegion<HTMLDivElement>()')
    expect(gs).toContain("'Failed to create scaffold folder'")
  })

  it('keeps model-picker provider labels at text-primary contrast', () => {
    const picker = readFileSync(
      `${process.cwd()}/src/components/PrimeModelPicker.tsx`,
      'utf8',
    )
    expect(picker).toContain(
      "const PROVIDER_LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-[0.1em] text-primary'",
    )
  })

  it('keeps queued follow-ups visible and does not speak mutate_queued_message', () => {
    const chrome = readFileSync(
      `${process.cwd()}/src/components/AiPanelChrome.tsx`,
      'utf8',
    )
    expect(chrome).toContain('data-testid="composer-queued-follow-ups"')
    expect(chrome).toContain("t('ai.panel.queuedLabel')")
    expect(chrome).not.toContain('mutate_queued_message')
  })

  it('keeps C57 Limited tools / Power User, not Vault Safe', () => {
    const modes = readFileSync(
      `${process.cwd()}/src/lib/aiAgentPermissionMode.ts`,
      'utf8',
    )
    expect(modes).toContain("control: 'Limited tools'")
    expect(modes).toContain("short: 'Power User'")
    expect(modes).not.toMatch(/Vault Safe/)
    expect(modes).toContain('Prime has no sandbox')
    expect(modes).toContain('export function permissionModeIsInstructionOnly')
  })

  it('keeps Ask-the-agent excerpt wiring', () => {
    const excerpt = readFileSync(
      `${process.cwd()}/src/components/askChatExcerpt.ts`,
      'utf8',
    )
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(excerpt).toContain(
      'Look at this excerpt from “${noteTitle}”:',
    )
    expect(app).toContain('<AskChatExcerptMenu onAsk={handleAskChatAboutExcerpt}>')
    expect(app).toContain('prefillAiComposer(formatAskChatExcerpt(title, excerpt))')
  })

  it('renames from the list without creating a session', () => {
    const list = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionList.tsx`,
      'utf8',
    )
    expect(list).toContain("await call('rename_prime_session', { path: session.path, name })")
    expect(list).toContain('if (vaultPath) {')
    expect(list).not.toMatch(/create_prime_session|new_prime_session/)
  })

  it('keeps mouse back/forward on the note trail only', () => {
    const gestures = readFileSync(
      `${process.cwd()}/src/hooks/useNavigationGestures.ts`,
      'utf8',
    )
    expect(gestures).toContain(
      'Mouse back/forward buttons walk the note trail: note → wikilink → note.',
    )
    expect(gestures).not.toMatch(/switchPrimeSession|onSelectSession/)
  })

  it('keeps Create Getting Started Vault and Inbox as a Notes folder mode', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(en).toContain(
      '"status.vault.cloneGettingStarted": "Create Getting Started Vault"',
    )
    expect(app).toContain('showInbox: explicitOrganizationEnabled')
  })

  it('keeps Notes click-to-close, green latest-reply mark, and chat drag vs select', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    const message = readFileSync(
      `${process.cwd()}/src/components/AiMessage.tsx`,
      'utf8',
    )
    const drag = readFileSync(
      `${process.cwd()}/src/hooks/useDragRegion.ts`,
      'utf8',
    )
    expect(app).not.toContain('onMouseEnter={collapseNotes}')
    expect(app).not.toContain('onMouseLeave={collapseNotes}')
    expect(message).toContain('data-testid="latest-assistant-reply-marker"')
    expect(message).toContain('bg-[var(--accent-green)]')
    expect(message).toContain('data-no-drag')
    expect(drag).toContain('Drag starts only after the pointer moves')
    expect(drag).toContain('const DRAG_DISTANCE_PX = 4')
  })

  it('does not hide Notes just because the window is narrow', () => {
    const layout = readFileSync(`${process.cwd()}/src/lib/shellLayout.ts`, 'utf8')
    expect(layout).toContain('Window width must not hide Notes.')
    expect(layout).toContain('C72 policy lives here: Inbox opens Notes and does not close them.')
  })

  it('toasts Getting Started as created, not cloned', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain('Getting Started vault created and opened at')
    expect(app).not.toContain('Getting Started vault cloned and opened')
  })

  it('keeps Tab ghost-text and leaves #51 Case 2 unbuilt', () => {
    const input = readFileSync(
      `${process.cwd()}/src/components/InlineWikilinkInput.tsx`,
      'utf8',
    )
    const suggestions = readFileSync(
      `${process.cwd()}/src/lib/replySuggestions.ts`,
      'utf8',
    )
    expect(input).toContain('Tab ghost-text accept (#51)')
    expect(input).toContain('if (event.key === \'Tab\' && !event.shiftKey && onAcceptCompletion?.())')
    expect(suggestions).toContain('That is case 2 in #51')
    expect(suggestions).toContain('Deliberately not built here')
  })

  it('installs Prime packages via CLI, with Chat as fallback', () => {
    const packages = readFileSync(
      `${process.cwd()}/src/components/PrimeExtensionsSection.tsx`,
      'utf8',
    )
    expect(packages).toContain(
      'Install runs `prime-agent package install` in the background, then reloads',
    )
    expect(packages).toContain('They run with full system access.')
    expect(packages).toContain('askChatToInstall')
    expect(packages).toContain('queueAiPrompt(primePackageAskAgentPrompt(source), [])')
  })

  it('keeps Chat per-message clocks in the C70 local style', () => {
    const clock = readFileSync(
      `${process.cwd()}/src/utils/messageTimestamp.ts`,
      'utf8',
    )
    expect(clock).toContain("Matches new-session naming style (`3:35p`)")
    expect(clock).toContain('Local clock like `3:35p` / `12:05a`')
  })

  it('keeps check-for-updates next to the theme toggle, not Contribute', () => {
    const bar = readFileSync(
      `${process.cwd()}/src/components/status-bar/StatusBarSections.tsx`,
      'utf8',
    )
    expect(bar).toContain(
      '<BuildNumberButton buildNumber={buildNumber} onCheckForUpdates={onCheckForUpdates} compact={compact} locale={locale} />',
    )
    expect(bar).toContain('contentTestId="status-theme-mode-tooltip"')
    expect(bar).not.toMatch(/Contribute/)
  })

  it('keeps local Getting Started errors on create, git clone on download', () => {
    const gs = readFileSync(
      `${process.cwd()}/src/utils/gettingStartedVault.ts`,
      'utf8',
    )
    expect(gs).toContain(
      'return `Could not create Getting Started vault: ${firstCloneErrorLine(message)}`',
    )
    expect(gs).toContain(
      "'Could not download Getting Started vault. Check your connection and try again.'",
    )
  })

  it('keeps #36 timezone parked and rhizome-ship as three verbs', () => {
    const dates = readFileSync(
      `${process.cwd()}/src/components/VaultContentSettingsSection.tsx`,
      'utf8',
    )
    const skill = readFileSync(
      `${process.cwd()}/.cursor/skills/rhizome-ship/SKILL.md`,
      'utf8',
    )
    const ignore = readFileSync(`${process.cwd()}/.gitignore`, 'utf8')
    expect(dates).toContain('dateDisplayFormat')
    expect(dates).not.toMatch(/timezone|timeZone|America\/Chicago/)
    expect(skill).toMatch(/## 1\. commit/)
    expect(skill).toMatch(/## 2\. push/)
    expect(skill).toMatch(/## 3\. rebuild/)
    expect(skill).toContain('Never invent a fourth verb')
    expect(ignore).toContain('!.cursor/skills/rhizome-ship/')
  })

  it('keeps this tree as Rhizome Agent, not Desktop', () => {
    const identity = readFileSync(`${process.cwd()}/docs/IDENTITY.md`, 'utf8')
    expect(identity).toContain('tuckcode/rhizome-agent')
    expect(identity).toContain('ai.rhizome.agent')
    expect(identity).toContain('ai.rhizome.desktop')
    expect(identity).toContain('knispo/rhizome')
  })

  it('keeps Graph Find as a bottom-right compact box', () => {
    const controls = readFileSync(
      `${process.cwd()}/src/components/graph/GraphControls.tsx`,
      'utf8',
    )
    expect(controls).toContain(
      'Lives bottom-right as a small Find box so the canvas stays readable.',
    )
    expect(controls).toContain("placeholder={t('graph.controls.searchPlaceholder')}")
  })

  it('keeps C42 Windows skip this window', () => {
    const win = readFileSync(`${process.cwd()}/docs/WINDOWS-DEV.md`, 'utf8')
    expect(win).toContain('still no Windows work this window. C42 stays skip.')
  })

  it('keeps first-run scaffold folders-only, without editing rust this window', () => {
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/vault/getting_started.rs`,
      'utf8',
    )
    expect(rust).toContain('structure only, no personal notes')
    expect(rust).toContain('"inbox"')
    expect(rust).toContain('"projects"')
    expect(rust).toContain('"Imports"')
  })

  it('keeps PR #66 KEEP copied and unmerged', () => {
    const paper = readFileSync(
      `${process.cwd()}/docs/plans/pr-66-supersession.md`,
      'utf8',
    )
    expect(paper).toContain('Still do not merge')
    expect(paper).toContain('not a merge')
  })

  it('keeps session mouse-back without a winner and mutate unspoken', () => {
    const mouse = readFileSync(
      `${process.cwd()}/docs/plans/session-mouse-back.md`,
      'utf8',
    )
    const mutate = readFileSync(
      `${process.cwd()}/docs/plans/mutate-queued-message.md`,
      'utf8',
    )
    expect(mouse).toContain('still no winner')
    expect(mutate).toContain('still unspoken')
  })

  it('clears the transcript on session click and withholds the first Prime problem', () => {
    const switcher = readFileSync(
      `${process.cwd()}/src/components/usePrimeSessionSwitcher.ts`,
      'utf8',
    )
    const host = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeHostStatus.ts`,
      'utf8',
    )
    const menu = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionListContextMenu.tsx`,
      'utf8',
    )
    const restore = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeSessionRestore.ts`,
      'utf8',
    )
    expect(switcher).toContain('agent.replaceMessages([])')
    expect(switcher).toContain('Clear the stale transcript in the same')
    expect(host).toContain('function withCorroboratedProblem')
    expect(host).toContain('status: corroborated || code === null ? next : { ...next, problem: null }')
    expect(menu).toContain("label: 'Copy path'")
    expect(restore).not.toMatch(/vaultPath/)
    expect(restore).toContain('idleDiskRestoreEligible')
  })

  it('keeps Nous Add to Chat list, width-folded Sessions, and About Contribute/Docs', () => {
    const providers = readFileSync(
      `${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`,
      'utf8',
    )
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    const about = readFileSync(
      `${process.cwd()}/src/components/AboutSettingsSection.tsx`,
      'utf8',
    )
    const status = readFileSync(
      `${process.cwd()}/src/components/StatusBar.test.tsx`,
      'utf8',
    )
    const close = readFileSync(
      `${process.cwd()}/src/components/PrimeActiveCloseDialog.tsx`,
      'utf8',
    )
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(providers).toContain("if (provider.name === 'nous-portal') return 'Add to Chat list'")
    expect(providers).toContain('return `prime-agent --provider ${provider}`')
    expect(app).toContain('sessionsAutoCollapsed={compactSessions}')
    expect(about).toContain('settings-about-docs')
    expect(status).toContain("keeps Contribute and Docs out of the status bar")
    expect(close).toContain("t('ai.close.keepWorking')")
    expect(host).toContain('"lifecycle": "client_owned"')
  })

  it('keeps Close-note X, ephemeral note lock, and archived session hits', () => {
    const breadcrumb = readFileSync(
      `${process.cwd()}/src/components/BreadcrumbBar.tsx`,
      'utf8',
    )
    const lock = readFileSync(
      `${process.cwd()}/src/hooks/useNoteLockMode.ts`,
      'utf8',
    )
    const sessions = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionList.tsx`,
      'utf8',
    )
    const roster = readFileSync(
      `${process.cwd()}/src/lib/primeRunningSessions.ts`,
      'utf8',
    )
    const arch = readFileSync(
      `${process.cwd()}/docs/ARCHITECTURE.md`,
      'utf8',
    )
    expect(breadcrumb).toContain('testId="breadcrumb-close-note"')
    expect(lock).toContain('Not vault `editor_mode`')
    expect(sessions).toContain(
      'const showArchived = archiveOpen || (searching && visibleArchived.length > 0)',
    )
    expect(roster).toContain('`firstMessage` is the prompt Rhizome *sent*')
    expect(arch).toContain('Grok wiki is out of')
    expect(existsSync(`${process.cwd()}/docs/grok-wiki-index.md`)).toBe(false)
  })

  it('does not spawn onto an overridden socket or cache a failed catalog', () => {
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    const catalog = readFileSync(
      `${process.cwd()}/src/lib/primeModelCatalog.ts`,
      'utf8',
    )
    const host = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeHostStatus.ts`,
      'utf8',
    )
    expect(rust).toContain('const DAEMON_SOCKET_ENV: &str = "RHIZOME_PRIME_DAEMON_SOCKET"')
    expect(rust).toContain('fn daemon_socket_is_overridden()')
    expect(catalog).toContain('A failure is not cached.')
    expect(host).toContain("if (!next.running && vaultPath)")
    expect(host).toContain("await callHost('ensure_prime_session_host', { vaultPath })")
  })

  it('keeps Chat model allow-list, rhizome-vault skill pill, and Welcome create-empty', () => {
    const allow = readFileSync(
      `${process.cwd()}/src/components/PrimeModelAllowListSection.tsx`,
      'utf8',
    )
    const home = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    const welcome = readFileSync(
      `${process.cwd()}/src/components/WelcomeScreen.tsx`,
      'utf8',
    )
    expect(allow).toContain('Chat model menu')
    expect(allow).toContain("Choose which of Prime's models appear in the chat model menu")
    expect(home).toContain('skillsLabel="rhizome-vault"')
    expect(welcome).toContain("onboarding.welcome.createEmpty")
  })

  it('keeps On top / Beside on the notes header and expandable thinking', () => {
    const toggle = readFileSync(
      `${process.cwd()}/src/components/ChatNoteSplitToggle.tsx`,
      'utf8',
    )
    const breadcrumb = readFileSync(
      `${process.cwd()}/src/components/BreadcrumbBar.tsx`,
      'utf8',
    )
    const message = readFileSync(
      `${process.cwd()}/src/components/AiMessage.tsx`,
      'utf8',
    )
    expect(toggle).toContain("label: 'On top'")
    expect(toggle).toContain("label: 'Beside'")
    expect(breadcrumb).toContain('Chat note layout (On top / Beside)')
    expect(breadcrumb).toContain('not the window chrome')
    expect(message).toContain('data-testid="reasoning-toggle"')
    expect(message).toContain('normalizeReasoningDisplay(text)')
  })

  it('keeps reply option pills and waits 4px before titlebar drag', () => {
    const chrome = readFileSync(
      `${process.cwd()}/src/components/AiPanelChrome.tsx`,
      'utf8',
    )
    const drag = readFileSync(
      `${process.cwd()}/src/hooks/useDragRegion.ts`,
      'utf8',
    )
    expect(chrome).toContain("suggestion.kind !== 'options'")
    expect(chrome).toContain('data-testid="composer-reply-suggestions"')
    expect(drag).toContain('const DRAG_DISTANCE_PX = 4')
    expect(drag).toContain('Drag starts only after the pointer moves')
    expect(drag).toContain('More reliable than data-tauri-drag-region')
  })

  it('keeps Agents next to thinking, Notes rail label, and Enter send', () => {
    const home = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    const keys = readFileSync(
      `${process.cwd()}/src/components/inlineWikilinkKeydown.ts`,
      'utf8',
    )
    const menu = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionListContextMenu.tsx`,
      'utf8',
    )
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/lib.rs`,
      'utf8',
    )
    expect(home).toContain('thinkingLevel={primeHost?.thinkingLevel ?? null}')
    expect(home).toContain('<AgentsPill')
    expect(home).toContain('activeEntry={openNoteEntry}')
    expect(rail).toContain("label={t('rail.notes')}")
    expect(rail).not.toContain("label={t('rail.inbox')}")
    expect(keys).toContain("if (event.key !== 'Enter' || event.shiftKey) return false")
    expect(menu).toContain("label: 'View in Mycelium'")
    expect(menu).toContain("label: 'Archive'")
    expect(rust).toContain('fn release_helpers_for_hidden_window')
  })

  it('keeps New Note, Identity Agent, and blank-cwd leftover', () => {
    const notes = readFileSync(
      `${process.cwd()}/src/hooks/commands/noteCommands.ts`,
      'utf8',
    )
    const identity = readFileSync(
      `${process.cwd()}/docs/IDENTITY.md`,
      'utf8',
    )
    const cross = readFileSync(
      `${process.cwd()}/docs/CROSS-MODEL-HANDOFF.md`,
      'utf8',
    )
    const workflow = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(notes).toContain("id: 'create-note'")
    expect(notes).toContain("label: 'New Note'")
    expect(notes).toContain('APP_COMMAND_IDS.fileNewNote')
    expect(identity).toContain('This repository is not Rhizome Desktop.')
    expect(cross).toContain('normalize_cwd("")')
    expect(cross).toContain('Do **not** change that function.')
    expect(workflow).toContain('autoAdvanceInboxAfterOrganize')
  })

  it('keeps Cmd+N as New Note and the Chat working pulse', () => {
    const manifest = readFileSync(
      `${process.cwd()}/src/shared/appCommandManifest.json`,
      'utf8',
    )
    const pulse = readFileSync(
      `${process.cwd()}/src/components/aiPanelPulse.ts`,
      'utf8',
    )
    const layout = readFileSync(
      `${process.cwd()}/src/App.layout-edges.test.ts`,
      'utf8',
    )
    expect(manifest).toContain('"fileNewNote"')
    expect(manifest).toContain('"accelerator": "CmdOrCtrl+N"')
    expect(pulse).toContain('ai-border-pulse 2s ease-in-out infinite')
    expect(layout).toContain('notesOpen')
    expect(layout).toContain('ai-border-pulse')
  })

  it('keeps Welcome clickable offline and Sessions header drag', () => {
    const welcome = readFileSync(
      `${process.cwd()}/src/components/WelcomeScreen.tsx`,
      'utf8',
    )
    const sessions = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionList.tsx`,
      'utf8',
    )
    expect(welcome).toContain('isOffline: boolean')
    expect(welcome).not.toMatch(/isOffline,/)
    expect(welcome).toContain('{ disabled: false, run: onCreateVault }')
    expect(sessions).toContain('useDragRegion<HTMLDivElement>()')
  })

  it('does not speak abort_and_clear_queue, set_follow_up_mode, or set_steering_mode', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    const spoken = readFileSync(
      `${process.cwd()}/docs/plans/mutate-queued-message.md`,
      'utf8',
    )
    const panel = readFileSync(
      `${process.cwd()}/src/components/AiPanel.tsx`,
      'utf8',
    )
    expect(host).toContain('set_follow_up_mode')
    expect(host).not.toMatch(/"abort_and_clear_queue"/)
    expect(host).not.toMatch(/"set_steering_mode"/)
    expect(panel).not.toContain('abort_and_clear_queue')
    expect(panel).not.toContain('set_follow_up_mode')
    expect(panel).not.toContain('set_steering_mode')
    expect(spoken).toContain('still unspoken')
  })

  it('keeps Chat on screen when Notes is open', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(app).toContain('const showVaultPanel = chatCentered && notesOpen')
    expect(app).toContain('const chatHomeSurface = (')
    expect(app).toContain('<ChatHome')
    expect(rail).toContain('active={notesOpen}')
  })

  it('keeps #41 steer wired, hide-spawned daemon, and no Connections edge strip', () => {
    const panel = readFileSync(
      `${process.cwd()}/src/components/AiPanel.tsx`,
      'utf8',
    )
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    const status = readFileSync(
      `${process.cwd()}/src/components/status-bar/StatusBarSections.tsx`,
      'utf8',
    )
    const connections = readFileSync(
      `${process.cwd()}/src/components/ConnectionsPanel.tsx`,
      'utf8',
    )
    expect(panel).toContain('onSteer={isPrimeTarget ? handleSteer : undefined}')
    expect(rust).toContain('pub fn stop_spawned_daemon()')
    expect(status).toContain('export function StatusBarPrimarySection')
    expect(status).toContain('vaultPath')
    expect(connections).not.toContain('connections-edge')
  })

  it('clips Graph to its pane and does not invent Connection unknown', () => {
    const connections = readFileSync(
      `${process.cwd()}/src/components/ConnectionsPanel.tsx`,
      'utf8',
    )
    const d3 = readFileSync(
      `${process.cwd()}/docs/plans/handoffs/2026-09-14-1225-cursor-grok-4-6-d3-status.md`,
      'utf8',
    )
    expect(connections).toContain("style={{ clipPath: 'inset(0)' }}")
    expect(connections).toContain('overflow-hidden isolate')
    expect(d3).toContain('`Connection unknown`')
    expect(d3).toContain('no Chat error banner')
  })

  it('keeps preflight 12px amber, chip truncate, Copy icon, and catalog wait', () => {
    const preflight = readFileSync(
      `${process.cwd()}/src/components/ChatPreflightBanner.tsx`,
      'utf8',
    )
    const deck = readFileSync(
      `${process.cwd()}/src/components/ChatComposerDeck.tsx`,
      'utf8',
    )
    const message = readFileSync(
      `${process.cwd()}/src/components/AiMessage.tsx`,
      'utf8',
    )
    const settings = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(preflight).toContain('text-[12px] font-medium text-foreground')
    expect(preflight).toContain('text-[var(--accent-amber,var(--foreground))]')
    expect(deck).toContain('min-w-0 truncate')
    expect(message).toContain('data-testid="ai-message-copy"')
    expect(message).toContain('<Copy size={14}')
    expect(settings).toContain('skip provider IPC until then')
    expect(settings).toContain('{loadModelCatalog ? <PrimeProviderStatusSection t={t} /> : null}')
  })

  it('still polls Prime with an empty vault and wires ChatHome to that host', () => {
    const host = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeHostStatus.ts`,
      'utf8',
    )
    const home = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    const sessions = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionList.tsx`,
      'utf8',
    )
    expect(host).toContain('return subscribe(vaultPath ?? \'\', setStatus)')
    expect(host).toContain("callHost<PrimeHostStatus>('get_prime_session_host_status')")
    expect(home).toContain('usePrimeHostStatus(isPrimeTarget, vaultPath)')
    expect(sessions).toContain('if (vaultPath) {')
    expect(sessions).toContain("await call('rename_prime_session', { path: session.path, name })")
  })

  it('lets New Chat, thinking, and the model picker run without a vault', () => {
    const home = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    const picker = readFileSync(
      `${process.cwd()}/src/components/PrimeModelPicker.tsx`,
      'utf8',
    )
    expect(home).toContain('onNewChat={() => newChatRef.current?.()}')
    expect(home).toContain('thinkingLevel={primeHost?.thinkingLevel ?? null}')
    expect(home).not.toMatch(/if \(!vaultPath\) return/)
    expect(picker).toContain('if (!hostReady && vaultPath)')
    expect(picker).toContain("await callHost('ensure_prime_session_host', { vaultPath })")
  })

  it('keeps the composer deck optional-vault and does not invent a sheet lock', () => {
    const deck = readFileSync(
      `${process.cwd()}/src/components/ChatComposerDeck.tsx`,
      'utf8',
    )
    const sheet = readFileSync(
      `${process.cwd()}/src/components/SheetEditor.tsx`,
      'utf8',
    )
    expect(deck).toContain('vaultPath?: string')
    expect(deck).not.toMatch(/if \(!vaultPath\)/)
    expect(sheet).not.toContain('noteLocked')
    expect(sheet).not.toContain('readOnly')
  })

  it('keeps Browse and the note list as two independent panels', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain('const showSidebarTree = classicSidebarVisible')
    expect(app).toContain('const showNoteListPanel = classicNoteListVisible')
    expect(app).toContain('showInbox={explicitOrganizationEnabled}')
    expect(app).toContain('<NoteList entries={visibleEntries}')
    expect(app).toContain('<Sidebar entries={visibleEntries}')
  })

  it('lets a human name beat a placeholder, and keeps Open / Rename / Archive', () => {
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_sessions.rs`,
      'utf8',
    )
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    const menu = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionListContextMenu.tsx`,
      'utf8',
    )
    const roster = readFileSync(
      `${process.cwd()}/src/lib/primeRunningSessions.ts`,
      'utf8',
    )
    expect(rust).toContain('is_rhizome_placeholder_name')
    expect(rust).toContain('A deliberate name beats a derived one')
    expect(host).toContain('fn is_rhizome_placeholder_name')
    expect(menu).toContain("label: 'Open'")
    expect(menu).toContain("label: 'Rename'")
    expect(menu).toContain("label: 'Archive'")
    expect(roster).toContain('const named = collapseWhitespace(session.sessionName ?? \'\')')
  })

  it('pins left and puts the Settings gear right when the rail is open', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).toContain('{pinButton}')
    expect(rail).toContain('<span className="ml-auto">{settingsButton}</span>')
    expect(rail).toContain("aria-label={pinnedExpanded ? 'Unpin sidebar' : 'Pin sidebar'}")
    expect(rail).toContain('data-testid="command-rail-toggle"')
    expect(rail).toContain('Conversations sit below the places a person can go')
  })

  it('falls unnamed session logs back to Untitled session', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const list = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionList.tsx`,
      'utf8',
    )
    const titles = readFileSync(
      `${process.cwd()}/src/lib/primeSessionMeta.ts`,
      'utf8',
    )
    expect(en).toContain('"ai.sessions.untitled": "Untitled session"')
    expect(list).toContain("const untitled = t('ai.sessions.untitled')")
    expect(list).toContain('titles[index] ?? untitled')
    expect(titles).toContain('title: session.title?.trim() || untitled')
  })

  it('keeps Cmd+1 as Chat only and Cmd+2 / Cmd+3 as Notes views', () => {
    const manifest = readFileSync(
      `${process.cwd()}/src/shared/appCommandManifest.json`,
      'utf8',
    )
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(manifest).toContain('"viewEditorOnly"')
    expect(manifest).toContain('"accelerator": "CmdOrCtrl+1"')
    expect(manifest).toContain('"accelerator": "CmdOrCtrl+2"')
    expect(manifest).toContain('"accelerator": "CmdOrCtrl+3"')
    expect(en).toContain('"command.view.editorOnly": "Chat only"')
  })

  it('keeps Restore on archived session rows', () => {
    const menu = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionListContextMenu.tsx`,
      'utf8',
    )
    expect(menu).toContain("label: 'Restore'")
    expect(menu).toContain('onSetArchived(session, false)')
    expect(menu).toContain("label: 'Archive'")
    expect(menu).toContain('onSetArchived(session, true)')
  })

  it('hides the window on close and still quits on Cmd+Q', () => {
    const rust = readFileSync(`${process.cwd()}/src-tauri/src/lib.rs`, 'utf8')
    expect(rust).toContain('fn window_hides_instead_of_closing')
    expect(rust).toContain('Cmd+Q raises `ExitRequested`, not `CloseRequested`')
    expect(rust).toContain('fn focus_main_window')
    expect(rust).toContain('app_handle.show()')
    expect(rust).toContain('window.unminimize()')
  })

  it('keeps the vault dropdown on the bottom-left status bar', () => {
    const bar = readFileSync(
      `${process.cwd()}/src/components/status-bar/StatusBarSections.tsx`,
      'utf8',
    )
    expect(bar).toContain('<VaultMenu')
    expect(bar).toContain('vaultPath={vaultPath}')
    expect(bar).toContain('export function StatusBarPrimarySection')
  })

  it('renames from the list through rename_saved_session, not a new session', () => {
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/commands/ai.rs`,
      'utf8',
    )
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(rust).toContain('Speaks `rename_saved_session`')
    expect(rust).toContain('crate::prime_session_host::rename_saved_session(&path, &name)')
    expect(host).toContain('"type": "rename_saved_session"')
  })

  it('adds Nous models into Prime models.json from Add to Chat list', () => {
    const providers = readFileSync(
      `${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`,
      'utf8',
    )
    expect(providers).toContain("Prime's `models.json` when the user clicks Add to Chat list")
    expect(providers).toContain("await callHost<EnsureNousPortalResult>('ensure_nous_portal_models')")
    expect(providers).toContain('Added ${count} Nous Portal ${modelsWord} to the Chat list')
  })

  it('keeps Rhizome in-app updates on the green status-bar control', () => {
    const indicator = readFileSync(
      `${process.cwd()}/src/components/VersionUpdateIndicator.tsx`,
      'utf8',
    )
    expect(indicator).toContain("background: 'var(--accent-green)'")
    expect(indicator).toContain('data-testid="status-version-update"')
    expect(indicator).toContain('rhizomeActions.startDownload()')
    expect(indicator).toContain('testId="version-update-rhizome"')
  })

  it('clears traffic lights on the Sessions rail and keeps Cmd+1 out of Notes chrome', () => {
    const lights = readFileSync(
      `${process.cwd()}/src/utils/trafficLights.ts`,
      'utf8',
    )
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(lights).toContain('export const COMMAND_RAIL_TRAFFIC_LIGHT_INSET')
    expect(lights).toContain('MACOS_TRAFFIC_LIGHT_POSITION.y + 43')
    expect(rail).toContain('paddingTop: trafficLightRoom ? COMMAND_RAIL_TRAFFIC_LIGHT_INSET')
  })

  it('keeps Ask-the-agent-about-this-note on the note list', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const menu = readFileSync(
      `${process.cwd()}/src/components/note-list/NoteListContextMenuView.tsx`,
      'utf8',
    )
    const home = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    expect(en).toContain(
      '"command.note.askAgent": "Ask the agent about this note"',
    )
    expect(menu).toContain("label: translate(locale, 'command.note.askAgent')")
    expect(home).toContain('the vault\'s "Ask the agent about this')
  })

  it('redacts credential-shaped tokens only, not a bare password= leftover', () => {
    const redaction = readFileSync(
      `${process.cwd()}/src/lib/sensitiveTextRedaction.ts`,
      'utf8',
    )
    const coverage = readFileSync(
      `${process.cwd()}/src/lib/sensitiveTextRedaction.test.ts`,
      'utf8',
    )
    expect(redaction).toContain('Replace credential-shaped tokens only')
    expect(coverage).toContain('redactCredentialTokens coverage limit')
    expect(coverage).toContain('password=${OPAQUE_MARKER}')
  })

  it('hides the Prime permission toggle and keeps Copy file path on notes', () => {
    const panel = readFileSync(`${process.cwd()}/src/components/AiPanel.tsx`, 'utf8')
    const chrome = readFileSync(
      `${process.cwd()}/src/components/AiPanelChrome.tsx`,
      'utf8',
    )
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const menu = readFileSync(
      `${process.cwd()}/src/components/note-list/NoteListContextMenuView.tsx`,
      'utf8',
    )
    expect(panel).toContain('hidePermissionMode={isPrimeTarget}')
    expect(chrome).toContain('{hidePermissionMode ? (')
    expect(en).toContain('"editor.toolbar.copyFilePath": "Copy file path"')
    expect(menu).toContain("label: translate(locale, 'editor.toolbar.copyFilePath')")
  })

  it('names new Prime sessions at creation with set_session_name', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(host).toContain('Rhizome seeded a placeholder with `set_session_name` at creation')
    expect(host).toContain('"type": "set_session_name"')
    expect(host).toContain('Prime\'s `set_session_name` only addresses the attached session')
  })

  it('embeds Mycelium in an iframe, not a browser tab', () => {
    const mycelium = readFileSync(
      `${process.cwd()}/src/components/MyceliumView.tsx`,
      'utf8',
    )
    expect(mycelium).toContain('<iframe')
    expect(mycelium).toContain('src={sidecar.url}')
    expect(mycelium).toContain('data-testid="mycelium-embed"')
    expect(mycelium).not.toContain('window.open')
  })

  it('offers the full thinking-level set, including Off and X-High', () => {
    const levels = readFileSync(
      `${process.cwd()}/src/lib/primeThinkingLevels.ts`,
      'utf8',
    )
    expect(levels).toContain("off: 'Off'")
    expect(levels).toContain("minimal: 'Minimal'")
    expect(levels).toContain("low: 'Low'")
    expect(levels).toContain("medium: 'Medium'")
    expect(levels).toContain("high: 'High'")
    expect(levels).toContain("xhigh: 'X-High'")
    expect(levels).toContain("max: 'Max'")
  })

  it('promotes on Keep working, then hides', () => {
    const close = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeActiveClose.ts`,
      'utf8',
    )
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(close).toContain("void settleAndHide('keep_working')")
    expect(close).toContain("await callHost('settle_prime_session', { intent })")
    expect(rust).toContain('"type": "promote_owned_session"')
    expect(rust).toContain('fn keep_working_promotes_then_detaches')
  })

  it('keeps regenerate, save-to-vault, and fork as Chat action icons', () => {
    const message = readFileSync(
      `${process.cwd()}/src/components/AiMessage.tsx`,
      'utf8',
    )
    expect(message).toContain('data-testid="ai-message-regenerate"')
    expect(message).toContain('data-testid="ai-message-save-to-vault"')
    expect(message).toContain('data-testid="ai-message-fork"')
    expect(message).toContain('data-testid="ai-message-copy"')
  })

  it('writes settings owner-only and keeps the D6 dep pins', () => {
    const fs = readFileSync(
      `${process.cwd()}/src-tauri/src/secure_fs.rs`,
      'utf8',
    )
    const workspace = readFileSync(
      `${process.cwd()}/pnpm-workspace.yaml`,
      'utf8',
    )
    expect(fs).toContain('owner-only (`0o600`)')
    expect(fs).toContain('.mode(0o600)')
    expect(workspace).toContain('js-yaml@3: 3.15.2')
    expect(workspace).toContain('fast-uri: 3.1.6')
  })
})
