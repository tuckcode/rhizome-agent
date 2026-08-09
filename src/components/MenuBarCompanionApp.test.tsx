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

vi.mock('../lib/i18n', () => ({
  DEFAULT_APP_LOCALE: 'en',
  createTranslator: () => (key: string) => key,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
}))

// Default: a vault with no events. Individual tests override.
function mockBackend({
  activeVault = '/vault',
  label = 'My Vault',
  events = [] as Array<Record<string, unknown>>,
}: { activeVault?: string | null; label?: string; events?: Array<Record<string, unknown>> } = {}) {
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === 'load_vault_list') {
      return Promise.resolve({
        vaults: activeVault ? [{ label, path: activeVault }] : [],
        active_vault: activeVault,
      })
    }
    if (cmd === 'call_rhizome_tool') return Promise.resolve(JSON.stringify(events))
    return Promise.resolve(undefined)
  })
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

  it('renders activity rows when the vault has events', async () => {
    mockBackend({
      events: [{ type: 'distill', title: 'Event Sourcing', timestamp: '2026-07-19T10:00:00Z' }],
    })
    render(<MenuBarCompanionApp />)
    await waitFor(() =>
      expect(screen.getByTestId('menu-bar-companion-activity')).toHaveTextContent('Event Sourcing'),
    )
  })
})
