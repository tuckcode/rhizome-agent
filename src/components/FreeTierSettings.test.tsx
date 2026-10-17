import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { FreeTierSettings } from './FreeTierSettings'
import type { FreeTierOverview, FreeTierProviderRow } from '../utils/freeTierSettings'

const { getOverviewMock, saveSettingsMock, saveKeyMock, deleteKeyMock, trackEventMock } = vi.hoisted(() => ({
  getOverviewMock: vi.fn(),
  saveSettingsMock: vi.fn(),
  saveKeyMock: vi.fn(),
  deleteKeyMock: vi.fn(),
  trackEventMock: vi.fn(),
}))

vi.mock('../utils/freeTierSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/freeTierSettings')>()),
  getFreeTierOverview: getOverviewMock,
  saveFreeTierSettings: saveSettingsMock,
  saveFreeTierSecret: saveKeyMock,
  deleteFreeTierSecret: deleteKeyMock,
}))

vi.mock('../lib/telemetry', () => ({ trackEvent: trackEventMock }))

const CLOUDFLARE_WARNING = 'A card on file with Cloudflare could be billed.'

function row(patch: Partial<FreeTierProviderRow> & Pick<FreeTierProviderRow, 'id' | 'name'>): FreeTierProviderRow {
  return {
    defaultOn: true,
    enabled: true,
    hasKey: false,
    needsAccountId: false,
    hasAccountId: false,
    keyError: null,
    billingWarning: null,
    hardStop: false,
    ...patch,
  }
}

function overview(patch: Partial<FreeTierOverview> = {}): FreeTierOverview {
  return {
    providers: [
      row({ id: 'groq', name: 'Groq', hardStop: true, hasKey: true }),
      row({ id: 'mistral', name: 'Mistral' }),
      row({
        id: 'cloudflare-ai',
        name: 'Cloudflare Workers AI',
        defaultOn: false,
        enabled: false,
        needsAccountId: true,
        billingWarning: CLOUDFLARE_WARNING,
      }),
    ],
    strict: false,
    routeOrder: ['groq'],
    usable: true,
    keychainError: null,
    ownEndpoint: null,
    ownEndpointModel: null,
    endpointChoices: [
      { id: 'lm_studio-pc', name: 'LM Studio on PC', models: ['qwen', 'llama'] },
      { id: 'ollama-home', name: 'Ollama', models: ['llama3.2'] },
    ],
    ...patch,
  }
}

async function renderLoaded(view = overview()) {
  getOverviewMock.mockResolvedValue(view)
  render(<FreeTierSettings />)
  await screen.findByTestId('free-tier-row-groq')
}

