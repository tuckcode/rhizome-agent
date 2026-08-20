import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callHost, callHostOr } from './callHost'

const state = vi.hoisted(() => ({ tauri: false, calls: [] as string[], args: [] as unknown[], fail: '' }))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, ...rest: unknown[]) => {
    state.calls.push(`invoke:${cmd}`)
    state.args = rest
    return state.fail ? Promise.reject(new Error(state.fail)) : Promise.resolve('from-tauri')
  },
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => state.tauri,
  mockInvoke: (cmd: string, ...rest: unknown[]) => {
    state.calls.push(`mock:${cmd}`)
    state.args = rest
    return state.fail ? Promise.reject(new Error(state.fail)) : Promise.resolve('from-mock')
  },
}))

beforeEach(() => {
  state.tauri = false
  state.calls = []
  state.args = []
  state.fail = ''
})

describe('callHost', () => {
  it('reaches the real host inside Tauri', async () => {
    state.tauri = true
    await expect(callHost('get_prime_session_host_status')).resolves.toBe('from-tauri')
    expect(state.calls).toEqual(['invoke:get_prime_session_host_status'])
  })

  it('falls through to the mock outside Tauri instead of returning early', async () => {
    // The bug this module exists to make impossible: several call sites reached
    // for `invoke` directly and bailed when not in Tauri, so those surfaces were
    // unreachable in browser and mock runs rather than merely non-functional.
    await expect(callHost('list_prime_running_sessions')).resolves.toBe('from-mock')
    expect(state.calls).toEqual(['mock:list_prime_running_sessions'])
  })

  it('forwards an argument-less command with one argument, not two', async () => {
    // `invoke(cmd, undefined)` is a different call shape from `invoke(cmd)`,
    // and every hand-written copy of this seam used the latter.
    state.tauri = true
    await callHost('load_vault_list')
    expect(state.args).toEqual([])
  })

  it('passes arguments through when there are some', async () => {
    state.tauri = true
    await callHost('set_prime_thinking_level', { level: 'high' })
    expect(state.args).toEqual([{ level: 'high' }])
  })

  it('propagates failures — a mutation must not fail silently', async () => {
    state.fail = 'no such command'
    await expect(callHost('cancel_prime_scheduled_work')).rejects.toThrow('no such command')
  })
})

describe('callHostOr', () => {
  it('returns the fallback when the host is not up', async () => {
    state.fail = 'not connected'
    await expect(callHostOr('get_prime_agent_activity', null)).resolves.toBeNull()
  })

  it('returns the real answer when the call succeeds', async () => {
    await expect(callHostOr('get_prime_agent_activity', null)).resolves.toBe('from-mock')
  })

  it('still chooses the adapter the same way', async () => {
    state.tauri = true
    await callHostOr('get_prime_agent_activity', null)
    expect(state.calls).toEqual(['invoke:get_prime_agent_activity'])
  })
})
