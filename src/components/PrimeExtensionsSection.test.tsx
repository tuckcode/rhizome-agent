import { readFileSync } from 'node:fs'
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
  searchCalls: 0,
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
      state.searchCalls += 1
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

import { trackPrimePackageCatalogOpened } from '../lib/productAnalytics'
import { writeClipboardText } from '../utils/clipboardText'
import { queueAiPrompt, requestOpenAiChat } from '../utils/aiPromptBridge'

describe('PrimeExtensionsSection', () => {
  beforeEach(() => {
    state.installed = []
    state.hits = []
    state.total = 0
    state.lastKind = 'all'
    state.installError = null
    state.searchCalls = 0
    vi.mocked(trackPrimePackageCatalogOpened).mockClear()
    vi.mocked(writeClipboardText).mockClear()
    vi.mocked(queueAiPrompt).mockClear()
    vi.mocked(requestOpenAiChat).mockClear()
  })

  it('does not search until Browse packages is opened', async () => {
    render(<PrimeExtensionsSection active={false} />)
    expect(screen.getByTestId('prime-extensions-section')).toBeInTheDocument()
    expect(screen.queryByText('pi-mcp-adapter')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prime-packages-browse')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(state.searchCalls).toBe(0)
    })
    expect(trackPrimePackageCatalogOpened).not.toHaveBeenCalled()
  })

  it('keeps the catalog collapsed until Browse packages is clicked', async () => {
    state.hits = [{
      name: 'pi-mcp-adapter',
      description: 'MCP adapter',
      publisher: 'nicopreme',
      downloadsMonthly: 900000,
      npmUrl: 'https://www.npmjs.com/package/pi-mcp-adapter',
      kinds: ['extension'],
    }]
    render(<PrimeExtensionsSection />)
    expect(screen.getByRole('button', { name: 'Browse packages' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('prime-extensions-search')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(state.searchCalls).toBe(0)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Browse packages' }))
    expect(await screen.findByTestId('prime-extensions-search')).toBeInTheDocument()
    expect(trackPrimePackageCatalogOpened).toHaveBeenCalled()
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
    fireEvent.click(screen.getByRole('button', { name: 'Browse packages' }))
    expect(await screen.findByText('pi-mcp-adapter')).toBeInTheDocument()
    expect(screen.getByText('Packages')).toBeInTheDocument()
    expect(screen.getByText(
      'Add-ons for the Prime engine: extensions, skills, prompts and themes.',
    )).toBeInTheDocument()
    expect(screen.getByTestId('prime-packages-access-warning')).toHaveTextContent(
      'They run with full system access. Review the source before you install.',
    )
    expect(screen.getByTestId('prime-packages-kind-tabs')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All' })).toHaveClass('bg-foreground')
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveClass('text-muted-foreground')
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

  it('clamps catalog descriptions and top-aligns Install', async () => {
    state.hits = [{
      name: 'pi-mcp-adapter',
      description: 'A long description that should clamp to two lines in the catalog row.',
      publisher: 'nicopreme',
      downloadsMonthly: 1,
      npmUrl: 'https://www.npmjs.com/package/pi-mcp-adapter',
      kinds: ['extension'],
    }]
    state.total = 1
    render(<PrimeExtensionsSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse packages' }))
    expect(await screen.findByText(/A long description/)).toHaveClass('line-clamp-2')
    expect(screen.getByRole('button', { name: 'Install' })).toHaveClass('self-start')
    expect(screen.getByTestId('prime-packages-catalog-list')).toHaveClass('max-h-[31rem]')
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
    fireEvent.click(screen.getByRole('button', { name: 'Browse packages' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Browse packages' }))
    expect(await screen.findByTestId('prime-packages-kind-tabs')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }))
    await waitFor(() => {
      expect(state.lastKind).toBe('skill')
    })
  })

  it('installs through Prime packages, not a second plugin kernel', () => {
    const source = readFileSync(`${process.cwd()}/src/components/PrimeExtensionsSection.tsx`, 'utf8')
    expect(source).toContain("install_prime_package")
    expect(source).toContain('prime-agent package install')
    expect(source).not.toMatch(/cordis|plugin kernel/i)
  })
})
