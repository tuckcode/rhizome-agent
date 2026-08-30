import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AiProviderSettings } from './AiProviderSettings'
import { createTranslator } from '../lib/i18n'
import { DEFAULT_MODEL_CAPABILITIES, type AiModelProvider } from '../lib/aiTargets'

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
    expect(await screen.findByTestId('ai-provider-remove-confirm')).toBeInTheDocument()
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
