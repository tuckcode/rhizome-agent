import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeModelPicker } from './PrimeModelPicker'
import { resetPrimeModelCatalog } from '../lib/primeModelCatalog'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  models: [] as unknown[],
  levels: ['off', 'low', 'high'] as string[],
  fail: '',
  failList: '',
  connected: [] as string[],
  allowList: [] as string[],
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'set_prime_model' && invoked.fail) return Promise.reject(new Error(invoked.fail))
    if (cmd === 'get_available_prime_models') {
      if (invoked.failList) return Promise.reject(new Error(invoked.failList))
      return Promise.resolve(invoked.models)
    }
    if (cmd === 'get_prime_thinking_levels') return Promise.resolve(invoked.levels)
    if (cmd === 'get_connected_providers') return Promise.resolve(invoked.connected)
    if (cmd === 'get_prime_model_allow_list') return Promise.resolve(invoked.allowList)
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({
  providers: [] as string[],
  levels: [] as string[],
  freeOnly: [] as boolean[],
}))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeModelAllowListChanged: vi.fn(),
  trackPrimeModelChanged: (provider: string) => tracked.providers.push(provider),
  trackPrimeThinkingLevelChanged: (level: string) => tracked.levels.push(level),
  trackPrimeModelsFreeOnly: (on: boolean) => tracked.freeOnly.push(on),
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
  invoked.failList = ''
  tracked.providers = []
  tracked.freeOnly = []
  localStorage.clear()
  resetPrimeModelCatalog()
})

