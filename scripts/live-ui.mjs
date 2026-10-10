#!/usr/bin/env node
/**
 * Prints the running app as text, so an agent can read it instead of looking
 * at screenshots of it (#50).
 *
 * Native screenshots need macOS Screen Recording and Accessibility grants,
 * and every rebuild drops them. This reads the browser build (`pnpm dev`)
 * through headless Playwright instead: no OS permission is involved.
 *
 * For each screen it prints the `auditUi` layout findings, every scroll well
 * (does it scroll, or does it hide content it cannot scroll to), every
 * visible control with its size, and console errors. Read-only: it changes
 * screens through the rail, and it never types or edits.
 *
 * It does not start the dev server. Start one first:
 *
 *   pnpm dev                          # serves http://localhost:5202
 *   pnpm live-ui                      # every screen
 *   pnpm live-ui --screen chat        # one screen
 *   BASE_URL=http://localhost:5201 pnpm live-ui
 *
 * A report, not a gate: it exits 0 when it finds problems.
 * `tests/smoke/ui-audit.spec.ts` stays the gate.
 *
 * Exit codes: 0 report printed, 1 no Rhizome dev app at BASE_URL (nothing
 * answered, another server answered, or the dev app runs older code), 2 bad
 * arguments.
 */
import { chromium } from '@playwright/test'

const BASE_URL = (process.env.BASE_URL || 'http://localhost:5202').replace(/\/+$/u, '')
const VIEWPORT = { width: 1440, height: 900 }
/** Same as `playwright.config.ts`, so first-run onboarding does not cover the app. */
const ONBOARDING_DISMISSED_KEY = 'tolaria:claude-code-onboarding-dismissed'
/** The same screens `tests/smoke/ui-audit.spec.ts` walks. */
const SCREENS = [
  { name: 'chat' },
  { name: 'research', testId: 'status-research' },
  { name: 'changes', testId: 'sidebar-top-nav', buttonName: 'Changes' },
]
/** A half-rendered screen reports collisions that resolve a frame later. */
const SETTLE_MS = 600
const WELL_ORDER = { clipped: 0, 'no-overflow': 1, scrolls: 2 }

function usage() {
  return `Usage: pnpm live-ui [--screen <${SCREENS.map((screen) => screen.name).join('|')}>]`
}

function fail(code, message) {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

function parseArgs(argv) {
  const args = { screens: SCREENS }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${usage()}\n`)
      process.exit(0)
    }
    if (arg !== '--screen') fail(2, `Unknown argument "${arg}".\n${usage()}`)
    const name = argv[index + 1]
    const screen = SCREENS.find((candidate) => candidate.name === name)
    if (!screen) fail(2, `Unknown screen "${name ?? ''}".\n${usage()}`)
    args.screens = [screen]
    index += 1
  }
  return args
}

async function requireDevApp() {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(3_000) })
  } catch {
    fail(
      1,
      [
        `Nothing answered at ${BASE_URL}.`,
        'pnpm live-ui reads a dev app that is already running. It does not start one.',
        'Start it in another terminal with: pnpm dev',
        'That serves http://localhost:5202. For another port, set BASE_URL, for example:',
        '  BASE_URL=http://localhost:5201 pnpm live-ui',
      ].join('\n'),
    )
  }
}

async function openScreen(page, screen) {
  if (!screen.testId) return true
  const opener = screen.buttonName
    ? page.getByTestId(screen.testId).getByRole('button', { name: screen.buttonName, exact: true })
    : page.getByTestId(screen.testId)
  if (!(await opener.count())) return false
  await opener.first().click()
  await page.waitForTimeout(SETTLE_MS)
  return true
}

/**
 * Fails clearly when the page cannot run the snapshot: a server that is not
 * the Rhizome dev app, or a dev app started from a checkout older than this
 * script (another worktree, or a branch before #50).
 */
async function requireSnapshotModule(page) {
  const status = await page.evaluate(async () => {
    try {
      const module = await import('/src/utils/uiAudit.ts')
      return typeof module.snapshotUi === 'function' ? 'ok' : 'old'
    } catch {
      return 'missing'
    }
  })
  if (status === 'missing') {
    fail(
      1,
      `${BASE_URL} answered, but it is not the Rhizome dev app: /src/utils/uiAudit.ts did not load.\n` +
        'Start the dev app from this checkout with: pnpm dev',
    )
  }
  if (status === 'old') {
    fail(
      1,
      `The dev app at ${BASE_URL} runs code without snapshotUi, so it is older than this script.\n` +
        'It may run from another worktree or branch. Restart pnpm dev from this checkout.',
    )
  }
}

/** Imported from the dev server, as the audit spec does, so it is the module the app ships. */
function readScreen(page) {
  return page.evaluate(async () => {
    const module = await import('/src/utils/uiAudit.ts')
    return { findings: module.auditUi(), snapshot: module.snapshotUi() }
  })
}

function testIdTag(testId) {
  return testId ? ` [${testId}]` : ''
}

function section(title, lines) {
  return [`### ${title}`, ...(lines.length ? lines : ['(none)']), '']
}

function formatScreen(screen, opened, { findings, snapshot }, errors) {
  const wells = [...snapshot.wells].sort((a, b) => WELL_ORDER[a.reason] - WELL_ORDER[b.reason])
  return [
    `## Screen: ${screen.name}`,
    ...(opened ? [] : ['Could not open this screen from the rail. This is the screen that was showing.']),
    '',
    ...section(
      'Layout findings',
      findings.map((finding) => `- ${finding.rule}: ${finding.label}${testIdTag(finding.testId)} — ${finding.detail}`),
    ),
    ...section(
      'Scroll wells',
      wells.map(
        (well) =>
          `- well ${well.label}${testIdTag(well.testId)} ${well.width}x${well.height} overflow-y: ${well.overflowY} ` +
          `scrollHeight=${well.scrollHeight} clientHeight=${well.clientHeight} canScroll=${well.canScroll} (${well.reason})`,
      ),
    ),
    ...section(
      `Controls (${snapshot.controls.length})`,
      snapshot.controls.map(
        (control) =>
          `- ${control.role} "${control.label}"${testIdTag(control.testId)} ${control.width}x${control.height} at ${control.x},${control.y}`,
      ),
    ),
    ...section('Console errors', errors),
  ].join('\n')
}

async function main() {
  const { screens } = parseArgs(process.argv.slice(2))
  await requireDevApp()

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      storageState: {
        cookies: [],
        origins: [{ origin: new URL(BASE_URL).origin, localStorage: [{ name: ONBOARDING_DISMISSED_KEY, value: '1' }] }],
      },
    })
    const page = await context.newPage()
    let errors = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`- ${message.text()}`)
    })
    page.on('pageerror', (error) => errors.push(`- uncaught: ${error.message}`))

    await page.goto(BASE_URL)
    await requireSnapshotModule(page)
    await page
      .getByTestId('chat-center')
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {})

    const blocks = [`# Live UI: ${BASE_URL} at ${VIEWPORT.width}x${VIEWPORT.height}`, '']
    for (const screen of screens) {
      const opened = await openScreen(page, screen)
      const read = await readScreen(page)
      blocks.push(formatScreen(screen, opened, read, errors))
      errors = []
    }
    process.stdout.write(`${blocks.join('\n')}\n`)
  } finally {
    await browser.close()
  }
}

await main()
