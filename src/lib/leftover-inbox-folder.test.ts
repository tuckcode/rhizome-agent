import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover inbox folder', () => {
  it('locks showInbox={explicitOrganizationEnabled} in App', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain('showInbox={explicitOrganizationEnabled}')
  })
})
