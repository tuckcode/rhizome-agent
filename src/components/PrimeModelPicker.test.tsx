import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeModelPicker } from './PrimeModelPicker'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  models: [] as unknown[],
  levels: ['off', 'low', 'high'] as string[],
  fail: '',
  connected: [] as string[],
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'set_prime_model' && invoked.fail) return Promise.reject(new Error(invoked.fail))
    if (cmd === 'get_available_prime_models') return Promise.resolve(invoked.models)
    if (cmd === 'get_prime_thinking_levels') return Promise.resolve(invoked.levels)
    if (cmd === 'get_connected_providers') return Promise.resolve(invoked.connected)
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({ providers: [] as string[], levels: [] as string[] }))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeModelChanged: (provider: string) => tracked.providers.push(provider),
  trackPrimeThinkingLevelChanged: (level: string) => tracked.levels.push(level),
}))

const MODELS = [
  { id: 'grok-4.5', name: 'Grok 4.5', provider: 'xai' },
  { id: 'claude-fable-5', name: 'Claude Fable 5', provider: 'anthropic' },
]

function cmds() {
  return invoked.calls.map((call) => call.cmd)
}

beforeEach(() => {
  invoked.calls = []
  invoked.models = MODELS
  invoked.connected = []
  invoked.fail = ''
  tracked.providers = []
})

describe('PrimeModelPicker', () => {
  /** ~78 models, and most sessions never change one. */
  it('does not fetch the model list until the menu is opened', async () => {
    render(<PrimeModelPicker label="Grok 4.5" />)

    expect(cmds()).not.toContain('get_available_prime_models')

    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, ctrlKey: false, button: 0 }),
    )

    await waitFor(() => expect(cmds()).toContain('get_available_prime_models'))
  })

  it('starts the Prime host before listing models', async () => {
    render(<PrimeModelPicker label={null} vaultPath="/Users/dtc/Documents/Rhizome Vault" />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    await waitFor(() => {
      expect(cmds()[0]).toBe('ensure_prime_session_host')
      expect(invoked.calls[0]?.args).toEqual({ vaultPath: '/Users/dtc/Documents/Rhizome Vault' })
    })
    expect(cmds()).toContain('get_available_prime_models')
  })

  it('shows the current model on the chip', () => {
    render(<PrimeModelPicker label="Grok 4.5" />)

    expect(screen.getByTestId('prime-model-chip')).toHaveTextContent('Grok 4.5')
  })

  /** A fresh host reports no model; the chip must still be usable. */
  it('falls back to a generic label when no model is known', () => {
    render(<PrimeModelPicker label={null} />)

    expect(screen.getByTestId('prime-model-chip')).toHaveTextContent('Model')
  })

  it('cannot be opened while a turn is running', () => {
    render(<PrimeModelPicker label="Grok 4.5" disabled />)

    expect(screen.getByTestId('prime-model-chip')).toBeDisabled()
  })

  it('sends both provider and modelId, which set_model requires', async () => {
    render(<PrimeModelPicker label="Grok 4.5" />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    const item = await screen.findByText('Claude Fable 5')
    fireEvent.click(item)

    await waitFor(() => {
      const call = invoked.calls.find((c) => c.cmd === 'set_prime_model')
      expect(call?.args).toEqual({ provider: 'anthropic', modelId: 'claude-fable-5' })
    })
    expect(tracked.providers).toEqual(['anthropic'])
  })

  it('offers Prime\'s thinking levels and sets the one picked (#9)', async () => {
    render(<PrimeModelPicker variant="strip" label="Grok 4.5" thinkingLevel="off" />)

    // Radix opens on pointerdown, not click.
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-thinking-control'),
      new PointerEvent('pointerdown', { bubbles: true, ctrlKey: false, button: 0 }),
    )
    await waitFor(() => expect(cmds()).toContain('get_prime_thinking_levels'))

    const high = await screen.findByTestId('prime-thinking-level-high')
    fireEvent.click(high)
    await waitFor(() => expect(cmds()).toContain('set_prime_thinking_level'))
    expect(tracked.levels).toContain('high')
  })

  it('takes the level list from the host rather than a hardcoded copy', async () => {
    // #9: no hardcoded model or level anywhere in the frontend. If this ever
    // renders levels without asking the host, the list has been duplicated.
    render(<PrimeModelPicker variant="strip" label="Grok 4.5" />)
    expect(screen.queryByTestId('prime-thinking-levels')).not.toBeInTheDocument()

    fireEvent.pointerDown(
      screen.getByTestId('prime-model-thinking-control'),
      new PointerEvent('pointerdown', { bubbles: true, ctrlKey: false, button: 0 }),
    )
    await waitFor(() => expect(cmds()).toContain('get_prime_thinking_levels'))
  })
})

describe('PrimeModelPicker — filtering and connection state (#45)', () => {
  async function openPicker() {
    render(<PrimeModelPicker vaultPath="/v" />)
    // Radix opens on pointerdown, not click.
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    await waitFor(() => expect(screen.getByTestId('prime-model-filter')).toBeInTheDocument())
  }

  it('narrows the list as you type', async () => {
    await openPicker()
    expect(screen.getByText('Grok 4.5')).toBeInTheDocument()
    expect(screen.getByText('Claude Fable 5')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('prime-model-filter'), { target: { value: 'grok' } })
    await waitFor(() => expect(screen.queryByText('Claude Fable 5')).not.toBeInTheDocument())
    expect(screen.getByText('Grok 4.5')).toBeInTheDocument()
  })

  it('separates models whose provider has no credentials', async () => {
    invoked.connected = ['xai']
    await openPicker()
    await waitFor(() => {
      expect(screen.getByTestId('prime-models-unavailable')).toBeInTheDocument()
    })
    // Usable model listed; unusable one is behind the toggle, not gone.
    expect(screen.getByText('Grok 4.5')).toBeInTheDocument()
    expect(screen.queryByText('Claude Fable 5')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('prime-models-unavailable-toggle'))
    await waitFor(() => expect(screen.getByText('Claude Fable 5')).toBeInTheDocument())
  })

  // Credential detection is best-effort; an unknown answer must not grey out
  // a model that works.
  it('shows everything when credentials cannot be determined', async () => {
    invoked.connected = []
    await openPicker()
    expect(screen.getByText('Grok 4.5')).toBeInTheDocument()
    expect(screen.getByText('Claude Fable 5')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-models-unavailable')).not.toBeInTheDocument()
  })
})
