import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover rhizome-ship three verbs', () => {
  const skill = readFileSync(
    `${process.cwd()}/.cursor/skills/rhizome-ship/SKILL.md`,
    'utf8',
  )

  it('locks commit, push, and rebuild as numbered headings', () => {
    expect(skill).toContain('## 1. commit')
    expect(skill).toContain('## 2. push')
    expect(skill).toContain('## 3. rebuild')
  })

  it('never invents a fourth verb', () => {
    expect(skill).toContain('Never invent a fourth verb')
    const numberedVerbs = skill.match(/^## \d+\. .+$/gm) ?? []
    expect(numberedVerbs).toEqual([
      '## 1. commit',
      '## 2. push',
      '## 3. rebuild',
    ])
  })
})
