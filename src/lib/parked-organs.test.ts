import { readFileSync } from 'node:fs'
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

  it('does not add a #52 Done TTL on the tray', () => {
    const tray = readFileSync(
      `${process.cwd()}/src-tauri/src/menu_bar_companion.rs`,
      'utf8',
    )
    expect(tray).not.toMatch(/Done TTL|done_ttl|just_finished|just finished/)
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
    expect(lib).toContain('["spawned_prime_daemon", "ws_bridge", "mindwalk"]')
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
})
