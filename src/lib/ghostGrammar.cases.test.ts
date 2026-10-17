import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { suggestReply } from './replySuggestions'

const root = `${process.cwd()}/src/lib/ghostCases`
const files = [
  'cases245c_7279.json',
  'cases245d_9d6d.json',
  'cases245e_7c21.json',
  'cases245f_53e7.json',
] as const

const expected = JSON.parse(readFileSync(`${root}/expected.json`, 'utf8')) as Record<
  string,
  { phrase: string; ghost: string | null }[]
>

function ghostOf(phrase: string): string | null {
  const result = suggestReply(phrase)
  if (!result) return null
  return result.kind === 'completion' ? result.text : null
}

describe('closed ghost grammar cases', () => {
  for (const file of files) {
    const rows = expected[file] ?? []
    it.each(rows.map((row) => [row.phrase, row.ghost] as const))(
      `${file} %j → %j`,
      (phrase, ghost) => {
        expect(ghostOf(phrase)).toBe(ghost)
      },
    )
  }
})
