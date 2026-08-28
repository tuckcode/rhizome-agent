import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeModelPicker } from './PrimeModelPicker'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  models: [] as unknown[],
  levels: ['off', 'low', 'high'] as string[],
  fail: '',
  connected: [] as string[],
  allowList: [] as string[],
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'set_prime_model' && invoked.fail) return Promise.reject(new Error(invoked.fail))
    if (cmd === 'get_available_prime_models') return Promise.resolve(invoked.models)
    if (cmd === 'get_prime_thinking_levels') return Promise.resolve(invoked.levels)
    if (cmd === 'get_connected_providers') return Promise.resolve(invoked.connected)
    if (cmd === 'get_prime_model_allow_list') return Promise.resolve(invoked.allowList)
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
  invoked.allowList = []
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

describe('PrimeModelPicker — curated allow-list (#45)', () => {
  async function openPicker(label?: string) {
    render(<PrimeModelPicker vaultPath="/v" label={label} />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    await waitFor(() => expect(screen.getByTestId('prime-model-filter')).toBeInTheDocument())
  }

  it('shows only the curated models, with the rest behind a disclosure', async () => {
    invoked.allowList = ['xai/grok-4.5']
    await openPicker()

    await waitFor(() => expect(screen.getByTestId('prime-models-hidden')).toBeInTheDocument())
    expect(screen.getByText('Grok 4.5')).toBeInTheDocument()
    expect(screen.queryByText('Claude Fable 5')).not.toBeInTheDocument()

    // Separated, not gone — "why can't I find X?" stays answerable.
    fireEvent.click(screen.getByTestId('prime-models-hidden-toggle'))
    await waitFor(() => expect(screen.getByText('Claude Fable 5')).toBeInTheDocument())
  })

  it('still switches to a model reached through the disclosure', async () => {
    invoked.allowList = ['xai/grok-4.5']
    await openPicker()
    fireEvent.click(await screen.findByTestId('prime-models-hidden-toggle'))
    fireEvent.click(await screen.findByText('Claude Fable 5'))

    await waitFor(() => expect(cmds()).toContain('set_prime_model'))
    expect(tracked.providers).toContain('anthropic')
  })

  it('shows the whole catalog when nothing has been curated', async () => {
    invoked.allowList = []
    await openPicker()
    expect(screen.getByText('Grok 4.5')).toBeInTheDocument()
    expect(screen.getByText('Claude Fable 5')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-models-hidden')).not.toBeInTheDocument()
  })

  /** The list is Rhizome's, and losing it must not narrow the menu. */
  it('shows the whole catalog when the allow-list cannot be read', async () => {
    invoked.allowList = []
    await openPicker()
    expect(screen.getByText('Claude Fable 5')).toBeInTheDocument()
  })

  /** The chip's label names a model; the menu must contain it. */
  it('keeps the running model listed even when it was never curated', async () => {
    invoked.models = [...MODELS, { id: 'hy3-free', name: 'HY3 Free', provider: 'opencode' }]
    invoked.allowList = ['xai/grok-4.5']
    await openPicker('Claude Fable 5')

    await waitFor(() => expect(screen.getByTestId('prime-models-hidden')).toBeInTheDocument())
    // Twice: once on the chip, once as a menu entry alongside the curated
    // model — and not behind the disclosure.
    expect(screen.getAllByText('Claude Fable 5')).toHaveLength(2)
    expect(screen.getByTestId('prime-models-hidden')).not.toHaveTextContent('Claude Fable 5')
    expect(screen.queryByText('HY3 Free')).not.toBeInTheDocument()
  })

  it('reaches a hidden model through the filter box in one step', async () => {
    invoked.allowList = ['xai/grok-4.5']
    await openPicker()
    fireEvent.change(screen.getByTestId('prime-model-filter'), { target: { value: 'fable' } })

    await waitFor(() => expect(screen.getByTestId('prime-models-hidden')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('prime-models-hidden-toggle'))
    await waitFor(() => expect(screen.getByText('Claude Fable 5')).toBeInTheDocument())
  })
})

describe('PrimeModelPicker — allow-list freshness (#45)', () => {
  function open() {
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
  }

  /**
   * The list is edited in Settings, which is a different surface from this
   * menu. Caching it the way the catalog is cached leaves the menu showing a
   * shortlist the user has already changed — found by opening the app, not by
   * a test.
   */
  it('re-reads the allow-list every time it opens', async () => {
    render(<PrimeModelPicker vaultPath="/v" />)
    open()
    await waitFor(() => expect(cmds()).toContain('get_prime_model_allow_list'))
    expect(screen.queryByTestId('prime-models-hidden')).not.toBeInTheDocument()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    invoked.allowList = ['xai/grok-4.5']
    open()

    await waitFor(() => expect(screen.getByTestId('prime-models-hidden')).toBeInTheDocument())
  })

  /** The catalog is a daemon round-trip, so it stays cached. */
  it('does not re-fetch the model catalog on a second open', async () => {
    render(<PrimeModelPicker vaultPath="/v" />)
    open()
    await waitFor(() => expect(cmds()).toContain('get_available_prime_models'))

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    open()
    await waitFor(() => expect(cmds()).toContain('get_prime_model_allow_list'))

    expect(cmds().filter((cmd) => cmd === 'get_available_prime_models')).toHaveLength(1)
  })
})
