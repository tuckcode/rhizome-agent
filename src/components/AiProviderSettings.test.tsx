import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AiProviderSettings } from './AiProviderSettings'
import { createTranslator } from '../lib/i18n'
import { DEFAULT_MODEL_CAPABILITIES, type AiModelProvider } from '../lib/aiTargets'
import { PROVIDER_PRESETS, providerPresetById } from '../lib/providerPresets'

const { deleteApiKeyMock, saveApiKeyMock, testProviderMock } = vi.hoisted(() => ({
  deleteApiKeyMock: vi.fn(),
  saveApiKeyMock: vi.fn(),
  testProviderMock: vi.fn(),
}))

vi.mock('../utils/aiProviderSecrets', () => ({
  deleteAiModelProviderApiKey: deleteApiKeyMock,
  saveAiModelProviderApiKey: saveApiKeyMock,
  testAiModelProvider: testProviderMock,
}))

vi.mock('../utils/url', () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}))

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & {
  openExternalUrl: ReturnType<typeof vi.fn>
}

const t = createTranslator('en')

const provider: AiModelProvider = {
  id: 'openai-abc123',
  kind: 'open_ai',
  name: 'My OpenAI',
  base_url: 'https://api.openai.com/v1',
  api_key_storage: 'local_file',
  api_key_env_var: null,
  models: [{ id: 'gpt-4o', capabilities: DEFAULT_MODEL_CAPABILITIES }],
}

function renderProviders(onChange = vi.fn()) {
  render(
    <AiProviderSettings t={t} mode="api" providers={[provider]} onChange={onChange} />
  )
  return { onChange }
}

describe('AiProviderSettings removal', () => {
  beforeEach(() => {
    deleteApiKeyMock.mockReset().mockResolvedValue(undefined)
    saveApiKeyMock.mockReset().mockResolvedValue(undefined)
    testProviderMock.mockReset().mockResolvedValue(undefined)
  })

  it('does not delete the stored key until the removal is confirmed', async () => {
    const { onChange } = renderProviders()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    // The click opens a confirmation; nothing is destroyed yet.
    expect(deleteApiKeyMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    const confirm = await screen.findByTestId('ai-provider-remove-confirm')
    expect(confirm).toBeInTheDocument()
    expect(confirm.className).toContain('z-[1400]')
  })

  it('names the provider in the confirmation so the wrong one is not deleted', async () => {
    renderProviders()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    const dialog = await screen.findByTestId('ai-provider-remove-confirm')
    expect(dialog).toHaveTextContent('My OpenAI')
  })

  it('deletes the key and drops the provider once confirmed', async () => {
    const { onChange } = renderProviders()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    fireEvent.click(await screen.findByTestId('ai-provider-remove-confirm-action'))

    await waitFor(() => expect(deleteApiKeyMock).toHaveBeenCalledWith('openai-abc123'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([]))
  })

  it('keeps the provider and surfaces the reason when deleting the key fails', async () => {
    deleteApiKeyMock.mockRejectedValue(new Error('keychain is locked'))
    const { onChange } = renderProviders()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    fireEvent.click(await screen.findByTestId('ai-provider-remove-confirm-action'))

    // A swallowed failure used to leave the key on disk while the UI claimed it was gone.
    expect(await screen.findByText(/keychain is locked/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('cancelling the confirmation changes nothing', async () => {
    const { onChange } = renderProviders()

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    fireEvent.click(await screen.findByTestId('ai-provider-remove-confirm-cancel'))

    expect(deleteApiKeyMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})

function selectProviderPreset(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Provider' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

describe('AiProviderSettings presets', () => {
  beforeEach(() => {
    deleteApiKeyMock.mockReset().mockResolvedValue(undefined)
    saveApiKeyMock.mockReset().mockResolvedValue(undefined)
    testProviderMock.mockReset().mockResolvedValue(undefined)
    openExternalUrl.mockReset().mockResolvedValue(undefined)
  })

  it('prefills the base URL when a popular provider is selected', () => {
    renderProviders()

    const baseUrl = screen.getByLabelText('Base URL')
    expect(baseUrl).toHaveValue('https://api.openai.com/v1')

    selectProviderPreset('Groq')

    expect(baseUrl).toHaveValue('https://api.groq.com/openai/v1')
    expect(screen.getByLabelText('Name')).toHaveValue('Groq')
  })

  it('keeps the base URL editable after a preset prefills it', () => {
    renderProviders()
    selectProviderPreset('Mistral')

    const baseUrl = screen.getByLabelText('Base URL')
    expect(baseUrl).toHaveValue('https://api.mistral.ai/v1')
    fireEvent.change(baseUrl, { target: { value: 'https://lab.example/v1' } })
    expect(baseUrl).toHaveValue('https://lab.example/v1')
    expect(screen.getByLabelText('Name')).toHaveValue('Mistral')
  })

  it('opens the selected provider key page in the system browser', () => {
    renderProviders()
    selectProviderPreset('Anthropic')

    fireEvent.click(screen.getByRole('button', { name: 'Get API key' }))

    expect(openExternalUrl).toHaveBeenCalledWith(providerPresetById('anthropic')?.keyPageUrl)
    expect(openExternalUrl).toHaveBeenCalledWith(PROVIDER_PRESETS[0].keyPageUrl)
  })

  it('hides Get API key for a custom base URL', () => {
    renderProviders()
    selectProviderPreset('Custom')

    expect(screen.queryByRole('button', { name: 'Get API key' })).not.toBeInTheDocument()
    const baseUrl = screen.getByLabelText('Base URL')
    fireEvent.change(baseUrl, { target: { value: 'https://lab.example/v1' } })
    expect(baseUrl).toHaveValue('https://lab.example/v1')
  })
})
