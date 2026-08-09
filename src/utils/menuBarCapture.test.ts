import { describe, expect, it } from 'vitest'
import { buildCaptureNote, captureSlug, splitCapture } from './menuBarCapture'

describe('captureSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(captureSlug('Hello World')).toBe('hello-world')
  })
  it('strips punctuation and collapses separators', () => {
    expect(captureSlug('  Foo: Bar!! (baz)  ')).toBe('foo-bar-baz')
  })
  it('falls back to "note" for empty/symbol-only input', () => {
    expect(captureSlug('!!!')).toBe('note')
    expect(captureSlug('')).toBe('note')
  })
})

describe('splitCapture', () => {
  it('uses the first non-empty line as the title, rest as body', () => {
    expect(splitCapture('\n\nTitle here\nline two\nline three')).toEqual({
      title: 'Title here',
      body: 'line two\nline three',
    })
  })
  it('returns empty title for whitespace-only text', () => {
    expect(splitCapture('   \n  ')).toEqual({ title: '', body: '' })
  })
})

describe('buildCaptureNote', () => {
  const now = '2026-07-19T14:30:00.000Z'

  it('writes an inbox note with a date-stamped slug and H1 title', () => {
    const note = buildCaptureNote('My quick thought', null, now)
    expect(note).not.toBeNull()
    expect(note!.path).toBe('raw/inbox/2026-07-19-my-quick-thought.md')
    expect(note!.content).toBe('# My quick thought\n')
  })

  it('adds type frontmatter when a type is selected', () => {
    const note = buildCaptureNote('Ship the thing', 'Task', now)
    expect(note!.content).toBe('---\ntype: Task\n---\n\n# Ship the thing\n')
  })

  it('keeps body lines below the title', () => {
    const note = buildCaptureNote('Title\n\nbody text', null, now)
    expect(note!.content).toBe('# Title\n\nbody text\n')
  })

  it('returns null for empty capture', () => {
    expect(buildCaptureNote('   ', null, now)).toBeNull()
  })
})
