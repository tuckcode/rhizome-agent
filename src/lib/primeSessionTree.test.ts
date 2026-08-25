import { describe, expect, it } from 'vitest'
import {
  EMPTY_PRIME_SESSION_TREE,
  sessionTreeBranchCount,
  sessionTreeBranchGroups,
  type PrimeSessionTreeNode,
} from './primeSessionTree'

function node(overrides: Partial<PrimeSessionTreeNode> & Pick<PrimeSessionTreeNode, 'id'>): PrimeSessionTreeNode {
  return {
    kind: 'user',
    title: overrides.id,
    ...overrides,
  }
}

describe('sessionTreeBranchGroups', () => {
  it('stays quiet on a linear conversation', () => {
    expect(
      sessionTreeBranchGroups({
        leafId: 'a2',
        nodes: [
          node({ id: 'u1', title: 'first' }),
          node({ id: 'a1', parentId: 'u1', kind: 'assistant', title: 'ok' }),
          node({ id: 'u2', parentId: 'a1', title: 'second' }),
          node({ id: 'a2', parentId: 'u2', kind: 'assistant', title: 'done' }),
        ],
      }),
    ).toEqual([])
  })

  it('lists sibling user turns at a fork and marks the current path', () => {
    const groups = sessionTreeBranchGroups({
      leafId: 'rust-a',
      nodes: [
        node({ id: 'u1', title: 'how should we store this' }),
        node({ id: 'a1', parentId: 'u1', kind: 'assistant', title: 'options' }),
        node({ id: 'ts', parentId: 'a1', title: 'stay on typescript' }),
        node({ id: 'rust', parentId: 'a1', title: 'try rust rewrite' }),
        node({ id: 'rust-a', parentId: 'rust', kind: 'assistant', title: 'ok' }),
      ],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].map((row) => `${row.current ? '*' : ''}${row.title}`)).toEqual([
      'stay on typescript',
      '*try rust rewrite',
    ])
  })

  it('counts every listed alternative, not only the current one', () => {
    expect(
      sessionTreeBranchCount({
        leafId: 'b',
        nodes: [
          node({ id: 'a', title: 'one' }),
          node({ id: 'b', parentId: 'root', title: 'two' }),
          node({ id: 'c', parentId: 'root', title: 'three' }),
        ],
      }),
    ).toBe(2)
  })

  it('treats a missing tree as no branches', () => {
    expect(sessionTreeBranchGroups(undefined)).toEqual([])
    expect(sessionTreeBranchCount(EMPTY_PRIME_SESSION_TREE)).toBe(0)
  })
})
