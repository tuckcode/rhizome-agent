import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../test-utils/noteListTestUtils'
import { resolveRefProps } from './shared'

describe('resolveRefProps', () => {
  it('uses the resolved entry title for relationship labels', () => {
    const linkedTopic = makeEntry({
      path: '/vault/topic/ai-ml.md',
      filename: 'ai-ml.md',
      title: 'AI / ML',
      isA: 'Topic',
    })
    const topicType = makeEntry({
      path: '/vault/type/topic.md',
      filename: 'topic.md',
      title: 'Topic',
      isA: 'Type',
      color: 'green',
    })

    const props = resolveRefProps('[[topic/ai-ml]]', [linkedTopic, topicType], { Topic: topicType })

    expect(props.label).toBe('AI / ML')
  })

  it('keeps explicit wikilink aliases for relationship labels', () => {
    const linkedProject = makeEntry({
      path: '/vault/project/my-project.md',
      filename: 'my-project.md',
      title: 'My Project',
      isA: 'Project',
    })

    const props = resolveRefProps('[[project/my-project|My Cool Project]]', [linkedProject], {})

    expect(props.label).toBe('My Cool Project')
  })
})
