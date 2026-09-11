import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeProviderStatusSection } from './PrimeProviderStatusSection'
import { createTranslator } from '../lib/i18n'

const state = vi.hoisted(() => ({ providers: [] as unknown[], fail: false }))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: async (cmd: string) => {
    if (cmd !== 'get_prime_provider_status') return null
    if (state.fail) throw new Error('unavailable')
    return state.providers
  },
}))

vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: vi.fn().mockResolvedValue(undefined),
}))

import { writeClipboardText } from '../utils/clipboardText'

const t = createTranslator('en')

beforeEach(() => {
  state.providers = []
  state.fail = false
  vi.mocked(writeClipboardText).mockClear()
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

  it('copies Nous Portal setup snippet', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-nous-portal')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('prime-provider-sign-in-nous-portal'))
    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalled()
    })
    const copied = vi.mocked(writeClipboardText).mock.calls.at(-1)?.[0] as string
    expect(copied).toContain('NOUS_API_KEY')
    expect(copied).toContain('inference-api.nousresearch.com')
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
