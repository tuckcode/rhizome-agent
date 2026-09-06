import { expect, test } from '@playwright/test'
import { installMockAiAgent } from './helpers'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'

// Headless Chromium needs software rendering for the real graph canvas.
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } })

test('a large graph key stays compact and never overlaps the type filters', async ({ page }) => {
  await installMockAiAgent(page)
  await pinNotesShellLaunch(page)
  await page.addInitScript(() => {
    localStorage.setItem('rhizome-view-mode', 'all')
  })
  await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
  await page.goto('/')
  await expect(page.getByTestId('agent-input')).toBeVisible()
  await page.evaluate(() => {
    const handlers = window.__mockHandlers
    if (!handlers) throw new Error('Mock handlers missing')
    handlers.call_rhizome_tool = () => JSON.stringify({
      nodes: Array.from({ length: 30 }, (_, i) => ({
        id: `note-${i}.md`, path: `note-${i}.md`, title: `Note ${i}`,
        isA: `Type ${i}`, ghost: false, snippet: '', modifiedAt: null,
        icon: null, linkCount: 0, backlinkCount: 0,
      })),
      edges: [],
    })
  })
  await page.getByTestId('agent-input').fill('Keep my graph audit draft')
  await expect(page.getByTestId('graph-view')).toBeVisible()
  await page.getByRole('button', { name: 'Expand connections' }).click()
  const toggle = page.getByTestId('graph-legend-toggle')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  for (const size of [{ width: 1500, height: 900 }, { width: 900, height: 600 }]) {
    await page.setViewportSize(size)
    const filters = await page.getByTestId('graph-controls').boundingBox()
    const key = await page.getByTestId('graph-legend').boundingBox()
    expect(filters).not.toBeNull()
    expect(key).not.toBeNull()
    expect(filters!.y + filters!.height).toBeLessThan(key!.y)
    const body = page.getByTestId('graph-legend-body')
    expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
    await body.evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(page.getByTestId('graph-legend-controls')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Return to side panel' }).click()
  await expect(page.getByTestId('agent-input')).toHaveText('Keep my graph audit draft')
})
