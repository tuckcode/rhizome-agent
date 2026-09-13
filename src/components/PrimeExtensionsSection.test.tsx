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
}))

vi.mock('../lib/callHost', () => ({
  callHost: async (cmd: string) => {
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
}))

import { writeClipboardText } from '../utils/clipboardText'

describe('PrimeExtensionsSection', () => {
  beforeEach(() => {
    state.installed = []
    state.hits = []
    state.total = 0
    state.lastKind = 'all'
    vi.mocked(writeClipboardText).mockClear()
  })

  it('does not search until the section is active', async () => {
    render(<PrimeExtensionsSection active={false} />)
    expect(screen.getByTestId('prime-extensions-section')).toBeInTheDocument()
    expect(screen.queryByText('pi-mcp-adapter')).not.toBeInTheDocument()
  })

  it('lists catalog hits and copies a Prime install command', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Copy install' }))
    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith(
        'prime-agent package install npm:pi-mcp-adapter',
      )
    })
    expect(screen.getByTestId('prime-extensions-copied')).toHaveTextContent(
      'prime-agent package install npm:pi-mcp-adapter',
    )
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