describe('PrimeModelPicker', () => {
  it('loads the catalog in the background so opening the menu is not a wait', async () => {
    render(<PrimeModelPicker label="Grok 4.5" hostReady />)

    await waitFor(() => expect(cmds()).toContain('get_available_prime_models'))

    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, ctrlKey: false, button: 0 }),
    )

    await waitFor(() => expect(screen.getByTestId('prime-model-filter')).toBeInTheDocument())
    expect(cmds().filter((cmd) => cmd === 'get_available_prime_models')).toHaveLength(1)
  })

  it('lists models without a host ensure once the host is already live', async () => {
    render(
      <PrimeModelPicker
        label={null}
        vaultPath="/Users/jdoe/Documents/Rhizome Vault"
        hostReady
      />,
    )

    await waitFor(() => expect(cmds()).toContain('get_available_prime_models'))
    expect(cmds()).not.toContain('ensure_prime_session_host')
  })

  it('lists models without starting Prime when Chat has no vault', async () => {
    render(<PrimeModelPicker label={null} />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    await waitFor(() => expect(cmds()).toContain('get_available_prime_models'))
    expect(cmds()).not.toContain('ensure_prime_session_host')
  })

  it('starts the Prime host before listing when the menu opens without a live host', async () => {
    render(<PrimeModelPicker label={null} vaultPath="/Users/jdoe/Documents/Rhizome Vault" />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    await waitFor(() => {
      expect(cmds()[0]).toBe('ensure_prime_session_host')
      expect(invoked.calls[0]?.args).toEqual({ vaultPath: '/Users/jdoe/Documents/Rhizome Vault' })
    })
    expect(cmds()).toContain('get_available_prime_models')
  })

  it('does not keep a failed catalog so a later open can retry', async () => {
    invoked.failList = 'Prime session host is not running'
    render(<PrimeModelPicker vaultPath="/v" />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Prime session host is not running'))

    invoked.failList = ''
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    await waitFor(() => expect(screen.getByTestId('prime-model-filter')).toBeInTheDocument())
    expect(screen.getByText('Grok 4.5')).toBeInTheDocument()
  })

  it('shows the current model on the chip', () => {
    render(<PrimeModelPicker label="Grok 4.5" />)

    expect(screen.getByTestId('prime-model-chip')).toHaveTextContent('Grok 4.5')
  })

  it('renders provider names in the accent so they scan in a long list', async () => {
    render(<PrimeModelPicker label="Grok 4.5" hostReady />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    const labels = await screen.findAllByTestId('prime-model-provider')
    expect(labels.map((label) => label.textContent)).toEqual(expect.arrayContaining(['xai', 'anthropic']))
    for (const label of labels) {
      expect(label).toHaveClass('text-primary')
      expect(label).not.toHaveClass('text-muted-foreground')
    }
  })

  it('lists Nous Portal models in the same picker when the catalog includes them', async () => {
    invoked.models = [
      ...MODELS,
      { id: 'hermes-4-405b', name: 'Hermes 4 405B', provider: 'nous-portal' },
    ]
    render(<PrimeModelPicker label="Grok 4.5" hostReady />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    expect(await screen.findByText('Hermes 4 405B')).toBeInTheDocument()
    const labels = screen.getAllByTestId('prime-model-provider')
    expect(labels.map((label) => label.textContent)).toContain('nous-portal')
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

  it('changes the model without starting Prime when Chat has no vault', async () => {
    render(<PrimeModelPicker label="Grok 4.5" />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-chip'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    fireEvent.click(await screen.findByText('Claude Fable 5'))

    await waitFor(() => {
      expect(cmds()).toContain('set_prime_model')
    })
    expect(cmds()).not.toContain('ensure_prime_session_host')
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

  it('offers X-High when the host lists that thinking level', async () => {
    invoked.levels = ['off', 'low', 'medium', 'high', 'xhigh']
    render(<PrimeModelPicker variant="strip" label="Grok 4.5" thinkingLevel="high" />)
    fireEvent.pointerDown(
      screen.getByTestId('prime-model-thinking-control'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('prime-thinking-level-xhigh')).toHaveTextContent('X-High')
    })
    expect(screen.getByTestId('prime-thinking-level-off')).toBeInTheDocument()
    expect(screen.getByTestId('prime-thinking-level-low')).toBeInTheDocument()
    expect(screen.getByTestId('prime-thinking-level-medium')).toBeInTheDocument()
    expect(screen.getByTestId('prime-thinking-level-high')).toBeInTheDocument()
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

  it('labels the quick filter as a name match, not a price', async () => {
    render(<PrimeModelPicker vaultPath="/v" />)
    open()
    const toggle = await screen.findByTestId('prime-models-free-only')
    expect(toggle).toHaveAttribute('aria-label', expect.stringMatching(/name filter/i))
    expect(toggle).toHaveAttribute('aria-label', expect.stringMatching(/not a price/i))
    expect(toggle).toHaveAttribute('aria-label', expect.stringMatching(/-free/))
  })

  it('hides paid models when Free only is on, and keeps the running model', async () => {
    invoked.models = [
      ...MODELS,
      { id: 'hy3-free', name: 'HY3 Free', provider: 'opencode' },
    ]
    render(<PrimeModelPicker label="Grok 4.5" vaultPath="/v" />)
    open()
    await waitFor(() => expect(screen.getByTestId('prime-models-free-only')).toBeInTheDocument())
    expect(screen.getByText('HY3 Free')).toBeInTheDocument()
    expect(screen.getByText('Claude Fable 5')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('prime-models-free-only'))
    await waitFor(() => expect(screen.queryByText('Claude Fable 5')).not.toBeInTheDocument())
    expect(screen.getByText('HY3 Free')).toBeInTheDocument()
    expect(screen.getAllByText('Grok 4.5')).toHaveLength(1)
    expect(tracked.freeOnly).toEqual([true])
  })

  it('edits the shortlist by provider and model without closing the picker', async () => {
    invoked.allowList = ['xai/grok-4.5']
    render(<PrimeModelPicker label="Grok 4.5" vaultPath="/v" />)
    open()
    await waitFor(() => expect(screen.getByTestId('prime-model-edit-toggle')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('prime-model-edit-toggle'))
    expect(screen.getByTestId('prime-model-edit-list')).toBeInTheDocument()
    expect(screen.getByTestId('prime-model-edit-provider-anthropic')).toBeInTheDocument()
    expect(screen.getByTestId('prime-model-edit-item-anthropic/claude-fable-5')).toHaveAttribute(
      'aria-checked',
      'false',
    )

    fireEvent.click(screen.getByTestId('prime-model-edit-item-anthropic/claude-fable-5'))
    await waitFor(() => {
      expect(invoked.calls).toContainEqual({
        cmd: 'set_prime_model_allow_list',
        args: { models: ['xai/grok-4.5', 'anthropic/claude-fable-5'] },
      })
    })
    expect(screen.getByTestId('prime-model-edit-toggle')).toHaveTextContent('Done')
  })

  it('provider checks apply beyond the current search result', async () => {
    invoked.models = [
      ...MODELS,
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic' },
    ]
    invoked.allowList = ['xai/grok-4.5']
    render(<PrimeModelPicker label="Grok 4.5" vaultPath="/v" />)
    open()
    await waitFor(() => expect(screen.getByTestId('prime-model-edit-toggle')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('prime-model-edit-toggle'))
    fireEvent.change(screen.getByTestId('prime-model-filter'), { target: { value: 'fable' } })
    fireEvent.click(screen.getByTestId('prime-model-edit-provider-anthropic'))

    await waitFor(() => {
      expect(invoked.calls).toContainEqual({
        cmd: 'set_prime_model_allow_list',
        args: {
          models: [
            'xai/grok-4.5',
            'anthropic/claude-fable-5',
            'anthropic/claude-sonnet-5',
          ],
        },
      })
    })
  })

  it('provider check-all toggles only that provider in the Free-only catalog', async () => {
    invoked.models = [
      { id: 'claude-opus', name: 'Claude Opus', provider: 'openrouter' },
      { id: 'gemini-flash:free', name: 'Gemini Flash', provider: 'openrouter' },
      { id: 'hy3-free', name: 'HY3 Free', provider: 'opencode' },
    ]
    invoked.allowList = ['opencode/hy3-free']
    render(<PrimeModelPicker label="HY3 Free" vaultPath="/v" />)
    open()
    await waitFor(() => expect(screen.getByTestId('prime-models-free-only')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('prime-models-free-only'))
    fireEvent.click(screen.getByTestId('prime-model-edit-toggle'))

    expect(screen.queryByTestId('prime-model-edit-item-openrouter/claude-opus')).not.toBeInTheDocument()
    expect(screen.getByTestId('prime-model-edit-item-openrouter/gemini-flash:free')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('prime-model-edit-provider-openrouter'))
    await waitFor(() => {
      const saved = invoked.calls.filter((call) => call.cmd === 'set_prime_model_allow_list').at(-1)
      expect(saved?.args?.models).toEqual(['opencode/hy3-free', 'openrouter/gemini-flash:free'])
    })
  })

  it('provider checkboxes describe the Free-only catalog, not the search hits', async () => {
    invoked.models = [
      ...MODELS,
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic' },
    ]
    invoked.allowList = ['xai/grok-4.5', 'anthropic/claude-fable-5']
    render(<PrimeModelPicker label="Grok 4.5" vaultPath="/v" />)
    open()
    await waitFor(() => expect(screen.getByTestId('prime-model-edit-toggle')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('prime-model-edit-toggle'))
    fireEvent.change(screen.getByTestId('prime-model-filter'), { target: { value: 'fable' } })

    expect(screen.getByTestId('prime-model-edit-provider-anthropic')).toHaveAttribute(
      'aria-checked',
      'mixed',
    )
  })

  it('gives the Edit list a wider menu than the picker', async () => {
    render(<PrimeModelPicker label="Grok 4.5" vaultPath="/v" />)
    open()
    await waitFor(() => expect(screen.getByTestId('prime-model-edit-toggle')).toBeInTheDocument())
    const menu = screen.getByTestId('prime-model-menu')
    expect(menu).toHaveClass('w-64')

    fireEvent.click(screen.getByTestId('prime-model-edit-toggle'))
    expect(screen.getByTestId('prime-model-menu')).toHaveClass('w-80')
    expect(screen.getByTestId('prime-model-edit-list')).toBeInTheDocument()
  })
})
