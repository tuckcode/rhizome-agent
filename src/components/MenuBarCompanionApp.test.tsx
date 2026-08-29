import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MenuBarCompanionApp } from './MenuBarCompanionApp'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: vi.fn(async () => () => {}),
  }),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
}))

const defaultSettingsResponse = {
  auto_pull_interval_minutes: null,
  git_enabled: null,
  autogit_enabled: null,
  autogit_idle_threshold_seconds: null,
  autogit_inactive_threshold_seconds: null,
  auto_advance_inbox_after_organize: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  automatic_update_checks_enabled: null,
  theme_mode: null,
  color_theme: null,
  accent_color: null,
  ui_language: null,
  date_display_format: null,
  note_width_mode: null,
  sidebar_type_pluralization_enabled: null,
  default_ai_agent: null,
  ai_features_enabled: null,
  default_ai_target: null,
  agent_memory_vault_path: null,
  ai_model_providers: null,
  ai_workspace_conversations: null,
  hide_gitignored_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  multi_workspace_enabled: null,
}

// Default: a vault with no events. Individual tests override.
function mockBackend({
  activeVault = '/vault',
  label = 'My Vault',
  events = [] as Array<Record<string, unknown>>,
  running = [] as Array<Record<string, unknown>>,
}: {
  activeVault?: string | null
  label?: string
  events?: Array<Record<string, unknown>>
  running?: Array<Record<string, unknown>>
} = {}) {
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === 'load_vault_list') {
      return Promise.resolve({
        vaults: activeVault ? [{ label, path: activeVault }] : [],
        active_vault: activeVault,
      })
    }
    if (cmd === 'call_rhizome_tool') return Promise.resolve(JSON.stringify(events))
    if (cmd === 'list_prime_running_sessions') return Promise.resolve(running)
    if (cmd === 'get_settings') return Promise.resolve(defaultSettingsResponse)
    return Promise.resolve(undefined)
  })
}

/** A running top-level session as the daemon's `list` reports it. */
function runningSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'root',
    activeSessionId: 'root',
    sessionFile: '/Users/dtc/.prime/agent/sessions/root.jsonl',
    activity: 'working',
    runtimeKind: 'top-level',
    rlmDepth: 0,
    firstMessage: 'Ship the menu bar roster',
    cwd: '/repo',
    ...overrides,
  }
}

