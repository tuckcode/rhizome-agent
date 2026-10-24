import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMissingAiAgentsStatus } from '../lib/aiAgents'
import { createTranslator } from '../lib/i18n'
import type { AiModelProvider } from '../lib/aiTargets'
import { resetListProviderModelsCache } from '../lib/listProviderModels'
import { ConnectedProvidersSummary } from './ConnectedProvidersSummary'

const secrets = vi.hoisted(() => ({
  save: vi.fn(async () => {}),
  test: vi.fn(async () => 'OK'),
}))

const analytics = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}))

vi.mock('../utils/aiProviderSecrets', () => ({
  saveAiModelProviderApiKey: secrets.save,
  testAiModelProvider: secrets.test,
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: analytics.trackEvent,
}))

const capabilities = {
  streaming: false,
  tools: false,
  vision: true,
  json_mode: false,
  reasoning: { state: 'unknown' as const },
}

const provider: AiModelProvider = {
  id: 'work-openai',
  name: 'Work OpenAI',
  kind: 'open_ai',
  api_key_storage: 'env',
  api_key_env_var: 'OPENAI_API_KEY',
  models: [{ id: 'gpt-4o', display_name: 'GPT-4o', capabilities }],
}

const secret = 'sk-test-do-not-log'

function renderSummary(onChange = vi.fn()) {
  render(
    <ConnectedProvidersSummary
      t={createTranslator('en')}
      agents={createMissingAiAgentsStatus()}
      providers={[provider]}
      onChange={onChange}
      onOpen={vi.fn()}
    />,
  )
  return onChange
}

describe('ConnectedProvidersSummary', () => {
  beforeEach(() => {
    secrets.save.mockClear()
    secrets.test.mockReset()
    secrets.test.mockResolvedValue('OK')
    analytics.trackEvent.mockClear()
    resetListProviderModelsCache()
  })

  it('saves a pasted key as a local file only after the test passes', async () => {
    const onChange = renderSummary()
    const field = await screen.findByTestId('settings-connected-key-provider:work-openai')
    fireEvent.change(field, { target: { value: secret } })
    fireEvent.click(screen.getByTestId('settings-connected-test-provider:work-openai'))

    await waitFor(() => expect(secrets.save).toHaveBeenCalledWith('work-openai', secret))
    expect(secrets.test).toHaveBeenCalled()
    expect(secrets.save.mock.invocationCallOrder[0]).toBeGreaterThan(secrets.test.mock.invocationCallOrder[0])
    const saved = onChange.mock.calls.at(-1)?.[0] as AiModelProvider[]
    expect(saved.find((item) => item.id === 'work-openai')).toMatchObject({
      api_key_storage: 'local_file',
      api_key_env_var: null,
    })
    expect(JSON.stringify(analytics.trackEvent.mock.calls)).not.toContain(secret)
    expect(analytics.trackEvent).toHaveBeenCalledWith('provider_connection_tested', {
      provider_kind: 'open_ai',
      outcome: 'success',
    })
  })

  it('saves nothing when the test fails', async () => {
    secrets.test.mockRejectedValue(`rejected ${secret}`)
    const onChange = renderSummary()
    const field = await screen.findByTestId('settings-connected-key-provider:work-openai')
    fireEvent.change(field, { target: { value: secret } })
    fireEvent.click(screen.getByTestId('settings-connected-test-provider:work-openai'))

    await waitFor(() => expect(analytics.trackEvent).toHaveBeenCalledWith('provider_connection_tested', {
      provider_kind: 'open_ai',
      outcome: 'failed',
    }))
    expect(secrets.save).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not connect.')
    expect(screen.getByRole('alert').textContent).not.toContain(secret)
    expect(JSON.stringify(analytics.trackEvent.mock.calls)).not.toContain(secret)
  })
})
