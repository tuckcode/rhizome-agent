import { test, expect } from '@playwright/test'
import { executeCommand, openCommandPalette } from './helpers'

test('commit flow stays local when the active vault has no remote @smoke', async ({ page }) => {
  await page.addInitScript(() => {
    type Handler = (args?: Record<string, unknown>) => unknown
    type BrowserWindow = Window & typeof globalThis & {
      __gitPushCalls?: number
      __mockHandlers?: Record<string, Handler>
      __mockHandlersRef?: Record<string, Handler> | null
    }

    const browserWindow = window as BrowserWindow

    const applyOverrides = (handlers?: Record<string, Handler> | null) => {
      if (!handlers) return handlers ?? null

      handlers.git_remote_status = () => ({ branch: 'main', ahead: 0, behind: 0, hasRemote: false })
      handlers.git_push = () => {
        browserWindow.__gitPushCalls = (browserWindow.__gitPushCalls ?? 0) + 1
        return { status: 'ok', message: 'Pushed to remote' }
      }

      return handlers
    }

    browserWindow.__gitPushCalls = 0

    let ref = applyOverrides(browserWindow.__mockHandlers) ?? null
    Object.defineProperty(browserWindow, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = applyOverrides(value as Record<string, Handler> | undefined) ?? null
      },
      get() {
        return applyOverrides(ref) ?? ref
      },
    })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('status-no-remote')).toContainText('No remote')

  await openCommandPalette(page)
  await executeCommand(page, 'Commit & Push')

  await expect(page.getByRole('heading', { name: 'Commit' })).toBeVisible()
  await expect(page.getByText(/local commit only/i)).toBeVisible()

  await page.locator('textarea[placeholder="Commit message..."]').fill('test local commit')
  await page.getByRole('button', { name: 'Commit' }).click()

  await expect(page.locator('.fixed.bottom-8')).toContainText('Committed locally', { timeout: 5000 })
  await expect.poll(async () =>
    page.evaluate(() => (window as Window & { __gitPushCalls?: number }).__gitPushCalls ?? 0),
  ).toBe(0)
})
