import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeExtensionsSection } from './PrimeExtensionsSection'

const state = vi.hoisted(() => ({
  installed: [] as string[],
  hits: [] as Array<{
    name: string
    description: string
    publisher: string | null
    downloadsMonthly: number | null
    npmUrl: string
    kinds: string[]
  }>,
  total: 0,
  lastKind: 'all' as string,
  installError: null as string | null,
}))

vi.mock('../lib/callHost', () => ({
  callHost: async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === 'install_prime_package') {
      if (state.installError) throw new Error(state.installError)
      const source = String(args?.source ?? '')
      state.installed.push(source.startsWith('npm:') ? source : `npm:${source}`)
      return { source: `npm:${String(args?.source ?? '').replace(/^npm:/, '')}`, reloaded: true }
    }
    if (cmd !== 'list_prime_packages') return null
    return state.installed
  },
}))

vi.mock('../lib/primePackages', async () => {
  const actual = await vi.importActual<typeof import('../lib/primePackages')>('../lib/primePackages')
  return {
    ...actual,
    searchPrimePackageCatalog: async (_query: string, kind = 'all') => {
      state.lastKind = kind
      return { hits: state.hits, total: state.total }
    },
  }
})

vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/url', () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackPrimePackageCatalogOpened: vi.fn(),
  trackPrimePackageInstallCopied: vi.fn(),
  trackPrimePackageInstalled: vi.fn(),
  trackPrimePackageInstallFailed: vi.fn(),
}))

vi.mock('../utils/aiPromptBridge', () => ({
  queueAiPrompt: vi.fn(),
  requestOpenAiChat: vi.fn(),
}))

import { writeClipboardText } from '../utils/clipboardText'
import { queueAiPrompt, requestOpenAiChat } from '../utils/aiPromptBridge'

describe('PrimeExtensionsSection', () => {
  beforeEach(() => {
    state.installed = []
    state.hits = []
    state.total = 0
    state.lastKind = 'all'
    state.installError = null
    vi.mocked(writeClipboardText).mockClear()
    vi.mocked(queueAiPrompt).mockClear()
    vi.mocked(requestOpenAiChat).mockClear()
  })

  it('does not search until the section is active', async () => {
    render(<PrimeExtensionsSection active={false} />)
    expect(screen.getByTestId('prime-extensions-section')).toBeInTheDocument()
    expect(screen.queryByText('pi-mcp-adapter')).not.toBeInTheDocument()
  })

  it('lists catalog hits and installs after a full-access warning', async () => {
    state.hits = [{
      name: 'pi-mcp-adapter',
      description: 'MCP adapter',
      publisher: 'nicopreme',
      downloadsMonthly: 900000,
      npmUrl: 'https://www.npmjs.com/package/pi-mcp-adapter',
      kinds: ['extension'],
    }]
    state.total = 9724
    render(<PrimeExtensionsSection />)
    expect(await screen.findByText('pi-mcp-adapter')).toBeInTheDocument()
    expect(screen.getByText('Packages')).toBeInTheDocument()
    expect(screen.getByTestId('prime-packages-kind-tabs')).toBeInTheDocument()
    expect(screen.getByText(/9,724 packages/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('full system access')
    fireEvent.click(screen.getByRole('button', { name: 'Install package' }))
    await waitFor(() => {
      expect(screen.getByText('On this machine')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-extensions-installed-status')).toHaveTextContent(
      'Installed. Prime reloaded this chat.',
    )
  })

  it('asks Chat to install when Prime CLI is missing', async () => {
    state.hits = [{
      name: 'pi-mcp-adapter',
      description: 'MCP adapter',
      publisher: 'nicopreme',
      downloadsMonthly: 900000,
      npmUrl: 'https://www.npmjs.com/package/pi-mcp-adapter',
      kinds: ['extension'],
    }]
    state.total = 1
    state.installError = 'Prime is not installed. Install it with `npm i -g prime-agent`.'
    render(<PrimeExtensionsSection onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Install' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Install package' }))
    expect(await screen.findByRole('button', { name: 'Ask Chat to install' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Chat to install' }))
    expect(queueAiPrompt).toHaveBeenCalledWith(
      expect.stringContaining('prime-agent package install npm:pi-mcp-adapter'),
      [],
    )
    expect(requestOpenAiChat).toHaveBeenCalled()
  })

  it('lists packages already in Prime settings', async () => {
    state.installed = ['pi-skills']
    render(<PrimeExtensionsSection />)
    expect(await screen.findByText('pi-skills')).toBeInTheDocument()
    expect(screen.getByText('Installed')).toBeInTheDocument()
    expect(screen.getByText('On this machine')).toBeInTheDocument()
  })

  it('searches skills when that catalog tab is chosen', async () => {
    render(<PrimeExtensionsSection />)
    expect(await screen.findByTestId('prime-packages-kind-tabs')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }))
    await waitFor(() => {
      expect(state.lastKind).toBe('skill')
    })
  })
})
