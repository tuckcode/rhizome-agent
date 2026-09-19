import { expect, it } from 'vitest'
import { compactSessionFacts, readableSessionLabel } from './myceliumCompactSummary'

const HISTORY_OPEN = ['<', 'conversation_history', '>'].join('')
const HISTORY_CLOSE = ['</', 'conversation_history', '>'].join('')

it('keeps a plain session name', () => {
  expect(readableSessionLabel('Audit session')).toBe('Audit session')
})

it('uses the latest user turn inside a conversation-history blob', () => {
  const raw = `${HISTORY_OPEN}
[user]: hi

[assistant]: Hi, Atticus.

[user]: hide chat on notes
${HISTORY_CLOSE}

Continue the conversation. Respond only to the latest [user] message.`
  expect(readableSessionLabel(raw)).toBe('hide chat on notes')
})

it('does not keep the history tags in the label', () => {
  const raw = `${HISTORY_OPEN} [user]: hi [assistant]: Hi, Atticus. ${HISTORY_CLOSE}`
  const label = readableSessionLabel(raw)
  expect(label).not.toContain(HISTORY_OPEN)
  expect(label).not.toMatch(/\[assistant]/)
})

it('falls back when the blob is empty', () => {
  expect(readableSessionLabel(` ${HISTORY_OPEN}${HISTORY_CLOSE} `)).toBe('Untitled session')
})

it('counts tools and unique file names', () => {
  expect(compactSessionFacts(['/vault/editor.md', '/vault/notes/plan.md', '/vault/editor.md', undefined])).toEqual({
    toolCount: 4,
    fileCount: 2,
    fileNames: ['editor.md', 'plan.md'],
  })
})
