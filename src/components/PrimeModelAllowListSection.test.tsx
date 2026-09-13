import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeModelAllowListSection } from './PrimeModelAllowListSection'
import { resetPrimeModelCatalog } from '../lib/primeModelCatalog'
import { createTranslator } from '../lib/i18n'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  models: [] as unknown[],
  allowList: [] as string[],
  failList: false,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'get_available_prime_models') {
      return invoked.failList
        ? Promise.reject(new Error('no daemon'))
        : Promise.resolve(invoked.models)
    }
    if (cmd === 'get_prime_model_allow_list') return Promise.resolve(invoked.allowList)
    return Promise.resolve(null)
  },
}))

const tracked = vi.hoisted(() => ({ changes: [] as Array<[number, number]> }))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeModelAllowListChanged: (selected: number, available: number) =>
    tracked.changes.push([selected, available]),
}))

const MODELS = [
  { id: 'grok-4.5', name: 'Grok 4.5', provider: 'xai' },
  { id: 'claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' },
  { id: 'hy3-free', name: 'HY3 Free', provider: 'opencode' },
]

const t = createTranslator('en')

function saved() {
  return invoked.calls
    .filter((call) => call.cmd === 'set_prime_model_allow_list')
    .map((call) => call.args?.models as string[])
}

beforeEach(() => {
  invoked.calls = []
  invoked.models = MODELS
  invoked.allowList = []
  invoked.failList = false
  tracked.changes = []
  resetPrimeModelCatalog()
})

async function renderSection() {
  render(<PrimeModelAllowListSection t={t} />)
  await waitFor(() => expect(screen.getByTestId('model-allow-list-filter')).toBeInTheDocument())
}

describe('PrimeModelAllowListSection (#45)', () => {
  /**
   * 501 models is the complaint the feature exists for, so the editor must
   * not itself be a wall of 501 checkboxes. Uncurated, it shows providers.
   */
  it('starts on provider names rather than the whole catalog', async () => {
    await renderSection()
    expect(screen.getByTestId('model-allow-list-uncurated')).toBeInTheDocument()
    expect(screen.getByTestId('model-allow-list-provider-xai')).toBeInTheDocument()
    expect(screen.queryByText('Grok 4.5')).not.toBeInTheDocument()
  })

  it('opens one provider and adds a model to the shortlist', async () => {
    await renderSection()
    fireEvent.click(screen.getByTestId('model-allow-list-provider-xai'))
    fireEvent.click(await screen.findByTestId('model-allow-list-item-xai/grok-4.5'))
    await waitFor(() => expect(saved()).toEqual([['xai/grok-4.5']]))
  })

  it('lists the curated models without needing a search', async () => {
    invoked.allowList = ['xai/grok-4.5']
    await renderSection()
    expect(await screen.findByText('Grok 4.5')).toBeInTheDocument()
    expect(screen.queryByText('HY3 Free')).not.toBeInTheDocument()
  })

  it('finds a model by search and adds it to the list', async () => {
    await renderSection()
    fireEvent.change(screen.getByTestId('model-allow-list-filter'), { target: { value: 'grok' } })

    const row = await screen.findByTestId('model-allow-list-item-xai/grok-4.5')
    fireEvent.click(row)

    await waitFor(() => expect(saved()).toEqual([['xai/grok-4.5']]))
    expect(tracked.changes).toEqual([[1, 3]])
  })

  it('reloads after Nous models land in the catalog', async () => {
    await renderSection()
    invoked.models = [
      ...MODELS,
      { id: 'hermes-4-405b', name: 'Hermes 4 405B', provider: 'nous-portal' },
    ]
    resetPrimeModelCatalog()
    expect(await screen.findByTestId('model-allow-list-provider-nous-portal')).toBeInTheDocument()
  })

  it('removes a model from the list when it is unticked', async () => {
    invoked.allowList = ['xai/grok-4.5', 'opencode/hy3-free']
    await renderSection()

    fireEvent.click(await screen.findByTestId('model-allow-list-item-xai/grok-4.5'))
    await waitFor(() => expect(saved()).toEqual([['opencode/hy3-free']]))
  })

  /** Curation must be reversible from the screen that created it. */
  it('clears the whole list back to the uncurated catalog', async () => {
    invoked.allowList = ['xai/grok-4.5']
    await renderSection()

    fireEvent.click(await screen.findByTestId('model-allow-list-clear'))
    await waitFor(() => expect(saved()).toEqual([[]]))
    expect(await screen.findByTestId('model-allow-list-uncurated')).toBeInTheDocument()
  })

  /** Not an error — it also covers "Prime is not installed on this machine". */
  it('says the catalog is empty rather than showing a broken editor', async () => {
    invoked.failList = true
    render(<PrimeModelAllowListSection t={t} />)
    expect(await screen.findByTestId('model-allow-list-empty')).toBeInTheDocument()
  })

  it('reports a search that matches nothing instead of rendering silence', async () => {
    await renderSection()
    fireEvent.change(screen.getByTestId('model-allow-list-filter'), { target: { value: 'zzz' } })
    expect(await screen.findByTestId('model-allow-list-no-matches')).toBeInTheDocument()
  })
})
