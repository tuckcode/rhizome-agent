import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/BreadcrumbBar.tsx`,
  'utf8',
)

describe('BreadcrumbBar leftover', () => {
  it('closes an open note with breadcrumb-close-note', () => {
    expect(source).toContain('testId="breadcrumb-close-note"')
  })

  it('keeps Chat note layout on the notes header', () => {
    expect(source).toContain('Chat note layout (On top / Beside)')
  })
})
