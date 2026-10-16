import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:4178/scripts/notes-panel-modes-shots.html'
const outDir = process.argv[3] ?? '/opt/cursor/artifacts/notes-panel-modes'
mkdirSync(outDir, { recursive: true })

const shots = [
  ['graphite', 'rail'],
  ['graphite', 'hover'],
  ['graphite', 'open'],
  ['graphite', 'narrow'],
  ['earth', 'rail'],
  ['earth', 'hover'],
  ['earth', 'open'],
  ['earth', 'narrow'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
for (const [theme, state] of shots) {
  if (state === 'narrow') await page.setViewportSize({ width: 640, height: 720 })
  else await page.setViewportSize({ width: 1100, height: 720 })
  await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const file = path.join(outDir, `${theme}-${state}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(file)
}
await browser.close()
