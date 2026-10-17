import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:5173/scripts/history-commit-title-shots.html'
const outDir = process.argv[3] ?? 'docs/review-shots/history-commit-title'
mkdirSync(outDir, { recursive: true })

const shots = [
  ['before-history-hover', 'graphite', 'history', 'hover'],
  ['after-history-hover', 'graphite', 'history', 'hover'],
  ['after-history-focus', 'graphite', 'history', 'focus'],
  ['after-inspector-hover', 'graphite', 'inspector', 'hover'],
  ['earth-after-history-hover', 'earth', 'history', 'hover'],
  ['earth-after-history-focus', 'earth', 'history', 'focus'],
  ['earth-after-inspector-hover', 'earth', 'inspector', 'hover'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 560 } })

for (const [name, theme, surface, interaction] of shots) {
  if (name.includes('before-') && process.env.SHOT_PHASE === 'after') continue
  if (!name.includes('before-') && process.env.SHOT_PHASE === 'before') continue

  await page.goto(`${base}?theme=${theme}&surface=${surface}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.getByText('Update project notes').first().waitFor()

  const row = page.getByRole('button', { name: /Update project notes/ }).first()
  if (interaction === 'focus') {
    await row.focus()
  } else {
    await row.hover()
  }
  await page.waitForTimeout(250)

  const file = path.join(outDir, `${name}.png`)
  await page.locator('[data-testid="history-commit-title-shot"]').screenshot({ path: file })
  console.log(file)
}

await browser.close()
