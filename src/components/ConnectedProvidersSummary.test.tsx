import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMissingAiAgentsStatus } from '../lib/aiAgents'
import { createTranslator } from '../lib/i18n'
import type { AiModelProvider } from '../lib/aiTargets'
import { resetListProviderModelsCache } from '../lib/listProviderModels'
import { providerRowId, summaryRowId } from '../lib/connectedProviders'
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

  it('shows a configured Anthropic row as Ready', () => {
    render(
      <ConnectedProvidersSummary
        t={createTranslator('en')}
        agents={createMissingAiAgentsStatus()}
        providers={[{
          id: 'work-claude',
          name: 'Work Claude',
          kind: 'anthropic',
          api_key_storage: 'local_file',
          models: [{ id: 'claude-sonnet', display_name: 'Claude Sonnet', capabilities }],
        }]}
        onChange={vi.fn()}
        onOpen={vi.fn()}
      />,
    )
    const row = screen.getByTestId('settings-connected-row-provider:work-claude')
    expect(row).toHaveAttribute('data-status', 'ready')
    expect(screen.getByTestId('settings-connected-status-provider:work-claude')).toHaveTextContent('Ready')
    expect(screen.getByTestId('settings-connected-models-provider:work-claude')).toHaveTextContent('Claude Sonnet')
  })

  it('shows a configured keyless remote row as Ready', () => {
    render(
      <ConnectedProvidersSummary
        t={createTranslator('en')}
        agents={createMissingAiAgentsStatus()}
        providers={[{
          id: 'lab',
          name: 'Lab',
          kind: 'open_ai_compatible',
          base_url: 'https://lab.example/v1',
          api_key_storage: 'none',
          api_key_env_var: null,
          models: [{ id: 'lab-1', display_name: 'Lab 1', capabilities }],
        }]}
        onChange={vi.fn()}
        onOpen={vi.fn()}
      />,
    )
    const row = screen.getByTestId('settings-connected-row-provider:lab')
    expect(row).toHaveAttribute('data-status', 'ready')
    expect(screen.getByTestId('settings-connected-status-provider:lab')).toHaveTextContent('Ready')
    expect(screen.getByTestId('settings-connected-models-provider:lab')).toHaveTextContent('Lab 1')
  })

  it('focuses the key field, scrolls the row, and briefly highlights it for Add key', async () => {
    vi.useFakeTimers()
    const focusRowId = summaryRowId(providerRowId('work-openai'))
    const onFocusConsumed = vi.fn()
    render(
      <ConnectedProvidersSummary
        t={createTranslator('en')}
        agents={createMissingAiAgentsStatus()}
        providers={[provider]}
        onChange={vi.fn()}
        onOpen={vi.fn()}
        focusRowId={focusRowId}
        onFocusConsumed={onFocusConsumed}
      />,
    )
    const row = screen.getByTestId('settings-connected-row-provider:work-openai')
    const field = screen.getByTestId('settings-connected-key-provider:work-openai')
    const scrollIntoView = vi.fn()
    row.scrollIntoView = scrollIntoView

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120)
    })

    expect(scrollIntoView).toHaveBeenCalled()
    expect(field).toHaveFocus()
    expect(row).toHaveAttribute('data-highlighted', 'true')
    expect(onFocusConsumed).toHaveBeenCalledOnce()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    expect(row).not.toHaveAttribute('data-highlighted')
    vi.useRealTimers()
  })

})
