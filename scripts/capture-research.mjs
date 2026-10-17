import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:4178/scripts/research-shots.html'
const outDir = process.argv[3] ?? '/opt/cursor/artifacts/audit-research'
mkdirSync(outDir, { recursive: true })

const shots = [
  ['graphite', 'empty'],
  ['graphite', 'depth-open'],
  ['graphite', 'error'],
  ['graphite', 'error-details'],
  ['graphite', 'retry-focus'],
  ['earth', 'empty'],
  ['earth', 'depth-open'],
  ['earth', 'error'],
  ['earth', 'error-details'],
  ['earth', 'retry-focus'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 860 } })
for (const [theme, state] of shots) {
  await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  if (state === 'empty' || state === 'depth-open') {
    await page.getByTestId('research-generate-empty').waitFor()
  } else {
    await page.getByTestId('research-library-scan-error').waitFor()
  }
  if (state === 'depth-open') {
    await page.getByTestId('research-generate-depth').click()
    await page.getByText('Typical coverage for most repos').waitFor()
  }
  if (state === 'error-details') {
    await page.getByRole('button', { name: 'Details' }).click()
    await page.getByText('ENOENT: library root is missing').waitFor()
  }
  if (state === 'retry-focus') {
    await page.waitForFunction(() => (
      document.activeElement?.getAttribute('data-testid') === 'research-library-scan-retry'
    ))
  }
  await page.waitForTimeout(200)
  const file = path.join(outDir, `${theme}-${state}.png`)
  await page.screenshot({ path: file, animations: 'disabled' })
  console.log(file)
}
await browser.close()
