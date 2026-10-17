import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:4178/scripts/model-chip-shots.html'
const outDir = process.argv[3] ?? 'docs/screenshots/223'
mkdirSync(outDir, { recursive: true })

const themes = ['graphite', 'earth-light']
const states = [
  ['cases', null],
  ['short', 'short-tooltip'],
  ['long', 'long-tooltip'],
  ['gemini', 'gemini-tooltip'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 420 } })

for (const theme of themes) {
  for (const [state, fileSuffix] of states) {
    await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    const frame = page.locator('[data-testid="model-chip-shot"]')
    if (fileSuffix) {
      const trigger = page.getByTestId('native-chat-model-trigger')
      await trigger.hover()
      await page.getByTestId('native-chat-model-tooltip').waitFor({ state: 'visible', timeout: 5000 })
      await page.waitForTimeout(350)
    } else {
      await page.waitForTimeout(150)
    }
    const file = path.join(outDir, `${theme}-${fileSuffix ?? 'cases'}.png`)
    await frame.screenshot({ path: file })
    console.log(file)
  }
}

await browser.close()
