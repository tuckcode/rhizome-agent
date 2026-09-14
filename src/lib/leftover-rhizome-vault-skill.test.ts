import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover rhizome-vault skill label', () => {
  const chatHome = readFileSync(
    `${process.cwd()}/src/components/ChatHome.tsx`,
    'utf8',
  )

  it('locks skillsLabel as the rhizome-vault skill name, not a vault switcher', () => {
    expect(chatHome).toContain('skillsLabel="rhizome-vault"')
  })

  it('keeps composer-vault-pill out of ChatHome', () => {
    expect(chatHome).not.toContain('composer-vault-pill')
  })
})
