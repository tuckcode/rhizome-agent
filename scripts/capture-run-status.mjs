// Capture the run status line states for ADR-0193.
// Start a Vite server first, for example `pnpm exec vite --port 4179`.
// Usage: node scripts/capture-run-status.mjs [base-url] [out-dir]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:4179/scripts/run-status-shots.html'
const outDir = process.argv[3] ?? 'docs/review-shots/run-status'
mkdirSync(outDir, { recursive: true })

const themes = ['graphite', 'earth']
// Milliseconds that the page clock moves forward before the screenshot.
const states = [
  ['idle', 0],
  ['thinking', 0],
  ['writing', 0],
  ['tool', 7000],
  ['approval', 0],
  ['quiet', 31000],
  ['capped', 0],
  ['failed', 0],
]

const browser = await chromium.launch()
for (const theme of themes) {
  for (const [state, forward] of states) {
    const page = await browser.newPage({ viewport: { width: 800, height: 520 } })
    await page.clock.install()
    await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    if (forward > 0) await page.clock.runFor(forward)
    await page.clock.runFor(300)
    const file = path.join(outDir, `${theme}-${state}.png`)
    await page.locator('[data-testid="run-status-shot"] > div').screenshot({ path: file })
    console.log(file)
    await page.close()
  }
}
await browser.close()
