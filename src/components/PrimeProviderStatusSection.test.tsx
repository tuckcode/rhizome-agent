import { render, screen, waitFor } from '@testing-library/react'
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

const t = createTranslator('en')

beforeEach(() => {
  state.providers = []
  state.fail = false
})

describe('PrimeProviderStatusSection', () => {
  it('lists each provider with how it is connected', async () => {
    state.providers = [
      { name: 'anthropic', authKind: 'oauth', expiresAt: 9e12, expired: false },
      { name: 'opencode', authKind: 'api_key', expired: false },
    ]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getAllByTestId('prime-provider-row')).toHaveLength(2)
    })
    expect(screen.getByText('anthropic')).toBeInTheDocument()
    expect(screen.getByText('OAuth')).toBeInTheDocument()
    expect(screen.getByText('API key')).toBeInTheDocument()
  })

  // An expired token fails every turn while still looking connected — the
  // exact ambiguity this section exists to end.
  it('flags an expired token', async () => {
    state.providers = [{ name: 'xai', authKind: 'oauth', expiresAt: 1, expired: true }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-expired')).toBeInTheDocument()
    })
  })

  it('does not flag an API key as expired', async () => {
    state.providers = [{ name: 'opencode', authKind: 'api_key', expired: false }]
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-row')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('prime-provider-expired')).not.toBeInTheDocument()
  })

  it('says so plainly when nothing is connected', async () => {
    state.providers = []
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-status-empty')).toBeInTheDocument()
    })
  })

  // The engine may not be installed at all; that is an empty list, not a crash.
  it('degrades to empty when the check fails', async () => {
    state.fail = true
    render(<PrimeProviderStatusSection t={t} />)
    await waitFor(() => {
      expect(screen.getByTestId('prime-provider-status-empty')).toBeInTheDocument()
    })
  })
})
