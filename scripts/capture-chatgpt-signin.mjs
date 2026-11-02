import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:4178/scripts/chatgpt-signin-shots.html'
const outDir = process.argv[3] ?? 'docs/review-shots/chatgpt-signin'
mkdirSync(outDir, { recursive: true })

const shots = [
  ['graphite-connected', 'graphite', 'connected'],
  ['graphite-connected-signed-in', 'graphite', 'connected-signed-in'],
  ['graphite-picker', 'graphite', 'picker'],
  ['graphite-signed-in', 'graphite', 'signed-in'],
  ['earth-connected', 'earth', 'connected'],
  ['earth-connected-signed-in', 'earth', 'connected-signed-in'],
  ['earth-picker', 'earth', 'picker'],
  ['earth-signed-in', 'earth', 'signed-in'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 560, height: 1100 } })

for (const [name, theme, state] of shots) {
  await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.locator('[data-testid="chatgpt-signin-shot"]').waitFor()
  if (state === 'connected' || state === 'connected-signed-in') {
    await page.getByTestId('settings-connected-row-account:openai').waitFor({ timeout: 10000 })
    if (state === 'connected-signed-in') {
      await page.getByTestId('settings-connected-email-account:openai').waitFor({ timeout: 10000 })
    }
    await page.getByTestId('settings-connected-section-free').waitFor({ timeout: 10000 })
    await page.getByTestId('settings-connected-row-provider:free_tier').waitFor({ timeout: 10000 })
  } else {
    const trigger = page.getByTestId('native-chat-model-trigger')
    await trigger.waitFor()
    await trigger.dispatchEvent('pointerdown')
    await page.getByTestId('native-chat-model-menu').waitFor({ state: 'visible', timeout: 10000 })
    await page.evaluate(() => {
      const menu = document.querySelector('[data-testid="native-chat-model-menu"]')
      if (menu) menu.scrollTop = 0
    })
    if (state === 'signed-in') {
      await page.getByTestId('native-chat-model-sign-out').waitFor({ timeout: 10000 })
    } else {
      await page.getByTestId('native-chat-model-sign-in').first().waitFor({ timeout: 10000 })
    }
    await page.getByText('Taproot', { exact: true }).first().waitFor({ timeout: 10000 })
    await page.getByText('Free tier', { exact: true }).first().waitFor({ timeout: 10000 })
  }
  await page.waitForTimeout(250)
  const file = path.join(outDir, `${name}.png`)
  if (state === 'connected' || state === 'connected-signed-in') {
    await page.locator('[data-testid="chatgpt-signin-shot"]').screenshot({ path: file })
  } else {
    // Menu content portals to body; capture the full viewport so accounts + Free/Taproot stay in frame.
    await page.screenshot({ path: file, fullPage: true })
  }
  console.log(file)
}

await browser.close()
