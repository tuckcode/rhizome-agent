// Capture the approval states for ADR-0192.
// Start a Vite server first, for example `pnpm exec vite --port 4178`.
// Usage:
//   node scripts/capture-approval-risk.mjs [suffix] [base-url] [out-dir]
// A suffix of `before` writes `<theme>-<state>-before.png`.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const suffix = process.argv[2] ? `-${process.argv[2]}` : ''
const base = process.argv[3] ?? 'http://127.0.0.1:4178/scripts/audit-chat-shots.html'
const outDir = process.argv[4] ?? 'docs/review-shots/approval-risk'
mkdirSync(outDir, { recursive: true })

const themes = ['graphite', 'earth']
const states = [
  'approval-two',
  'approval-two-open',
  'approval-danger',
  'approval-caution',
  'approval-overwrite',
  'approval-newline',
  'approval-bash',
  'approval-edit',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 780 } })
for (const theme of themes) {
  for (const state of states) {
    await page.goto(`${base}?theme=${theme}&state=${state}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    const file = path.join(outDir, `${theme}-${state}${suffix}.png`)
    await page.locator('[data-testid="audit-chat-shot"] > div').screenshot({ path: file })
    console.log(file)
  }
}
await browser.close()