describe('FreeTierSettings', () => {
  beforeEach(() => {
    getOverviewMock.mockReset()
    saveSettingsMock.mockReset().mockImplementation(async () => overview())
    saveKeyMock.mockReset().mockResolvedValue(undefined)
    deleteKeyMock.mockReset().mockResolvedValue(undefined)
    trackEventMock.mockReset()
  })

  it('lists every provider with its switch and key state', async () => {
    await renderLoaded()

    const groq = screen.getByTestId('free-tier-row-groq')
    expect(within(groq).getByText('Groq')).toBeInTheDocument()
    expect(within(groq).getByText('Key saved')).toBeInTheDocument()
    expect(within(groq).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(within(screen.getByTestId('free-tier-row-mistral')).getByText('No key')).toBeInTheDocument()
    expect(within(screen.getByTestId('free-tier-row-cloudflare-ai')).getByText('Opt-in')).toBeInTheDocument()
  })

  it('turns a default-on provider off by saving it as disabled', async () => {
    await renderLoaded()

    fireEvent.click(within(screen.getByTestId('free-tier-row-mistral')).getByRole('switch'))

    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith({ disabled: ['mistral'], optIn: [], strict: false, ownEndpoint: null, ownEndpointModel: null }),
    )
    expect(trackEventMock).toHaveBeenCalledWith('free_tier_provider_toggled', {
      provider_id: 'mistral',
      enabled: 0,
    })
  })

  it('shows the Cloudflare billing warning before it opts in', async () => {
    await renderLoaded()

    fireEvent.click(within(screen.getByTestId('free-tier-row-cloudflare-ai')).getByRole('switch'))

    expect(await screen.findByText(CLOUDFLARE_WARNING)).toBeInTheDocument()
    expect(saveSettingsMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))
    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith({ disabled: [], optIn: ['cloudflare-ai'], strict: false, ownEndpoint: null, ownEndpointModel: null }),
    )
  })

  it('leaves Cloudflare off when the warning is cancelled', async () => {
    await renderLoaded()

    fireEvent.click(within(screen.getByTestId('free-tier-row-cloudflare-ai')).getByRole('switch'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(saveSettingsMock).not.toHaveBeenCalled()
  })

  it('saves strict mode', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByRole('switch', { name: 'Strict mode' }))

    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith({ disabled: [], optIn: [], strict: true, ownEndpoint: null, ownEndpointModel: null }),
    )
  })

  it('shows the fallback order read-only', async () => {
    await renderLoaded(overview({ routeOrder: ['groq', 'mistral'] }))

    const order = screen.getByTestId('free-tier-route-order')
    expect(within(order).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Groq', 'Mistral'])
    expect(within(order).queryByRole('button')).toBeNull()
  })

  it('saves a key and a Cloudflare account id through the keychain command', async () => {
    await renderLoaded()

    const mistral = screen.getByTestId('free-tier-row-mistral')
    fireEvent.change(within(mistral).getByLabelText('Mistral API key'), { target: { value: ' msk ' } })
    fireEvent.click(within(mistral).getByRole('button', { name: 'Save key' }))
    await waitFor(() => expect(saveKeyMock).toHaveBeenCalledWith('mistral', 'msk'))

    const cloudflare = screen.getByTestId('free-tier-row-cloudflare-ai')
    fireEvent.change(within(cloudflare).getByLabelText('Cloudflare Workers AI account ID'), {
      target: { value: 'acct-1' },
    })
    fireEvent.click(within(cloudflare).getByRole('button', { name: 'Save account ID' }))
    await waitFor(() => expect(saveKeyMock).toHaveBeenCalledWith('cloudflare-ai:account', 'acct-1'))
    expect(getOverviewMock).toHaveBeenCalledTimes(3)
  })

  it('says when nothing can route yet', async () => {
    await renderLoaded(overview({ usable: false, routeOrder: [] }))

    expect(screen.getByText('Add a key to at least one provider to use Free tier (auto).')).toBeInTheDocument()
  })

  it('shows a locked keychain instead of the no-key line', async () => {
    await renderLoaded(overview({
      usable: true,
      keychainError: 'The keychain is locked or access was denied.',
    }))

    expect(screen.getByTestId('free-tier-keychain-error')).toHaveTextContent(
      'The keychain is locked or access was denied.',
    )
    expect(screen.queryByText('Add a key to at least one provider to use Free tier (auto).')).not.toBeInTheDocument()
  })

  it('picks the own endpoint from a dropdown of saved providers', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByRole('combobox', { name: 'Own endpoint' }))
    expect(screen.getByRole('option', { name: 'None' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'LM Studio on PC' }))

    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith({
        disabled: [],
        optIn: [],
        strict: false,
        ownEndpoint: 'lm_studio-pc',
        ownEndpointModel: null,
      }),
    )
  })

  it('clears the own endpoint with None', async () => {
    await renderLoaded(overview({ ownEndpoint: 'ollama-home' }))

    fireEvent.click(screen.getByRole('combobox', { name: 'Own endpoint' }))
    fireEvent.click(screen.getByRole('option', { name: 'None' }))

    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith({ disabled: [], optIn: [], strict: false, ownEndpoint: null, ownEndpointModel: null }),
    )
  })

  it('names the own endpoint in the fallback order', async () => {
    await renderLoaded(overview({ ownEndpoint: 'lm_studio-pc', routeOrder: ['groq', 'custom'] }))

    const order = screen.getByTestId('free-tier-route-order')
    expect(within(order).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Groq',
      'LM Studio on PC',
    ])
  })

  it('explains where own endpoints come from when none is saved', async () => {
    await renderLoaded(overview({ endpointChoices: [] }))

    expect(
      screen.getByText('Add a local or OpenAI-compatible provider above to pick it here.'),
    ).toBeInTheDocument()
  })

  it('allows one save at a time, so a rapid second toggle cannot undo the first', async () => {
    let finish: (view: FreeTierOverview) => void = () => undefined
    saveSettingsMock.mockImplementation(
      () => new Promise<FreeTierOverview>((resolve) => { finish = resolve }),
    )
    await renderLoaded()

    const mistral = within(screen.getByTestId('free-tier-row-mistral')).getByRole('switch')
    fireEvent.click(mistral)
    fireEvent.click(screen.getByRole('switch', { name: 'Strict mode' }))

    expect(saveSettingsMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Strict mode' })).toBeDisabled())
    finish(overview())
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Strict mode' })).toBeEnabled())
  })

  it('shows a failed save and sends no telemetry', async () => {
    saveSettingsMock.mockRejectedValue(new Error('disk full'))
    await renderLoaded()

    fireEvent.click(within(screen.getByTestId('free-tier-row-mistral')).getByRole('switch'))

    expect(await screen.findByRole('alert')).toHaveTextContent('disk full')
    expect(trackEventMock).not.toHaveBeenCalled()
  })

  it('keeps the typed key when the keychain save fails', async () => {
    saveKeyMock.mockRejectedValue(new Error('keychain refused'))
    await renderLoaded()

    const mistral = screen.getByTestId('free-tier-row-mistral')
    const input = within(mistral).getByLabelText('Mistral API key')
    fireEvent.change(input, { target: { value: 'msk' } })
    fireEvent.click(within(mistral).getByRole('button', { name: 'Save key' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('keychain refused')
    expect(input).toHaveValue('msk')
  })

  it('shows a keychain error in place of No key', async () => {
    await renderLoaded(
      overview({ providers: [row({ id: 'groq', name: 'Groq', keyError: 'The keychain is locked.' })] }),
    )

    const groq = screen.getByTestId('free-tier-row-groq')
    expect(within(groq).getByText('Keychain error')).toBeInTheDocument()
    expect(within(groq).queryByText('No key')).toBeNull()
    expect(within(groq).getByRole('alert')).toHaveTextContent('The keychain is locked.')
  })

  it('removes a saved key and a Cloudflare account id', async () => {
    await renderLoaded(
      overview({
        providers: [
          row({ id: 'groq', name: 'Groq', hasKey: true }),
          row({ id: 'cloudflare-ai', name: 'Cloudflare Workers AI', needsAccountId: true, hasKey: true, hasAccountId: true }),
        ],
      }),
    )

    const cloudflare = screen.getByTestId('free-tier-row-cloudflare-ai')
    expect(within(cloudflare).getByText('Account ID saved')).toBeInTheDocument()
    fireEvent.click(within(cloudflare).getByRole('button', { name: 'Remove account ID' }))
    await waitFor(() => expect(deleteKeyMock).toHaveBeenCalledWith('cloudflare-ai:account'))
    await waitFor(() => expect(within(cloudflare).getByRole('button', { name: 'Remove key' })).toBeEnabled())
    fireEvent.click(within(cloudflare).getByRole('button', { name: 'Remove key' }))
    await waitFor(() => expect(deleteKeyMock).toHaveBeenCalledWith('cloudflare-ai'))
  })

  it('offers no remove button when nothing is saved', async () => {
    await renderLoaded()

    expect(within(screen.getByTestId('free-tier-row-mistral')).queryByRole('button', { name: 'Remove key' })).toBeNull()
    expect(within(screen.getByTestId('free-tier-row-cloudflare-ai')).getByText('No account ID')).toBeInTheDocument()
  })

  it('picks the own endpoint model when the provider has several', async () => {
    await renderLoaded(overview({ ownEndpoint: 'lm_studio-pc' }))

    fireEvent.click(screen.getByRole('combobox', { name: 'Own endpoint model' }))
    fireEvent.click(screen.getByRole('option', { name: 'llama' }))

    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith({
        disabled: [],
        optIn: [],
        strict: false,
        ownEndpoint: 'lm_studio-pc',
        ownEndpointModel: 'llama',
      }),
    )
  })
})
