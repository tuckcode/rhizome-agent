import { test, expect } from '@playwright/test'
import { installMockAiAgent } from './helpers'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'

/**
 * Regression: the chat transcript grew instead of scrolling, and a long Prime
 * session painted straight over the composer.
 *
 * The scroller is `flex-1 overflow-y-auto`, but its parent was a plain block
 * div — `flex-1` is inert outside a flex container, so the scroller sized to
 * its content and `overflow-y-auto` had nothing to overflow. Measured on the
 * live app: 3 000px of transcript produced `clientHeight === scrollHeight`,
 * a bottom edge 2 300px below the viewport, and scrolling that did nothing at
 * all.
 *
 * This has to be a layout test. jsdom computes no box sizes, so every unit
 * test in the suite passed throughout — the failure only exists once something
 * lays the page out. Asserting the geometry rather than the class list keeps
 * it honest about *what broke*: a transcript taller than its room must
 * scroll inside its box, not push the page around.
 */
test.describe('Chat transcript scrolls instead of growing', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAiAgent(page)
    await pinNotesShellLaunch(page)
    await page.goto('/')
    await expect(page.getByTestId('chat-center')).toBeVisible({ timeout: 5000 })
  })

  test('keeps a very tall transcript inside its own scroll box', async ({ page }) => {
    const geometry = await page.evaluate(() => {
      const scroller = [...document.querySelectorAll('div')].find(
        (node) =>
          node.className?.toString().includes('overflow-y-auto') &&
          node.className.toString().includes('flex-1'),
      )
      if (!scroller) return null

      // Stand in for a long session. The cause is the CSS chain, not the
      // markdown, so filler is the deterministic way to make it tall.
      const filler = document.createElement('div')
      filler.style.height = '3000px'
      scroller.appendChild(filler)

      const rect = scroller.getBoundingClientRect()
      const measured = {
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        bottom: Math.round(rect.bottom),
        viewportHeight: window.innerHeight,
      }
      filler.remove()
      return measured
    })

    expect(geometry, 'transcript scroller should exist').not.toBeNull()
    const { scrollHeight, clientHeight, bottom, viewportHeight } = geometry!

    // The whole bug in one line: the box must stay short while its content
    // gets tall.
    expect(clientHeight).toBeLessThan(scrollHeight)

    // And it must stay on screen. When this regressed the bottom edge sat
    // thousands of pixels below the fold, which is what put the transcript on
    // top of the composer.
    expect(bottom).toBeLessThanOrEqual(viewportHeight)
  })
})
