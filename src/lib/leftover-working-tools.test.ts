import { describe, expect, it } from 'vitest'

import { primeSessionMetaLabel } from './primeSessionMeta'

describe('leftover working · tools meta label', () => {
  it('returns Working · tools when the session is mid-turn', () => {
    const session = {
      id: 'session-1',
      path: '/tmp/session.jsonl',
      mtimeMs: Date.parse('2026-09-14T14:08:00'),
      cwd: '/Users/dtc/code/projects/rhizome-agent',
    }

    expect(
      primeSessionMetaLabel(session, Date.parse('2026-09-14T16:00:00'), {
        working: true,
        vaultPath: '/Users/dtc/code/projects/rhizome-agent',
      }),
    ).toBe('Working · tools')
  })
})
