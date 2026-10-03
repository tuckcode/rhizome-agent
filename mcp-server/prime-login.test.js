import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runPrimeLogin } from './prime-login.mjs'

/** Stands in for Prime's AuthStorage: records writes, scripts the OAuth flow. */
function fakeAuthStorage({ oauthIds = ['anthropic'], loginError } = {}) {
  const saved = {}
  return {
    saved,
    getOAuthProviders: () => oauthIds.map((id) => ({ id })),
    async login(provider, callbacks) {
      callbacks.onAuth({ url: `https://example.test/authorize?p=${provider}` })
      callbacks.onProgress?.('Exchanging authorization code for tokens...')
      if (loginError) throw new Error(loginError)
      saved[provider] = { type: 'oauth', access: 'token' }
    },
    set(provider, credential) {
      saved[provider] = credential
    },
  }
}

function collector() {
  const events = []
  return { events, emit: (event) => events.push(event) }
}

describe('runPrimeLogin', () => {
  it('runs browser OAuth for an OAuth provider and reports the URL to open', async () => {
    const authStorage = fakeAuthStorage()
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'anthropic', authStorage, emit, readKey: () => assert.fail('no key needed') })

    assert.deepEqual(events[0], { event: 'open_url', url: 'https://example.test/authorize?p=anthropic' })
    assert.deepEqual(events.at(-1), { event: 'done' })
    assert.equal(authStorage.saved.anthropic.type, 'oauth')
  })

  it('stores a pasted API key for a provider without OAuth', async () => {
    const authStorage = fakeAuthStorage()
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'xai', authStorage, emit, readKey: async () => '  xai-secret\n' })

    assert.deepEqual(authStorage.saved.xai, { type: 'api_key', key: 'xai-secret' })
    assert.deepEqual(events, [{ event: 'done' }])
  })

  it('refuses an empty key without writing anything', async () => {
    const authStorage = fakeAuthStorage()
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'xai', authStorage, emit, readKey: async () => '   ' })

    assert.equal(authStorage.saved.xai, undefined)
    assert.deepEqual(events, [{ event: 'error', message: 'No API key was entered.' }])
  })

  it('reports a failed OAuth exchange as an error event', async () => {
    const authStorage = fakeAuthStorage({ loginError: 'Token exchange request failed' })
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'anthropic', authStorage, emit, readKey: async () => '' })

    assert.deepEqual(events.at(-1), { event: 'error', message: 'Token exchange request failed' })
  })
})