describe('MenuBarCompanionApp', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    mockBackend()
  })

  it('renders capture, actions, empty activity, and open-main', async () => {
    render(<MenuBarCompanionApp />)
    expect(screen.getByTestId('menu-bar-companion')).toBeInTheDocument()
    expect(screen.getByTestId('menu-bar-companion-capture')).toBeInTheDocument()
    expect(screen.getByTestId('menu-bar-companion-distill')).toBeInTheDocument()
    expect(screen.getByTestId('menu-bar-companion-search')).toBeInTheDocument()
    expect(screen.getByTestId('menu-bar-companion-open-main')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId('menu-bar-companion-activity-empty')).toBeInTheDocument(),
    )
  })

  it('shows type picker on Tab in the capture field', async () => {
    render(<MenuBarCompanionApp />)
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('load_vault_list'))
    fireEvent.keyDown(screen.getByTestId('menu-bar-companion-capture'), { key: 'Tab' })
    expect(screen.getByTestId('menu-bar-companion-type-picker')).toBeInTheDocument()
    expect(screen.getByTestId('menu-bar-companion')).toHaveAttribute('data-state', 'picking-type')
  })

  it('invokes open_main_from_menu_bar_companion from the footer action', async () => {
    render(<MenuBarCompanionApp />)
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('load_vault_list'))
    fireEvent.click(screen.getByTestId('menu-bar-companion-open-main'))
    expect(invokeMock).toHaveBeenCalledWith('open_main_from_menu_bar_companion')
  })

  it('shows the active vault label once loaded', async () => {
    mockBackend({ label: 'Rhizome Vault' })
    render(<MenuBarCompanionApp />)
    await waitFor(() =>
      expect(screen.getByTestId('menu-bar-companion-vault-row')).toHaveTextContent('Rhizome Vault'),
    )
  })

  it('creates a note on Enter with the active vault path', async () => {
    mockBackend({ activeVault: '/vault' })
    render(<MenuBarCompanionApp />)
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('load_vault_list'))

    const capture = screen.getByTestId('menu-bar-companion-capture')
    fireEvent.change(capture, { target: { value: 'Remember this thought' } })
    fireEvent.keyDown(capture, { key: 'Enter' })

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        'create_note_content',
        expect.objectContaining({
          vaultPath: '/vault',
          path: expect.stringContaining('raw/inbox/'),
          content: expect.stringContaining('# Remember this thought'),
        }),
      ),
    )
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        'call_rhizome_tool',
        expect.objectContaining({
          name: 'rhizome_append_event',
          args: expect.objectContaining({
            vaultPath: '/vault',
            type: 'capture',
            trigger: 'menu_bar',
            artifact_path: expect.stringContaining('raw/inbox/'),
          }),
        }),
      ),
    )
  })

  it('does not create a note when no vault is active', async () => {
    mockBackend({ activeVault: null })
    render(<MenuBarCompanionApp />)
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('load_vault_list'))

    const capture = screen.getByTestId('menu-bar-companion-capture')
    fireEvent.change(capture, { target: { value: 'Nowhere to save' } })
    fireEvent.keyDown(capture, { key: 'Enter' })

    expect(invokeMock).not.toHaveBeenCalledWith('create_note_content', expect.anything())
  })

  it('distills clipboard text into the active vault', async () => {
    mockBackend({ activeVault: '/vault' })
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'load_vault_list') {
        return Promise.resolve({
          vaults: [{ label: 'My Vault', path: '/vault' }],
          active_vault: '/vault',
        })
      }
      if (cmd === 'call_rhizome_tool') return Promise.resolve(JSON.stringify([]))
      if (cmd === 'read_text_from_clipboard') return Promise.resolve('  Durable idea from clipboard  ')
      if (cmd === 'start_rhizome_job') return Promise.resolve(null)
      if (cmd === 'get_settings') return Promise.resolve(defaultSettingsResponse)
      return Promise.resolve(undefined)
    })
    render(<MenuBarCompanionApp />)
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('load_vault_list'))

    fireEvent.click(screen.getByTestId('menu-bar-companion-distill'))

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        'start_rhizome_job',
        expect.objectContaining({
          name: 'rhizome_distill',
          args: expect.objectContaining({
            text: 'Durable idea from clipboard',
            vaultPath: '/vault',
            trigger: 'menu_bar',
          }),
        }),
      ),
    )
  })

  it('redacts credentials in clipboard text before distill', async () => {
    const pat = ['ghp', 'A'.repeat(36)].join('_')
    mockBackend({ activeVault: '/vault' })
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'load_vault_list') {
        return Promise.resolve({
          vaults: [{ label: 'My Vault', path: '/vault' }],
          active_vault: '/vault',
        })
      }
      if (cmd === 'call_rhizome_tool') return Promise.resolve(JSON.stringify([]))
      if (cmd === 'read_text_from_clipboard') return Promise.resolve(`Durable idea ${pat}`)
      if (cmd === 'start_rhizome_job') return Promise.resolve(null)
      if (cmd === 'get_settings') return Promise.resolve(defaultSettingsResponse)
      return Promise.resolve(undefined)
    })
    render(<MenuBarCompanionApp />)
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('load_vault_list'))

    fireEvent.click(screen.getByTestId('menu-bar-companion-distill'))

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        'start_rhizome_job',
        expect.objectContaining({
          name: 'rhizome_distill',
          args: expect.objectContaining({
            text: expect.stringContaining('[redacted-token]'),
            vaultPath: '/vault',
            trigger: 'menu_bar',
          }),
        }),
      ),
    )
    const distillCall = invokeMock.mock.calls.find(([cmd]) => cmd === 'start_rhizome_job')
    const text = (distillCall?.[1] as { args?: { text?: string } } | undefined)?.args?.text
    expect(text).not.toContain(pat)
  })

  it('renders activity rows when the vault has events', async () => {
    mockBackend({
      events: [{ type: 'distill', title: 'Event Sourcing', timestamp: '2026-07-19T10:00:00Z' }],
    })
    render(<MenuBarCompanionApp />)
    await waitFor(() =>
      expect(screen.getByTestId('menu-bar-companion-activity')).toHaveTextContent('Event Sourcing'),
    )
  })

  it('stays quiet when nothing is running rather than showing an empty frame', async () => {
    mockBackend({ running: [runningSession({ activity: 'idle' })] })
    render(<MenuBarCompanionApp />)
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('list_prime_running_sessions'),
    )
    expect(screen.queryByTestId('menu-bar-companion-running')).not.toBeInTheDocument()
  })

  it('stays quiet when the daemon is unreachable', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'load_vault_list') {
        return Promise.resolve({ vaults: [], active_vault: null })
      }
      if (cmd === 'list_prime_running_sessions') return Promise.reject(new Error('no daemon'))
      if (cmd === 'get_settings') return Promise.resolve(defaultSettingsResponse)
      return Promise.resolve(undefined)
    })
    render(<MenuBarCompanionApp />)
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('list_prime_running_sessions'),
    )
    expect(screen.queryByTestId('menu-bar-companion-running')).not.toBeInTheDocument()
  })

  it('keeps quick capture first, above the running list', async () => {
    mockBackend({ running: [runningSession()] })
    render(<MenuBarCompanionApp />)
    const roster = await screen.findByTestId('menu-bar-companion-running')
    const capture = screen.getByTestId('menu-bar-companion-capture')
    // Node.compareDocumentPosition: FOLLOWING === 4. Capture must precede the
    // roster in document order — #13 is explicit that capture is what the
    // popover is opened for and must not be displaced.
    expect(capture.compareDocumentPosition(roster) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('lists a running session with what it is doing', async () => {
    mockBackend({ running: [runningSession({ summary: 'Reading the vault loader' })] })
    render(<MenuBarCompanionApp />)
    const rows = await screen.findAllByTestId('menu-bar-companion-running-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Ship the menu bar roster')
    expect(rows[0]).toHaveTextContent('Reading the vault loader')
  })

  it('translates a roster status label through the locale file', async () => {
    mockBackend({
      running: [
        runningSession({
          summary: undefined,
          isStreaming: true,
          taskState: 'needs_input',
        }),
      ],
    })
    render(<MenuBarCompanionApp />)
    const rows = await screen.findAllByTestId('menu-bar-companion-running-row')
    expect(rows[0]).toHaveTextContent('Replying')
  })

  it('shows subagents as a count and not as rows', async () => {
    mockBackend({
      running: [
        runningSession(),
        runningSession({ id: 'kid1', activeSessionId: 'kid1', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'root' }),
        runningSession({ id: 'kid2', activeSessionId: 'kid2', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'root' }),
      ],
    })
    render(<MenuBarCompanionApp />)
    const rows = await screen.findAllByTestId('menu-bar-companion-running-row')
    expect(rows).toHaveLength(1)
    expect(screen.getByTestId('menu-bar-companion-running-subagents')).toBeInTheDocument()
  })

  it('opens the main window onto the clicked session', async () => {
    mockBackend({ running: [runningSession()] })
    render(<MenuBarCompanionApp />)
    const rows = await screen.findAllByTestId('menu-bar-companion-running-row')
    fireEvent.click(rows[0])
    expect(invokeMock).toHaveBeenCalledWith('open_main_from_menu_bar_companion', {
      sessionFile: '/Users/dtc/.prime/agent/sessions/root.jsonl',
    })
  })
})
