import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:4178/scripts/edit-tools-shots.html'
const outDir = process.argv[3] ?? '/opt/cursor/artifacts/edit-tools'
mkdirSync(outDir, { recursive: true })

const shots = [
  ['graphite', 'edit'],
  ['graphite', 'new'],
  ['graphite', 'long'],
  ['earth', 'edit'],
  ['earth', 'new'],
  ['earth', 'long'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 900 } })
for (const [theme, state] of shots) {
  await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
  const file = path.join(outDir, `${theme}-${state}.png`)
  const frame = page.locator('[data-testid="edit-tools-shot"] > div')
  await frame.screenshot({ path: file })
  console.log(file)
}
await browser.close()
