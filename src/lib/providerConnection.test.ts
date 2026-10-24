import { describe, expect, it } from 'vitest'
import {
  agentConnectionStatus,
  connectionAction,
  connectionErrorMessage,
  connectionStatus,
  connectionStatusLabel,
  unsetProvidersLabel,
} from './providerConnection'

describe('connectionStatus', () => {
  it('says Ready when a probe returned models', () => {
    expect(connectionStatus({
      needsKey: false,
      local: true,
      probe: { models: ['llama3.2'] },
    })).toBe('ready')
    expect(connectionStatusLabel('ready')).toBe('Ready')
    expect(connectionAction('ready')).toBe('open')
  })

  it('says Needs a key before it trusts a saved model list', () => {
    expect(connectionStatus({
      needsKey: true,
      local: false,
      probe: { models: ['gpt-4o'] },
    })).toBe('needs_key')
    expect(connectionStatusLabel('needs_key')).toBe('Needs a key')
    expect(connectionAction('needs_key')).toBe('add_key')
  })

  it('says Not running when a local server does not answer', () => {
    expect(connectionStatus({
      needsKey: false,
      local: true,
      probe: { unreachable: true, failed: true, models: [] },
    })).toBe('not_running')
    expect(connectionStatusLabel('not_running')).toBe('Not running')
    expect(connectionAction('not_running')).toBe('retry')
  })

  it('says Couldn\'t load models when the list fails, times out, or is empty', () => {
    expect(connectionStatus({
      needsKey: false,
      local: false,
      probe: { failed: true, models: [] },
    })).toBe('load_failed')
    expect(connectionStatus({
      needsKey: false,
      local: true,
      probe: { models: [] },
    })).toBe('load_failed')
    expect(connectionStatus({
      needsKey: false,
      local: false,
      probe: null,
    })).toBe('load_failed')
    expect(connectionStatusLabel('load_failed')).toBe("Couldn't load models")
    expect(connectionAction('load_failed')).toBe('retry')
  })

  it('does not call a remote HTTP failure Not running', () => {
    expect(connectionStatus({
      needsKey: false,
      local: false,
      probe: { unreachable: true, failed: true, models: [] },
    })).toBe('load_failed')
  })
})

describe('agentConnectionStatus', () => {
  it('marks an installed agent Ready and a missing one Not running', () => {
    expect(agentConnectionStatus(true)).toBe('ready')
    expect(agentConnectionStatus(false)).toBe('not_running')
  })
})

describe('unsetProvidersLabel', () => {
  it('pluralizes the picker footer', () => {
    expect(unsetProvidersLabel(1)).toBe("1 provider isn't set up")
    expect(unsetProvidersLabel(3)).toBe("3 providers aren't set up")
  })
})

describe('connectionErrorMessage', () => {
  it('drops a message that echoes the pasted key', () => {
    const secret = 'sk-test-secret'
    expect(connectionErrorMessage(new Error(`rejected ${secret}`), secret)).toBe('Could not connect.')
    expect(connectionErrorMessage(new Error('connection refused'), secret)).toBe('connection refused')
    expect(connectionErrorMessage('nope', secret)).toBe('Could not connect.')
  })
})
