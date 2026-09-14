import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  decidePrimeSessionRestore,
  idleDiskRestoreEligible,
  type PrimeRestoreInput,
} from './primeSessionRestore'
import type { PrimeSessionSummary } from './primeSessionMeta'

function session(overrides: Partial<PrimeSessionSummary> = {}): PrimeSessionSummary {
  return { id: 'old', path: '/sessions/old.jsonl', mtimeMs: 1, hasConversation: true, ...overrides }
}

function baseInput(overrides: Partial<PrimeRestoreInput> = {}): PrimeRestoreInput {
  return {
    enabled: true,
    native: true,
    hostRunning: true,
    hostReattached: false,
    hostSessionPath: null,
    summaries: [],
    idleResumeConsumed: false,
    ...overrides,
  }
}

describe('leftover idle restore without vault', () => {
  it('PrimeRestoreInput has no vaultPath field', () => {
    const source = readFileSync(`${process.cwd()}/src/lib/primeSessionRestore.ts`, 'utf8')
    expect(source).not.toContain('vaultPath')
    const input: PrimeRestoreInput = baseInput()
    expect(input).not.toHaveProperty('vaultPath')
  })

  describe('idleDiskRestoreEligible', () => {
    const eligible = {
      enabled: true,
      native: true,
      hostRunning: true,
      hostReattached: false,
      hostSessionPath: null as string | null,
      idleResumeConsumed: false,
    }

    it('is true when the native host is up with no attached session', () => {
      expect(idleDiskRestoreEligible(eligible)).toBe(true)
    })

    it('is false when any gate fails', () => {
      expect(idleDiskRestoreEligible({ ...eligible, enabled: false })).toBe(false)
      expect(idleDiskRestoreEligible({ ...eligible, native: false })).toBe(false)
      expect(idleDiskRestoreEligible({ ...eligible, hostRunning: false })).toBe(false)
      expect(idleDiskRestoreEligible({ ...eligible, hostReattached: true })).toBe(false)
      expect(idleDiskRestoreEligible({ ...eligible, hostSessionPath: '/sessions/x.jsonl' })).toBe(false)
      expect(idleDiskRestoreEligible({ ...eligible, idleResumeConsumed: true })).toBe(false)
    })

    it('treats whitespace-only hostSessionPath as no attached session', () => {
      expect(idleDiskRestoreEligible({ ...eligible, hostSessionPath: '   ' })).toBe(true)
    })
  })

  describe('decidePrimeSessionRestore leftover', () => {
    it('restores the last disk session with no cwd (no vault attached)', () => {
      const next = decidePrimeSessionRestore(baseInput({
        summaries: [
          session({ id: 'no-vault', path: '/sessions/no-vault.jsonl', mtimeMs: 5, cwd: null }),
          session({ id: 'older', path: '/sessions/older.jsonl', mtimeMs: 1, cwd: undefined }),
        ],
      }))
      expect(next).toEqual({
        type: 'idle-disk',
        session: expect.objectContaining({ id: 'no-vault', cwd: null }),
      })
    })

    it('does not live-attach when reattached but session path is empty', () => {
      const next = decidePrimeSessionRestore(baseInput({
        hostReattached: true,
        hostSessionPath: '',
        summaries: [session({ id: 'disk', path: '/sessions/disk.jsonl', mtimeMs: 9 })],
      }))
      expect(next).toEqual({ type: 'none' })
    })

    it('does not live-attach when reattached but session path is whitespace', () => {
      const next = decidePrimeSessionRestore(baseInput({
        hostReattached: true,
        hostSessionPath: '  \t  ',
        summaries: [session({ id: 'disk', path: '/sessions/disk.jsonl', mtimeMs: 9 })],
      }))
      expect(next).toEqual({ type: 'none' })
    })

    it('returns none when only scratch, archived, or empty sessions exist', () => {
      const next = decidePrimeSessionRestore(baseInput({
        summaries: [
          session({ id: 'scratch', mtimeMs: 99, scratch: true }),
          session({ id: 'archived', mtimeMs: 98, archived: true }),
          session({ id: 'empty', mtimeMs: 97, hasConversation: false }),
        ],
      }))
      expect(next).toEqual({ type: 'none' })
    })

    it('accepts undefined hostSessionPath the same as null', () => {
      const next = decidePrimeSessionRestore(baseInput({
        hostSessionPath: undefined,
        summaries: [session({ id: 'last', path: '/sessions/last.jsonl', mtimeMs: 3 })],
      }))
      expect(next.type).toBe('idle-disk')
    })
  })
})
