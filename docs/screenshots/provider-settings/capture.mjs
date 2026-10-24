import { chromium } from '@playwright/test'

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
})
const shots = [
  ['settings', 'graphite', 'settings-graphite.png', 1280, 1100],
  ['settings', 'earth', 'settings-earth.png', 1280, 1100],
  ['picker', 'graphite', 'picker-graphite.png', 480, 820],
  ['picker', 'earth', 'picker-earth.png', 480, 820],
  ['timeout', 'graphite', 'timeout-graphite.png', 480, 860],
  ['timeout', 'earth', 'timeout-earth.png', 480, 860],
  ['settings-top', 'graphite', 'settings-top-graphite.png', 1280, 1100],
  ['settings-top', 'earth', 'settings-top-earth.png', 1280, 1100],
  ['checking', 'graphite', 'checking-graphite.png', 1280, 1100],
  ['checking', 'earth', 'checking-earth.png', 1280, 1100],
]
for (const [view, theme, name, width, height] of shots) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('pageerror', (error) => console.error(name, error.message))
  const url = `http://127.0.0.1:5199/?view=${view}&theme=${theme}`
  await page.goto(url, { waitUntil: 'networkidle' })
  if (view === 'settings' || view === 'settings-top' || view === 'checking') {
    await page.getByTestId('settings-connected-summary').waitFor({ timeout: 15000 })
    if (view === 'settings') {
      await page.getByTestId('settings-cli-agent-status').evaluate((el) => el.scrollIntoView({ block: 'end' }))
      await page.getByText('Recognized local agents').waitFor({ timeout: 10000 })
    } else if (view === 'checking') {
      await page.getByText('Checking…').first().waitFor({ timeout: 10000 })
      await page.getByTestId('settings-connected-summary').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    } else {
      await page.getByTestId('settings-connected-summary').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    }
    await page.waitForTimeout(400)
    await page.getByRole('dialog').screenshot({ path: `docs/screenshots/provider-settings/${name}` })
  } else if (view === 'picker') {
    await page.getByText('Needs an API key').first().waitFor({ timeout: 10000 })
    await page.getByText('qwen2.5').waitFor({ timeout: 10000 })
    await page.getByText('Vision').first().waitFor({ timeout: 10000 })
    await page.screenshot({ path: `docs/screenshots/provider-settings/${name}` })
  } else {
    await page.getByText("Couldn't load models").first().waitFor({ timeout: 15000 })
    await page.getByText('Vision').first().waitFor({ timeout: 10000 })
    await page.screenshot({ path: `docs/screenshots/provider-settings/${name}` })
  }
  await page.close()
  console.log('wrote', name)
}
await browser.close()
