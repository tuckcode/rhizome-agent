import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:4179/scripts/run-command-shots.html'
const outDir = process.argv[3] ?? '/opt/cursor/artifacts/run-command'
mkdirSync(outDir, { recursive: true })

const shots = [
  ['graphite', 'approval-short'],
  ['graphite', 'approval-long'],
  ['graphite', 'result-ok'],
  ['graphite', 'result-expanded'],
  ['graphite', 'result-failed'],
  ['graphite', 'result-timed-out'],
  ['graphite', 'result-truncated'],
  ['earth', 'approval-short'],
  ['earth', 'approval-long'],
  ['earth', 'result-ok'],
  ['earth', 'result-expanded'],
  ['earth', 'result-failed'],
  ['earth', 'result-timed-out'],
  ['earth', 'result-truncated'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 1100 } })
for (const [theme, state] of shots) {
  await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
  const file = path.join(outDir, `${theme}-${state}.png`)
  const frame = page.locator('[data-testid="run-command-shot"] > div')
  await frame.screenshot({ path: file })
  console.log(file)
}
await browser.close()
