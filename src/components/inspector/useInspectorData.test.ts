import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import { buildInspectorLinkIndex, getInspectorLinkIndex } from './useInspectorData'

describe('buildInspectorLinkIndex', () => {
  it('indexes referenced-by and backlinks once per matching source entry', () => {
    const target = makeEntry({
      path: '/vault/work/responsibility/grow-newsletter.md',
      filename: 'grow-newsletter.md',
      title: 'Grow Newsletter',
      aliases: ['Newsletter'],
      isA: 'Responsibility',
    })
    const relationshipSource = makeEntry({
      path: '/vault/essay/on-writing.md',
      filename: 'on-writing.md',
      title: 'On Writing Well',
      isA: 'Essay',
      relationships: {
        'Belongs to': ['[[responsibility/grow-newsletter]]', '[[Newsletter]]'],
        Type: ['[[essay]]'],
      },
      outgoingLinks: ['grow-newsletter', 'responsibility/grow-newsletter'],
    })
    const typeSource = makeEntry({
      path: '/vault/type/responsibility.md',
      filename: 'responsibility.md',
      title: 'Responsibility',
      isA: 'Type',
      relationships: {
        Type: ['[[grow-newsletter]]'],
      },
    })

    const index = buildInspectorLinkIndex([target, relationshipSource, typeSource])

    expect(index.referencedBy.get(target.path)).toEqual([
      { entry: relationshipSource, viaKey: 'Belongs to' },
    ])
    expect(index.backlinks.get(target.path)).toEqual([
      { entry: relationshipSource, context: null },
    ])
  })

  it('reuses the cached index for the same entries array', () => {
    const entries = [
      makeEntry({
        path: '/vault/target.md',
        filename: 'target.md',
        title: 'Target',
      }),
    ]

    expect(getInspectorLinkIndex(entries)).toBe(getInspectorLinkIndex(entries))
    expect(getInspectorLinkIndex([...entries])).not.toBe(getInspectorLinkIndex(entries))
  })
})
