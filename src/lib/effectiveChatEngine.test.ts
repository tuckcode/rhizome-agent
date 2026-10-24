import { describe, expect, it } from 'vitest'
import {
  chatEngineLockTarget,
  resolveEffectiveChatEngine,
  shouldLockEffectiveChatEngine,
  startedEngineFromLock,
} from './effectiveChatEngine'

const primeTarget = {
  requestedEngine: 'prime' as const,
  isPrimeTarget: true,
  startedEngine: null,
}

describe('resolveEffectiveChatEngine', () => {
  it('returns the native engine', () => {
    expect(resolveEffectiveChatEngine()).toBe('native')
  })
})

describe('shouldLockEffectiveChatEngine', () => {
  it('locks once, including a Prime chat whose host is still unknown', () => {
    expect(shouldLockEffectiveChatEngine(primeTarget)).toBe(true)
    expect(shouldLockEffectiveChatEngine({ ...primeTarget, isPrimeTarget: false })).toBe(true)
    expect(shouldLockEffectiveChatEngine({ ...primeTarget, requestedEngine: 'native' })).toBe(true)
    expect(shouldLockEffectiveChatEngine({ ...primeTarget, startedEngine: 'native' })).toBe(false)
    expect(shouldLockEffectiveChatEngine({ ...primeTarget, startedEngine: 'prime' })).toBe(false)
  })
})

describe('startedEngineFromLock', () => {
  const lock = {
    engine: 'native' as const,
    conversation: 'sess-1',
    target: 'prime',
  }

  it('keeps the lock when Settings flips and drops it on a new conversation or target', () => {
    expect(startedEngineFromLock(lock, lock)).toBe('native')
    expect(startedEngineFromLock(lock, { ...lock, conversation: 'sess-2' })).toBeNull()
    expect(startedEngineFromLock(lock, { ...lock, target: 'codex' })).toBeNull()
    expect(chatEngineLockTarget(true, 'prime')).toBe('prime')
    expect(chatEngineLockTarget(false, 'codex')).toBe('codex')
  })
})
