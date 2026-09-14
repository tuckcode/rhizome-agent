import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function graphControlsSource(): string {
  return readFileSync(`${process.cwd()}/src/components/graph/GraphControls.tsx`, 'utf8')
}

describe('GraphControls leftover Find box', () => {
  it('keeps the Find box bottom-right', () => {
    const source = graphControlsSource()
    expect(source).toContain(
      'Lives bottom-right as a small Find box so the canvas stays readable.',
    )
    expect(source).toContain('absolute bottom-3 right-3')
  })

  it('uses the Find a note placeholder key', () => {
    const source = graphControlsSource()
    expect(source).toContain("placeholder={t('graph.controls.searchPlaceholder')}")
    expect(source).toContain("aria-label={t('graph.controls.searchPlaceholder')}")
  })
})
