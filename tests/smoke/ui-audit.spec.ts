import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { installMockAiAgent } from './helpers'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'
import type { UiAuditFinding } from '../../src/utils/uiAudit'

/**
 * Walks every screen and checks it for the defects that do not need an eye:
 * controls styled as pressable that are not, two controls a user would read
 * as the same thing, targets too small to hit, and controls drawn on top of
 * each other.
 *
 * It exists because every one of those was found the slow way first — the
 * user pointing at a screenshot, or me measuring one element after a report.
 * Each is a property of the rendered page, so noticing them should not depend
 * on anyone remembering to look.
 *
 * **Viewport matters.** The same sweep at 800x450 reported eleven overlapping
 * controls that do not exist at 1440x900; a cramped window makes real layouts
 * collide. Auditing at a toy size invents bugs.
 *
 * **Baseline, not zero.** `tests/ui-audit-baseline.json` lists what is known
 * and unresolved — today, three duplicate labels that are a design question.
 * The sweep fails on anything *new*. A lane that is red on day one gets
 * ignored, which is the failure this whole exercise is about.
 *
 * Untagged, so it runs in the regression lane rather than the 5-minute smoke
 * lane.
 */

const BASELINE: Record<string, string[]> = JSON.parse(
  readFileSync(fileURLToPath(new URL('../ui-audit-baseline.json', import.meta.url)), 'utf8'),
)

/** The rail and the sessions column are on every screen, so their findings
 *  are too. Listing them once beats repeating them per screen and drifting. */
const SHARED = BASELINE._shared ?? []

const SCREENS = [
  { name: 'chat', testId: 'command-rail-chat' },
  { name: 'research', testId: 'command-rail-research' },
  { name: 'changes', testId: 'command-rail-changes' },
] as const

/** `rule: label`, which is what the baseline stores — stable across runs in a
 *  way a pixel count is not. */
function signature(finding: UiAuditFinding): string {
  return `${finding.rule}: ${finding.label}`
}

async function auditCurrentScreen(page: import('@playwright/test').Page) {
  // Imported from the dev server rather than injected, so the sweep always
  // runs the same module the app ships and cannot drift from it.
  return page.evaluate(async () => {
    const module = await import('/src/utils/uiAudit.ts')
    return module.auditUi()
  }) as Promise<UiAuditFinding[]>
}

test.describe('UI audit', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAiAgent(page)
    await pinNotesShellLaunch(page)
    // Realistic desktop. See the note above about toy viewports.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('chat-center')).toBeVisible({ timeout: 10_000 })
  })

  for (const screen of SCREENS) {
    test(`${screen.name} has no new UI defects`, async ({ page }) => {
      const rail = page.getByTestId(screen.testId)
      if (await rail.count()) {
        await rail.first().click()
        // Let the destination settle before measuring; a half-rendered screen
        // reports collisions that resolve a frame later.
        await page.waitForTimeout(600)
      }

      const findings = await auditCurrentScreen(page)
      const known = new Set([...SHARED, ...(BASELINE[screen.name] ?? [])])
      const unexpected = findings.filter((finding) => !known.has(signature(finding)))

      expect(
        unexpected.map((finding) => `${signature(finding)} — ${finding.detail}`),
        `New UI defects on "${screen.name}". Fix them, or add the signature to tests/ui-audit-baseline.json with a reason.`,
      ).toEqual([])
    })
  }
})
