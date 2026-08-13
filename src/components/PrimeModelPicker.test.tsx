import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeModelPicker } from './PrimeModelPicker'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  models: [] as unknown[],
  fail: '',
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'set_prime_model' && invoked.fail) return Promise.reject(new Error(invoked.fail))
    if (cmd === 'get_available_prime_models') return Promise.resolve(invoked.models)
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({ providers: [] as string[] }))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeModelChanged: (provider: string) => tracked.providers.push(provider),
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
})
