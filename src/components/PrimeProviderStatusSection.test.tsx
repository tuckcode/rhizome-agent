import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeProviderStatusSection } from './PrimeProviderStatusSection'
import { createTranslator } from '../lib/i18n'

const state = vi.hoisted(() => ({
  providers: [] as unknown[],
  fail: false,
  nousFail: '',
  nousResult: { provider: 'nous-portal', modelCount: 2, reloaded: true },
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: async (cmd: string) => {
    if (cmd === 'get_prime_provider_status') {
      if (state.fail) throw new Error('unavailable')
      return state.providers
    }
    if (cmd === 'ensure_nous_portal_models') {
      if (state.nousFail) throw new Error(state.nousFail)
      return state.nousResult
    }
    return null
  },
}))

vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackNousPortalAddedToChat: vi.fn(),
}))

import { writeClipboardText } from '../utils/clipboardText'
import { trackNousPortalAddedToChat } from '../lib/productAnalytics'
import { resetPrimeModelCatalog } from '../lib/primeModelCatalog'

const t = createTranslator('en')

beforeEach(() => {
  state.providers = []
  state.fail = false
  state.nousFail = ''
  state.nousResult = { provider: 'nous-portal', modelCount: 2, reloaded: true }
  vi.mocked(writeClipboardText).mockClear()
  vi.mocked(trackNousPortalAddedToChat).mockClear()
  resetPrimeModelCatalog()
})

describe('PrimeProviderStatusSection', () => {
  it('lists each provider with how it is connected', async () => {
    state.providers = [
      { name: 'anthropic', authKind: 'oauth', expiresAt: 9e12, expired: false },
      { name: 'opencode', authKind: 'api_key', expired: false },
    ]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      // Connected + always-show placeholders (xai, deepseek, nous-portal).
      expect(screen.getAllByTestId('prime-provider-row').length).toBeGreaterThanOrEqual(5)
    })
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('OpenCode')).toBeInTheDocument()
    expect(screen.getByText('DeepSeek')).toBeInTheDocument()
    expect(screen.getByText('Nous Portal')).toBeInTheDocument()
    expect(screen.getAllByText('OAuth').length).toBeGreaterThan(0)
    expect(screen.getAllByText('API key').length).toBeGreaterThan(0)
  })

  it('marks a working connection as connected', async () => {
    state.providers = [{ name: 'xai', authKind: 'oauth', expiresAt: 9e12, expired: false }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
    expect(screen.getByText('xAI (Grok)')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-provider-expired')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prime-provider-sign-in-xai')).not.toBeInTheDocument()
  })

  it('falls back to the raw name for a provider it does not know', async () => {
    state.providers = [{ name: 'some-new-host', authKind: 'api_key', expired: false }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByText('some-new-host')).toBeInTheDocument()
    })
  })

  it('flags an expired token and offers reconnect', async () => {
    state.providers = [{ name: 'xai', authKind: 'oauth', expiresAt: 1, expired: true }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-expired')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-provider-sign-in-xai')).toHaveTextContent('Reconnect')
  })

  it('does not flag an API key as expired', async () => {
    state.providers = [{ name: 'opencode', authKind: 'api_key', expired: false }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByText('OpenCode')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('prime-provider-expired')).not.toBeInTheDocument()
  })

  it('shows OAuth and API-key providers to set up even when nothing is connected yet', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-anthropic')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-provider-sign-in-xai')).toBeInTheDocument()
    expect(screen.getByTestId('prime-provider-sign-in-deepseek')).toBeInTheDocument()
    expect(screen.getByTestId('prime-provider-sign-in-nous-portal')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-provider-status-empty')).not.toBeInTheDocument()
  })

  it('copies the prime-agent login command when sign in is clicked', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-xai')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('prime-provider-sign-in-xai'))

    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith('prime-agent --provider xai')
    })
    expect(await screen.findByTestId('prime-provider-sign-in-notice')).toHaveTextContent('prime-agent --provider xai')
  })

  it('copies DeepSeek add-key command', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-deepseek')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('prime-provider-sign-in-deepseek'))
    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith('prime-agent --provider deepseek')
    })
  })

  it('adds Nous Portal models to Prime so Chat can list them', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-nous-portal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('prime-provider-sign-in-nous-portal'))
    expect(await screen.findByTestId('prime-provider-sign-in-notice')).toHaveTextContent(
      'Added 2 Nous Portal models',
    )
    expect(trackNousPortalAddedToChat).toHaveBeenCalledWith(2)
    expect(writeClipboardText).not.toHaveBeenCalled()
  })

  it('still offers Add to Chat list after the key is already connected', async () => {
    state.providers = [{ name: 'nous-portal', authKind: 'api_key', expired: false }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-nous-portal')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-provider-sign-in-nous-portal')).toHaveTextContent(
      'Add to Chat list',
    )
  })

  it('copies the Nous API key line without rewriting models.json', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-copy-nous-key')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('prime-provider-copy-nous-key'))
    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith("export NOUS_API_KEY='paste-your-key-here'")
    })
  })

  it('degrades to setup placeholders when the check fails', async () => {
    state.fail = true
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-anthropic')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-provider-sign-in-deepseek')).toBeInTheDocument()
  })
})
