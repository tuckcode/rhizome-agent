import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FirstRunModelStep } from './FirstRunModelStep'

const mocks = vi.hoisted(() => ({
  listModels: vi.fn<(provider: { kind: string }) => Promise<string[]>>(),
  testProvider: vi.fn<(...args: unknown[]) => Promise<string>>(),
  saveKey: vi.fn<(...args: unknown[]) => Promise<void>>(),
  oauthStatus: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  callHost: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))

vi.mock('../lib/listProviderModels', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/listProviderModels')>()),
  listAiModelProviderModels: mocks.listModels,
  forgetListedProviderModels: vi.fn(),
}))

vi.mock('../utils/aiProviderSecrets', () => ({
  testAiModelProvider: mocks.testProvider,
  saveAiModelProviderApiKey: mocks.saveKey,
  deleteAiModelProviderApiKey: vi.fn(),
}))

vi.mock('../lib/providerOauth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/providerOauth')>()),
  fetchOauthStatus: mocks.oauthStatus,
}))

vi.mock('../lib/callHost', () => ({
  callHost: mocks.callHost,
  callHostOr: vi.fn(),
}))

function renderStep() {
  const onConnected = vi.fn().mockResolvedValue(undefined)
  const onSkip = vi.fn()
  render(<FirstRunModelStep providers={null} onConnected={onConnected} onSkip={onSkip} />)
  return { onConnected, onSkip }
}

beforeEach(() => {
  mocks.listModels.mockReset()
  mocks.testProvider.mockReset()
  mocks.saveKey.mockReset().mockResolvedValue(undefined)
  mocks.oauthStatus.mockReset().mockRejectedValue(new Error('no host'))
  mocks.callHost.mockReset().mockRejectedValue(new Error('no host'))
})

describe('FirstRunModelStep', () => {
  it('recommends a detected local model and saves it as the chat model', async () => {
    mocks.listModels.mockImplementation(async (provider) => (provider.kind === 'ollama' ? ['llama3.2', 'qwen2.5'] : []))
    const { onConnected } = renderStep()

    expect(await screen.findByText('Ollama is running with 2 models.')).toBeInTheDocument()
    expect(screen.getByTestId('first-run-model-path-local')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('first-run-model-local-use'))

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1))
    const patch = onConnected.mock.calls[0][0]
    expect(patch.native_chat_target).toBe('ollama/llama3.2')
    expect(patch.ai_model_providers.map((provider: { kind: string }) => provider.kind)).toEqual(['ollama'])
  })

  it('recommends ChatGPT sign-in when no local model answers', async () => {
    mocks.listModels.mockResolvedValue([])
    renderStep()

    await waitFor(() => expect(screen.getByTestId('first-run-model-path-chatgpt')).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByTestId('first-run-model-chatgpt-sign-in')).toBeInTheDocument()
  })

  it('says no server answered and looks again on request', async () => {
    mocks.listModels.mockResolvedValue([])
    renderStep()
    await waitFor(() => expect(screen.getByTestId('first-run-model-path-chatgpt')).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(screen.getByTestId('first-run-model-path-local'))
    expect(screen.getByTestId('first-run-model-local-none')).toBeInTheDocument()

    mocks.listModels.mockImplementation(async (provider) => (provider.kind === 'lm_studio' ? ['qwen'] : []))
    fireEvent.click(screen.getByTestId('first-run-model-local-retry'))
    expect(await screen.findByText('LM Studio is running with 1 model.')).toBeInTheDocument()
  })

  it('tests an API key before saving it, and saves the key to the keychain only', async () => {
    mocks.listModels.mockResolvedValue([])
    mocks.testProvider.mockResolvedValue('OK')
    const { onConnected } = renderStep()
    await waitFor(() => expect(screen.getByTestId('first-run-model-path-chatgpt')).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(screen.getByTestId('first-run-model-path-api_key'))
    fireEvent.change(screen.getByTestId('first-run-model-key-input'), { target: { value: 'test-key-123' } })
    fireEvent.click(screen.getByTestId('first-run-model-key-save'))

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1))
    expect(mocks.testProvider).toHaveBeenCalledBefore(mocks.saveKey)
    expect(mocks.saveKey).toHaveBeenCalledWith('openai', 'test-key-123')
    const patch = onConnected.mock.calls[0][0]
    expect(JSON.stringify(patch)).not.toContain('test-key-123')
    expect(patch.native_chat_target).toMatch(/^openai\//)
  })

  it('keeps the key and saves nothing when the test fails', async () => {
    mocks.listModels.mockResolvedValue([])
    mocks.testProvider.mockRejectedValue(new Error('401 Unauthorized'))
    const { onConnected } = renderStep()
    await waitFor(() => expect(screen.getByTestId('first-run-model-path-chatgpt')).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(screen.getByTestId('first-run-model-path-api_key'))
    fireEvent.change(screen.getByTestId('first-run-model-key-input'), { target: { value: 'bad-key' } })
    fireEvent.click(screen.getByTestId('first-run-model-key-save'))

    expect(await screen.findByTestId('first-run-model-key-error')).toHaveTextContent('401 Unauthorized')
    expect(mocks.saveKey).not.toHaveBeenCalled()
    expect(onConnected).not.toHaveBeenCalled()
    expect(screen.getByTestId('first-run-model-key-input')).toHaveValue('bad-key')
  })

  it('never shows the key in an error', async () => {
    mocks.listModels.mockResolvedValue([])
    mocks.testProvider.mockRejectedValue(new Error('rejected key secret-999'))
    renderStep()
    await waitFor(() => expect(screen.getByTestId('first-run-model-path-chatgpt')).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(screen.getByTestId('first-run-model-path-api_key'))
    fireEvent.change(screen.getByTestId('first-run-model-key-input'), { target: { value: 'secret-999' } })
    fireEvent.click(screen.getByTestId('first-run-model-key-save'))

    expect(await screen.findByTestId('first-run-model-key-error')).toHaveTextContent('Could not connect.')
  })

  it('continues with an existing ChatGPT sign-in and picks its first model', async () => {
    mocks.listModels.mockResolvedValue([])
    mocks.oauthStatus.mockResolvedValue({
      provider: 'openai', enabled: true, signed_in: true, usable: true, email: null, revoked: false,
    })
    mocks.callHost.mockResolvedValue([{ slug: 'gpt-6-luna', displayName: 'GPT-6 Luna' }])
    const { onConnected } = renderStep()

    fireEvent.click(await screen.findByTestId('first-run-model-chatgpt-continue'))
    await waitFor(() => expect(onConnected).toHaveBeenCalledWith({ native_chat_target: 'openai/gpt-6-luna' }))
  })

  it('ends the step with nothing saved on Set up later', async () => {
    mocks.listModels.mockResolvedValue([])
    const { onConnected, onSkip } = renderStep()

    fireEvent.click(screen.getByTestId('first-run-model-skip'))
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onConnected).not.toHaveBeenCalled()
  })
})
