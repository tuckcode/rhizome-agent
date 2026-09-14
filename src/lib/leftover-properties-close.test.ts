import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/BreadcrumbBar.tsx`,
  'utf8',
)

describe('leftover Properties is not Close', () => {
  it('opens Properties from the breadcrumb, not Close', () => {
    expect(source).toContain(
      "label: translate(locale, 'editor.toolbar.openProperties')",
    )
  })
})
