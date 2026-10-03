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

    await runPrimeLogin({ provider: 'anthropic', mode: 'browser', authStorage, emit, readKey: () => assert.fail('no key needed') })

    assert.deepEqual(events[0], { event: 'open_url', url: 'https://example.test/authorize?p=anthropic' })
    assert.deepEqual(events.at(-1), { event: 'done' })
    assert.equal(authStorage.saved.anthropic.type, 'oauth')
  })

  it('stores a pasted API key for a provider without OAuth', async () => {
    const authStorage = fakeAuthStorage()
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'deepseek', mode: 'key', authStorage, emit, readKey: async () => '  test-key\n' })

    assert.deepEqual(authStorage.saved.deepseek, { type: 'api_key', key: 'test-key' })
    assert.deepEqual(events, [{ event: 'done' }])
  })

  it('refuses an empty key without writing anything', async () => {
    const authStorage = fakeAuthStorage()
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'deepseek', mode: 'key', authStorage, emit, readKey: async () => '   ' })

    assert.equal(authStorage.saved.deepseek, undefined)
    assert.deepEqual(events, [{ event: 'error', message: 'No API key was entered.' }])
  })

  it('says so when Prime has no browser sign-in for the provider', async () => {
    // xAI's browser login comes from a user extension (xai-oauth.ts); without
    // it, a browser sign-in must not fall through to asking for a key.
    const authStorage = fakeAuthStorage({ oauthIds: ['anthropic'] })
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'xai', mode: 'browser', authStorage, emit, readKey: () => assert.fail('no key') })

    assert.equal(events.length, 1)
    assert.equal(events[0].event, 'error')
    assert.match(events[0].message, /no browser sign-in for xai/)
    assert.equal(authStorage.saved.xai, undefined)
  })

  it('reports a failed OAuth exchange as an error event', async () => {
    const authStorage = fakeAuthStorage({ loginError: 'Token exchange request failed' })
    const { events, emit } = collector()

    await runPrimeLogin({ provider: 'anthropic', mode: 'browser', authStorage, emit, readKey: async () => '' })

    assert.deepEqual(events.at(-1), { event: 'error', message: 'Token exchange request failed' })
  })
})
