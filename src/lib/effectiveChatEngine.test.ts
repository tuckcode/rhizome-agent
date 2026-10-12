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
  hostKnown: false,
  hostNotInstalled: false,
  startedEngine: null,
}

describe('resolveEffectiveChatEngine', () => {
  it('does not send Claude Code, Codex, or OpenCode through the native engine', () => {
    expect(
      resolveEffectiveChatEngine({
        ...primeTarget,
        isPrimeTarget: false,
        hostKnown: true,
        hostNotInstalled: true,
      }),
    ).toBe('prime')
  })

  it('keeps an explicit Settings native engine', () => {
    expect(
      resolveEffectiveChatEngine({
        ...primeTarget,
        requestedEngine: 'native',
        isPrimeTarget: false,
      }),
    ).toBe('native')
  })

  it('stays on Prime while host status is still unknown', () => {
    expect(resolveEffectiveChatEngine(primeTarget)).toBe('prime')
  })

  it('falls back to native only after a real status says Prime is not installed', () => {
    expect(
      resolveEffectiveChatEngine({
        ...primeTarget,
        hostKnown: true,
        hostNotInstalled: false,
      }),
    ).toBe('prime')
    expect(
      resolveEffectiveChatEngine({
        ...primeTarget,
        hostKnown: true,
        hostNotInstalled: true,
      }),
    ).toBe('native')
  })

  it('keeps an already-open chat on the engine it started on', () => {
    expect(
      resolveEffectiveChatEngine({
        ...primeTarget,
        hostKnown: true,
        hostNotInstalled: true,
        startedEngine: 'prime',
      }),
    ).toBe('prime')
    expect(
      resolveEffectiveChatEngine({
        ...primeTarget,
        hostKnown: true,
        hostNotInstalled: false,
        startedEngine: 'native',
      }),
    ).toBe('native')
  })
})

describe('shouldLockEffectiveChatEngine', () => {
  it('locks CLI-agent chats immediately and Prime chats once the host is known', () => {
    expect(shouldLockEffectiveChatEngine({ ...primeTarget, isPrimeTarget: false })).toBe(true)
    expect(shouldLockEffectiveChatEngine(primeTarget)).toBe(false)
    expect(shouldLockEffectiveChatEngine({ ...primeTarget, hostKnown: true })).toBe(true)
    expect(
      shouldLockEffectiveChatEngine({ ...primeTarget, hostKnown: true, startedEngine: 'prime' }),
    ).toBe(false)
  })
})

describe('startedEngineFromLock', () => {
  const lock = {
    engine: 'native' as const,
    conversation: 'sess-1',
    target: 'prime',
    requestedEngine: 'prime' as const,
  }

  it('drops the lock when conversation, target, or Settings engine change', () => {
    expect(startedEngineFromLock(lock, lock)).toBe('native')
    expect(startedEngineFromLock(lock, { ...lock, conversation: 'sess-2' })).toBeNull()
    expect(startedEngineFromLock(lock, { ...lock, target: 'codex' })).toBeNull()
    expect(startedEngineFromLock(lock, { ...lock, requestedEngine: 'native' })).toBeNull()
    expect(chatEngineLockTarget(true, 'prime')).toBe('prime')
    expect(chatEngineLockTarget(false, 'codex')).toBe('codex')
  })
})
