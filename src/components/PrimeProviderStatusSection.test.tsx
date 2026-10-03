import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeProviderStatusSection } from './PrimeProviderStatusSection'
import { createTranslator } from '../lib/i18n'

const state = vi.hoisted(() => ({
  providers: [] as unknown[],
  fail: false,
  nousFail: '',
  nousResult: { provider: 'nous-portal', modelCount: 2, reloaded: true },
  signInFail: '',
  calls: [] as Array<{ cmd: string; args: unknown }>,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: async (cmd: string, args?: unknown) => {
    state.calls.push({ cmd, args })
    if (cmd === 'sign_in_prime_provider' || cmd === 'save_prime_provider_key') {
      if (state.signInFail) throw new Error(state.signInFail)
      return null
    }
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
  trackPrimeProviderSignIn: vi.fn(),
}))

vi.mock('../utils/url', () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

import { writeClipboardText } from '../utils/clipboardText'
import { trackNousPortalAddedToChat, trackPrimeProviderSignIn } from '../lib/productAnalytics'
import { openExternalUrl } from '../utils/url'
import { resetPrimeModelCatalog } from '../lib/primeModelCatalog'

const t = createTranslator('en')

beforeEach(() => {
  state.providers = []
  state.fail = false
  state.nousFail = ''
  state.nousResult = { provider: 'nous-portal', modelCount: 2, reloaded: true }
  state.signInFail = ''
  state.calls = []
  vi.mocked(openExternalUrl).mockClear()
  vi.mocked(trackPrimeProviderSignIn).mockClear()
  vi.mocked(writeClipboardText).mockClear()
  vi.mocked(trackNousPortalAddedToChat).mockClear()
  resetPrimeModelCatalog()
})

describe('PrimeProviderStatusSection', () => {
  it('signs in to Anthropic in the browser and refreshes the cards', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    fireEvent.click(await screen.findByTestId('prime-provider-sign-in-anthropic'))

    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-notice')).toHaveTextContent('Signed in to Anthropic.')
    })
    expect(state.calls).toContainEqual({ cmd: 'sign_in_prime_provider', args: { provider: 'anthropic' } })
    expect(state.calls.filter((call) => call.cmd === 'get_prime_provider_status')).toHaveLength(2)
    expect(writeClipboardText).not.toHaveBeenCalled()
    expect(trackPrimeProviderSignIn).toHaveBeenCalledWith('anthropic', 'browser', 'success')
  })

  it('shows why a browser sign-in failed', async () => {
    state.providers = []
    state.signInFail = 'Sign-in stopped before it finished.'
    render(<PrimeProviderStatusSection t={t} />)
    fireEvent.click(await screen.findByTestId('prime-provider-sign-in-anthropic'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in stopped before it finished.')
    expect(trackPrimeProviderSignIn).toHaveBeenCalledWith('anthropic', 'browser', 'failed')
  })

  it('opens the xAI key page and saves the pasted key through Prime', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    fireEvent.click(await screen.findByTestId('prime-provider-sign-in-xai'))

    expect(openExternalUrl).toHaveBeenCalledWith('https://console.x.ai')
    fireEvent.change(await screen.findByTestId('prime-provider-key-input-xai'), {
      target: { value: 'xai-test-key' },
    })
    fireEvent.click(screen.getByTestId('prime-provider-key-save-xai'))

    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-notice')).toHaveTextContent('Saved the xAI (Grok) key.')
    })
    expect(state.calls).toContainEqual({
      cmd: 'save_prime_provider_key',
      args: { provider: 'xai', key: 'xai-test-key' },
    })
    expect(screen.queryByTestId('prime-provider-key-input-xai')).not.toBeInTheDocument()
    expect(trackPrimeProviderSignIn).toHaveBeenCalledWith('xai', 'api_key', 'success')
  })

  it('opens the DeepSeek key page instead of copying a command', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    fireEvent.click(await screen.findByTestId('prime-provider-sign-in-deepseek'))

    expect(openExternalUrl).toHaveBeenCalledWith('https://platform.deepseek.com/api_keys')
    expect(await screen.findByTestId('prime-provider-key-input-deepseek')).toBeInTheDocument()
    expect(writeClipboardText).not.toHaveBeenCalled()
  })

  it('labels xAI as an API key, the only way Prime connects it', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    expect(await screen.findByTestId('prime-provider-sign-in-xai')).toHaveTextContent('Add key')
  })

  it('lists each provider with how it is connected', async () => {
    state.providers = [
      { name: 'anthropic', authKind: 'oauth', expiresAt: 9e12, expired: false },
      { name: 'opencode', authKind: 'api_key', expired: false },
    ]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      // Connected + always-show placeholders (prime-inference, xai, deepseek, nous-portal).
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

  it('offers Reconnect for expired Anthropic OAuth the same way as Grok', async () => {
    state.providers = [{ name: 'anthropic', authKind: 'oauth', expiresAt: 1, expired: true }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-expired')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-provider-sign-in-anthropic')).toHaveTextContent('Reconnect')
  })

  it('keeps DeepSeek as Add key, not Reconnect', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-deepseek')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prime-provider-sign-in-deepseek')).toHaveTextContent('Add key')
    expect(screen.getByTestId('prime-provider-sign-in-deepseek')).not.toHaveTextContent('Reconnect')
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
    expect(screen.getByTestId('prime-provider-sign-in-prime-inference')).toBeInTheDocument()
    expect(screen.getByText('One API key. Claude, Grok, DeepSeek, Qwen, and more.')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-provider-status-empty')).not.toBeInTheDocument()
  })

  it('copies the Prime Inference key command', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-sign-in-prime-inference')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('prime-provider-sign-in-prime-inference'))
    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith('prime-agent --provider prime-inference')
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
