// Capture the main screens of the app in both themes.
// Start `pnpm dev` first. Usage:
//   node scripts/capture-ux-baseline.mjs [base-url] [out-dir]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:5202/'
const outDir = process.argv[3] ?? 'docs/review-shots/ux-baseline'
mkdirSync(outDir, { recursive: true })

const themes = [
  ['graphite', 'dark'],
  ['earth', 'light'],
]

async function freshProfile(page, defaultVaultExists) {
  await page.addInitScript((defaultVaultExists) => {
    localStorage.setItem('tolaria:ai-agents-onboarding-dismissed', '1')
    localStorage.setItem('tolaria:claude-code-onboarding-dismissed', '1')
    const override = (handlers) => {
      if (!handlers) return handlers
      const getSettings = handlers.get_settings
      handlers.get_settings = () => ({
        ...(typeof getSettings === 'function' ? getSettings() : {}),
        telemetry_consent: null,
        crash_reporting_enabled: null,
        analytics_enabled: null,
        anonymous_id: null,
      })
      handlers.load_vault_list = () => ({ vaults: [], active_vault: null, hidden_defaults: [] })
      handlers.get_default_vault_path = () => '/Users/mock/Documents/Rhizome'
      handlers.check_vault_exists = () => defaultVaultExists
      return handlers
    }
    let ref = override(window.__mockHandlers) ?? null
    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) { ref = override(value) ?? null },
      get() { return override(ref) ?? ref },
    })
  }, defaultVaultExists)
}

async function shot(page, theme, name) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const file = path.join(outDir, `${theme}-${name}.png`)
  await page.screenshot({ path: file })
  console.log(file)
}

async function step(label, action) {
  try {
    await action()
  } catch (error) {
    console.warn(`skipped ${label}: ${String(error).split('\n')[0]}`)
  }
}

const browser = await chromium.launch()
for (const [theme, mode] of themes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript((value) => {
    localStorage.setItem('rhizome-theme', value)
  }, mode)

  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'networkidle' })
  await shot(page, theme, 'chat-empty')

  await step('chat reply', async () => {
    await page.getByRole('button', { name: /^Open session/ }).first().click()
    const composer = page.locator('[contenteditable="true"]').first()
    await composer.click()
    await page.keyboard.type('List the notes in this vault')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Copy response' }).waitFor({ timeout: 8000 })
    await shot(page, theme, 'chat-reply')
  })

  await step('notes panel', async () => {
    await page.getByRole('button', { name: 'All Notes' }).click()
    await page.waitForTimeout(1500)
    await shot(page, theme, 'notes-panel')
    await page.getByRole('button', { name: 'Quick Meeting 1' }).first().click()
    await page.waitForTimeout(1500)
    await shot(page, theme, 'note-open')
  })

  await step('graph', async () => {
    await page.getByRole('button', { name: 'Graph', exact: true }).click()
    await page.waitForTimeout(3500)
    await shot(page, theme, 'graph')
    await page.keyboard.press('Escape')
  })

  await step('settings', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await shot(page, theme, 'settings')
    await page.getByRole('dialog').getByText('AI Agents', { exact: true }).first().click()
    await page.waitForTimeout(600)
    await shot(page, theme, 'settings-ai')
  })
  await page.close()

  for (const [name, defaultVaultExists] of [['first-run', true], ['first-run-no-default-vault', false]]) {
    const fresh = await context.newPage()
    await freshProfile(fresh, defaultVaultExists)
    await fresh.goto(base, { waitUntil: 'networkidle' })
    await fresh.waitForTimeout(1500)
    await shot(fresh, theme, `${name}-1`)
    await step(`${name} welcome`, async () => {
      await fresh.getByTestId('telemetry-decline').click({ timeout: 3000 })
      await fresh.getByTestId('welcome-screen').waitFor({ timeout: 5000 })
      await shot(fresh, theme, `${name}-2-welcome`)
    })
    await fresh.close()
  }
  await context.close()
}
await browser.close()
