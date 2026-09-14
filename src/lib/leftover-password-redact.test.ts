import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/sensitiveTextRedaction.ts`,
  'utf8',
)

describe('leftover password redact', () => {
  it('locks the comment that redaction replaces credential-shaped tokens only', () => {
    expect(source).toContain('Replace credential-shaped tokens only')
  })
})
