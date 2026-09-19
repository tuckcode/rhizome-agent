import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover chrome 1616', () => {
  it('lets first-message titles replace the Rhizome clock name', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(host).toContain('fn title_candidate')
    expect(host).toContain('including the older `Rhizome · vault · id` shape')
    expect(host).toContain(
      'titles and human renames still replace this via `is_rhizome_placeholder_name`',
    )
  })

  it('merges Nous into models.json without writing the API key', () => {
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_custom_models.rs`,
      'utf8',
    )
    expect(rust).toContain('never the API key, never `auth.json`')
    expect(rust).toContain('pub fn merge_nous_portal')
    expect(rust).toContain('"apiKey": NOUS_PORTAL_API_KEY_ENV')
  })

  it('keeps Welcome Open existing vault and Switch vault on the status bar', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const welcome = readFileSync(
      `${process.cwd()}/src/components/WelcomeScreen.tsx`,
      'utf8',
    )
    const vault = readFileSync(
      `${process.cwd()}/src/components/status-bar/VaultMenu.tsx`,
      'utf8',
    )
    expect(en).toContain('"onboarding.welcome.openExisting": "Open existing vault"')
    expect(en).toContain('"status.vault.switch": "Switch vault"')
    expect(welcome).toContain("onboarding.welcome.openExisting")
    expect(vault).toContain("translate(locale, 'status.vault.switch')")
  })

  it('clears traffic lights on the Sessions header when it is the top band', () => {
    const lights = readFileSync(
      `${process.cwd()}/src/utils/trafficLights.ts`,
      'utf8',
    )
    const sessions = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionList.tsx`,
      'utf8',
    )
    expect(lights).toContain('export function sessionsColumnTitleBarStyle')
    expect(lights).toContain('export function overlayTitleBarBandStyle')
    expect(lights).toContain('When the sessions column is the topmost band')
    expect(sessions).toContain('sessionsColumnTitleBarStyle()')
  })

  it('keeps Notes Collapse, Browse, and Lock note labels', () => {
    const panel = readFileSync(
      `${process.cwd()}/src/components/VaultPanel.tsx`,
      'utf8',
    )
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    const breadcrumb = readFileSync(
      `${process.cwd()}/src/components/BreadcrumbBar.tsx`,
      'utf8',
    )
    expect(panel).toContain('data-testid="vault-panel-collapse"')
    expect(panel).toContain('data-testid="vault-panel-browse-toggle"')
    expect(panel).toContain('data-testid="vault-panel-focus"')
    expect(panel).toContain('Hide Chat so Notes can fill the window')
    expect(en).toContain('"sidebar.action.collapse": "Collapse sidebar"')
    expect(en).toContain('"sidebar.browse": "Browse"')
    expect(breadcrumb).toContain(
      "copy={{ label: noteLocked ? 'Unlock note' : 'Lock note' }}",
    )
    expect(breadcrumb).toContain('testId="breadcrumb-note-lock"')
  })

  it('keeps Grok Reconnect and the Nous Terminal paste notice', () => {
    const providers = readFileSync(
      `${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`,
      'utf8',
    )
    expect(providers).toContain("xai: 'xAI (Grok)'")
    expect(providers).toContain(
      "Copied the NOUS_API_KEY line. Paste it in Terminal, then Add to Chat list.",
    )
  })

  it('keeps Check for updates as a Rhizome command, not Prime install', () => {
    const manifest = readFileSync(
      `${process.cwd()}/src/shared/appCommandManifest.json`,
      'utf8',
    )
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(manifest).toContain('"appCheckForUpdates"')
    expect(manifest).toContain('"id": "app-check-for-updates"')
    expect(en).toContain('"status.update.check": "Check for updates"')
  })

  it('stops work on idle hide and opens Chat on a fresh launch', () => {
    const rust = readFileSync(`${process.cwd()}/src-tauri/src/lib.rs`, 'utf8')
    const view = readFileSync(
      `${process.cwd()}/src/lib/panePresetStorage.ts`,
      'utf8',
    )
    const meta = readFileSync(
      `${process.cwd()}/src/lib/primeSessionMeta.ts`,
      'utf8',
    )
    expect(rust).toContain('fn idle_main_window_close_intent')
    expect(rust).toContain('SessionCloseIntent::Stop')
    expect(view).toContain(
      "const viewMode = stored === 'editor-list' || stored === 'all' ? stored : 'editor-only'",
    )
    expect(meta).toContain("if (options.working) return 'Working · tools'")
  })
})
