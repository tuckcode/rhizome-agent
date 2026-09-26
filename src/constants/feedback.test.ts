import { describe, expect, it } from 'vitest'
import { RHIZOME_DOCS_URL, RHIZOME_FIRST_LAUNCH_DOCS_URL, RHIZOME_PRODUCT_BOARD_URL } from './feedback'

/**
 * Contribute / Report a bug / first-launch docs must lead to this repo.
 * They pointed at knispo/rhizome-desktop, a different product (see
 * docs/IDENTITY.md), so public users would have filed issues there.
 */
describe('feedback links', () => {
  it('point at tuckcode/rhizome-agent, not Rhizome Desktop or Tolaria', () => {
    for (const url of [RHIZOME_DOCS_URL, RHIZOME_FIRST_LAUNCH_DOCS_URL, RHIZOME_PRODUCT_BOARD_URL]) {
      expect(url.startsWith('https://github.com/tuckcode/rhizome-agent')).toBe(true)
      expect(url).not.toMatch(/rhizome-desktop|tolaria|refactoringhq/)
    }
    expect(RHIZOME_PRODUCT_BOARD_URL).toBe('https://github.com/tuckcode/rhizome-agent/issues')
  })
})
