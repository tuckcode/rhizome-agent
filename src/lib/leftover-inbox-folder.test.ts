import { describe, expect, it } from 'vitest'
import { readAppShellSource } from '../test-utils/appShellSource'

describe('leftover inbox folder', () => {
  it('locks showInbox={explicitOrganizationEnabled} in App', () => {
    const app = readAppShellSource()
    expect(app).toContain('showInbox={explicitOrganizationEnabled}')
  })
})
