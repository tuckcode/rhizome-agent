import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AiProviderSettings } from './AiProviderSettings'
import { createTranslator } from '../lib/i18n'
import { DEFAULT_MODEL_CAPABILITIES, type AiModelProvider } from '../lib/aiTargets'
import { PROVIDER_PRESETS, providerPresetById } from '../lib/providerPresets'

function compatiblePresets() {
  return PROVIDER_PRESETS.filter((preset) => preset.apiStyle === 'open_ai_compatible')
}

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
  })

  it('shows the key-page URL when the opener fails', async () => {
    openExternalUrl.mockRejectedValueOnce(new Error('opener blocked'))
    renderProviders()

    fireEvent.click(screen.getByRole('button', { name: 'Get API key' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not open the key page.')
    expect(alert).toHaveTextContent(providerPresetById('openai')!.keyPageUrl)
  })

  it('hides Get API key for a custom base URL', () => {
    renderProviders()
    selectProviderPreset('Custom')

    expect(screen.queryByRole('button', { name: 'Get API key' })).not.toBeInTheDocument()
    const baseUrl = screen.getByLabelText('Base URL')
    fireEvent.change(baseUrl, { target: { value: 'https://lab.example/v1' } })
    expect(baseUrl).toHaveValue('https://lab.example/v1')
  })

  it('keeps an edited base URL when switching presets', () => {
    renderProviders()

    const baseUrl = screen.getByLabelText('Base URL')
    fireEvent.change(baseUrl, { target: { value: 'https://lab.example/v1' } })
    selectProviderPreset('Groq')

    expect(baseUrl).toHaveValue('https://lab.example/v1')
    expect(screen.getByLabelText('Name')).toHaveValue('Groq')
    expect(screen.getByLabelText('Model ID')).toHaveValue('llama-3.3-70b-versatile')
  })

  it('keeps an edited Custom URL when the API style changes', () => {
    renderProviders()
    selectProviderPreset('Custom')

    const baseUrl = screen.getByLabelText('Base URL')
    fireEvent.change(baseUrl, { target: { value: 'https://lab.example/v1' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'API style' }))
    fireEvent.click(screen.getByRole('option', { name: 'OpenAI' }))

    expect(baseUrl).toHaveValue('https://lab.example/v1')
    expect(screen.getByRole('combobox', { name: 'API style' })).toHaveTextContent('OpenAI')
  })

  it('clears a pasted API key when switching provider', () => {
    renderProviders()

    const apiKey = screen.getByLabelText('API key')
    fireEvent.change(apiKey, { target: { value: 'sk-live-openai' } })
    expect(apiKey).toHaveValue('sk-live-openai')

    selectProviderPreset('xAI')

    expect(screen.getByLabelText('API key')).toHaveValue('')
    expect(screen.getByPlaceholderText('Paste your xAI key')).toBeInTheDocument()
  })

  it.each(compatiblePresets())('uses $apiKeyEnvVar for the $label compatible preset', (preset) => {
    renderProviders()
    selectProviderPreset(preset.label)

    fireEvent.click(screen.getByRole('combobox', { name: 'API key storage' }))
    fireEvent.click(screen.getByRole('option', { name: 'Read from env var' }))

    expect(screen.getByLabelText('API key env var')).toHaveValue(preset.apiKeyEnvVar)
    expect(screen.getByLabelText('Model ID')).toHaveValue(preset.modelId)
  })

  it('marks Anthropic as not in Rhizome chat yet without hiding the preset', () => {
    render(<AiProviderSettings t={t} mode="api" providers={[]} onChange={vi.fn()} />)

    expect(screen.getByText('No API models yet.')).toBeInTheDocument()
    selectProviderPreset('Anthropic')

    const note = screen.getByTestId('ai-provider-anthropic-note')
    expect(note).toHaveTextContent('Not in Rhizome chat yet')
    expect(screen.getByLabelText('Model ID')).toHaveValue('claude-3-5-sonnet-latest')
    expect(screen.getByRole('button', { name: 'Add API model' })).toBeDisabled()
    expect(screen.getByTestId('ai-provider-disabled-reason')).toHaveTextContent('Paste an API key first.')
    expect(screen.getByTestId('ai-provider-test-model')).toBeDisabled()
  })

  it('fills a real model id from the default OpenAI preset', () => {
    renderProviders()

    expect(screen.getByLabelText('Model ID')).toHaveValue('gpt-4.1-mini')
    expect(screen.getByPlaceholderText('Paste your OpenAI key')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'API key storage' })).toHaveTextContent('System keychain')
  })
})
