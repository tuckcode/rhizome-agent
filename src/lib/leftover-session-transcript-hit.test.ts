import { describe, expect, it } from 'vitest'
import { readAppShellSource } from '../test-utils/appShellSource'

const app = readAppShellSource()

describe('leftover session transcript hit open', () => {
  it('wires app search hits into the live chat at the message index', () => {
    expect(app).toContain('onSelectSessionHit=')
    expect(app).toContain('requestOpenSessionTranscriptHit')
    expect(app).toContain('handleRailSelectChat()')
  })
})
