import { test, expect } from '@playwright/test'

test.describe('Focus event does not freeze the UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('window focus event completes without blocking UI for >500ms', async ({ page }) => {
    // Verify the app loaded
    await expect(page.locator('[data-testid="sidebar"]').or(page.locator('nav')).first()).toBeVisible()

    // Measure how long the UI is blocked after a focus event.
    // We dispatch focus, then immediately schedule a rAF callback.
    // If the main thread is blocked (sync IPC), the rAF callback is delayed.
    const blockMs = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const t0 = performance.now()
        window.dispatchEvent(new Event('focus'))
        requestAnimationFrame(() => {
          resolve(performance.now() - t0)
        })
      })
    })

    // The focus handler must not block the main thread for more than 500ms.
    // Before the fix, git_pull ran synchronously and blocked for 2-3 seconds.
    expect(blockMs).toBeLessThan(500)
  })

  test('rapid focus events (5x) do not accumulate freezes', async ({ page }) => {
    await expect(page.locator('[data-testid="sidebar"]').or(page.locator('nav')).first()).toBeVisible()

    const totalMs = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const t0 = performance.now()
        for (let i = 0; i < 5; i++) {
          window.dispatchEvent(new Event('focus'))
        }
        requestAnimationFrame(() => {
          resolve(performance.now() - t0)
        })
      })
    })

    // 5 rapid focus events should still complete in under 500ms total
    // thanks to the cooldown preventing redundant work.
    expect(totalMs).toBeLessThan(500)
  })
})
