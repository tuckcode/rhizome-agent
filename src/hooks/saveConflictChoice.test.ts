import { describe, expect, it, vi } from 'vitest'
import { finishConflictChoice, keepMineAfterHold } from './saveConflictChoice'

const A = '/vault/a.md'
const B = '/vault/b.md'

describe('finishConflictChoice', () => {
  it('reloads A when A is still the active tab', () => {
    const clearStash = vi.fn()
    const clearUnsaved = vi.fn()
    const reloadActive = vi.fn()
    finishConflictChoice({
      activePath: A,
      conflictPath: A,
      clearStash,
      clearUnsaved,
      reloadActive,
    })
    expect(clearStash).toHaveBeenCalledOnce()
    expect(clearUnsaved).toHaveBeenCalledOnce()
    expect(reloadActive).toHaveBeenCalledOnce()
  })

  it('applies the choice to A without pulling the user back from B', () => {
    const reloadActive = vi.fn()
    finishConflictChoice({
      activePath: B,
      conflictPath: A,
      clearStash: vi.fn(),
      clearUnsaved: vi.fn(),
      reloadActive,
    })
    expect(reloadActive).not.toHaveBeenCalled()
  })
})

describe('keepMineAfterHold', () => {
  it('reads the editor after the in-flight save resolves', async () => {
    const order: string[] = []
    await keepMineAfterHold({
      hold: async () => { order.push('hold') },
      readLive: () => { order.push('read'); return 'typed after the click' },
      snapshot: 'conflict snapshot',
      write: async (content) => { order.push(content) },
    })
    expect(order).toEqual(['hold', 'read', 'typed after the click'])
  })
})
