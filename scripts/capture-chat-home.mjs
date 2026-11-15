// Capture the new-chat screen and the empty-session notice.
// Usage: node scripts/capture-chat-home.mjs <base-url> [suffix] [out-dir]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:4180/'
const suffix = process.argv[3] ? `-${process.argv[3]}` : ''
const outDir = process.argv[4] ?? 'docs/review-shots/chat-home'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
for (const [theme, mode] of [['graphite', 'dark'], ['earth', 'light']]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript((value) => localStorage.setItem('rhizome-theme', value), mode)
  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByTestId('ai-panel-empty-state').waitFor({ timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  // The mock vault lists its notes after the first reload. A sent message
  // causes that reload, so send one and then start a new chat.
  await page.getByRole('button', { name: /^Open session/ }).first().click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, `${theme}-empty-session${suffix}.png`) })
  await page.locator('[contenteditable="true"]').first().click()
  await page.keyboard.type('hello')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Quick Meeting 1' }).first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'New chat' }).first().click()
  await page.getByTestId('ai-panel-empty-state').waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, `${theme}-new-chat${suffix}.png`) })
  console.log(theme)
  await context.close()
}
await browser.close()
