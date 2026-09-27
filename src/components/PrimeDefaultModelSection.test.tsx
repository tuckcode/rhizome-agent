import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeDefaultModelSection } from './PrimeDefaultModelSection'
import { resetPrimeModelCatalog } from '../lib/primeModelCatalog'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  models: [] as unknown[],
  status: { modelProvider: 'xai', modelId: 'grok-4.5', modelName: 'Grok 4.5' } as Record<string, unknown>,
  failSet: '',
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'get_available_prime_models') return Promise.resolve(invoked.models)
    if (cmd === 'get_prime_session_host_status') return Promise.resolve(invoked.status)
    if (cmd === 'set_prime_model' && invoked.failSet) return Promise.reject(new Error(invoked.failSet))
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({
  modelIds: [] as string[],
}))

vi.mock('../lib/productAnalytics', () => ({
  trackPrimeDefaultModelChanged: (modelId: string) => tracked.modelIds.push(modelId),
}))

const MODELS = [
  { id: 'grok-4.5', name: 'Grok 4.5', provider: 'xai' },
  { id: 'claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' },
  { id: 'big-pickle', name: 'Big Pickle', provider: 'opencode' },
]

beforeEach(() => {
  invoked.calls = []
  invoked.models = MODELS
  invoked.status = { modelProvider: 'xai', modelId: 'grok-4.5', modelName: 'Grok 4.5' }
  invoked.failSet = ''
  tracked.modelIds = []
  resetPrimeModelCatalog()
})

async function renderSection(vaultPath?: string) {
  render(<PrimeDefaultModelSection vaultPath={vaultPath} />)
  await waitFor(() => expect(screen.getByTestId('prime-default-model-select')).toBeInTheDocument())
}

describe('PrimeDefaultModelSection (#45)', () => {
  it('shows the model the host is using', async () => {
    await renderSection()
    expect(screen.getByTestId('prime-default-model-select')).toHaveTextContent('Grok 4.5')
  })

  it('switches the host model with set_prime_model and records the model id', async () => {
    await renderSection('/vault')
    fireEvent.click(screen.getByTestId('prime-default-model-select'))
    fireEvent.click(await screen.findByRole('option', { name: /Claude Opus 5/ }))

    await waitFor(() => {
      expect(invoked.calls).toContainEqual({
        cmd: 'set_prime_model',
        args: { provider: 'anthropic', modelId: 'claude-opus-5' },
      })
    })
    expect(invoked.calls.some((call) => call.cmd === 'ensure_prime_session_host')).toBe(true)
    expect(tracked.modelIds).toEqual(['claude-opus-5'])
  })

  it('keeps the previous model when the switch fails', async () => {
    invoked.failSet = 'host down'
    await renderSection()
    fireEvent.click(screen.getByTestId('prime-default-model-select'))
    fireEvent.click(await screen.findByRole('option', { name: /Claude Opus 5/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('host down')
    expect(screen.getByTestId('prime-default-model-select')).toHaveTextContent('Grok 4.5')
    expect(tracked.modelIds).toEqual([])
  })

  it('narrows the menu by the name filter box', async () => {
    await renderSection()
    fireEvent.change(screen.getByTestId('prime-default-model-filter'), { target: { value: 'pickle' } })
    fireEvent.click(screen.getByTestId('prime-default-model-select'))

    expect(await screen.findByRole('option', { name: /Big Pickle/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Claude Opus 5/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Grok 4.5/ })).toBeInTheDocument()
  })

  it('says the catalog is empty rather than offering a blank menu', async () => {
    invoked.models = []
    render(<PrimeDefaultModelSection />)
    expect(await screen.findByTestId('prime-default-model-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-default-model-select')).not.toBeInTheDocument()
  })
})
