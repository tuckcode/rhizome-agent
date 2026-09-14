import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover untitled session en string', () => {
  it('locks Untitled session on the existing key', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(en).toContain('"ai.sessions.untitled": "Untitled session"')
  })

  it('reads that key through t in PrimeSessionList', () => {
    const list = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionList.tsx`,
      'utf8',
    )
    expect(list).toContain("const untitled = t('ai.sessions.untitled')")
  })
})
