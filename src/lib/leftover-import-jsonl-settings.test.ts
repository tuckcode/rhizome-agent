import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/SessionImportSettingsSection.tsx`,
  'utf8',
)

describe('leftover import jsonl settings', () => {
  it('locks the Import to vault button label', () => {
    expect(source).toContain('Import to vault')
  })

  it('locks the comment that import_jsonl replaces the active session', () => {
    expect(source).toContain(
      'not — `import_jsonl` replaces the active session',
    )
  })
})
