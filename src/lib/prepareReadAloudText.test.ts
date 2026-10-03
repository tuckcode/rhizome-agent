import { describe, expect, it } from 'vitest'
import { prepareReadAloudText, splitReadAloudText } from './prepareReadAloudText'

describe('prepareReadAloudText', () => {
  it('speaks prose and drops markup that should not be read', () => {
    const spoken = prepareReadAloudText([
      '# Title',
      '',
      'See [the note](https://example.com) and **bold** `code`.',
      '',
      '```ts',
      'const hidden = true',
      '```',
      '',
      '| Name | Kind |',
      '| --- | --- |',
      '| Ada | Note |',
      '',
      'Citation [1] and a [note] stay.',
      'A stray [laugh] does not.',
      '<whisper>quiet words</whisper>',
    ].join('\n'))

    expect(spoken).toContain('Title')
    expect(spoken).toContain('the note')
    expect(spoken).not.toContain('https://example.com')
    expect(spoken).toContain('bold')
    expect(spoken).toContain('code')
    expect(spoken).toContain('[pause] Code block omitted.')
    expect(spoken).not.toContain('const hidden')
    expect(spoken).toContain('Ada Note.')
    expect(spoken).not.toContain('---')
    expect(spoken).toContain('[1]')
    expect(spoken).toContain('[note]')
    expect(spoken).not.toContain('[laugh]')
    expect(spoken).toContain('quiet words')
    expect(spoken).not.toContain('<whisper>')
  })

  it('splits a long reply on paragraph boundaries', () => {
    const paragraph = 'Word '.repeat(40).trim()
    const source = [paragraph, paragraph, paragraph].join('\n\n')
    const parts = splitReadAloudText(source, 100)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((part) => part.length <= 100)).toBe(true)
    expect(parts.join(' ')).toContain('Word')
  })
})
