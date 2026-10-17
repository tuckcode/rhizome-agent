import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:4178/scripts/audit-chat-shots.html'
const outDir = process.argv[3] ?? 'docs/review-shots/audit-chat'
mkdirSync(outDir, { recursive: true })

const shots = [
  ['graphite', 'approval-collapsed-before'],
  ['graphite', 'approval-collapsed'],
  ['graphite', 'approval-bash'],
  ['graphite', 'approval-allow-focus'],
  ['graphite', 'approval-two'],
  ['graphite', 'approval-edit'],
  ['graphite', 'approval-overflow'],
  ['graphite', 'topbar-native'],
  ['graphite', 'header-title'],
  ['graphite', 'header-long'],
  ['graphite', 'empty-before'],
  ['graphite', 'empty'],
  ['earth', 'approval-collapsed-before'],
  ['earth', 'approval-collapsed'],
  ['earth', 'approval-bash'],
  ['earth', 'approval-allow-focus'],
  ['earth', 'approval-two'],
  ['earth', 'approval-edit'],
  ['earth', 'approval-overflow'],
  ['earth', 'topbar-native'],
  ['earth', 'header-title'],
  ['earth', 'header-long'],
  ['earth', 'empty-before'],
  ['earth', 'empty'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 780 } })
for (const [theme, state] of shots) {
  await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  if (state === 'approval-allow-focus') {
    await page.locator('[data-testid="approval-allow_once"]').waitFor()
    await page.locator('[data-testid="approval-allow_once"]').focus()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(200)
  const file = path.join(outDir, `${theme}-${state}.png`)
  const frame = page.locator('[data-testid="audit-chat-shot"] > div')
  await frame.screenshot({ path: file })
  console.log(file)
}
await browser.close()
