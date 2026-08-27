import { test, expect, type Page } from '@playwright/test'
import { installMockAiAgent } from './helpers'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'

/**
 * C51 regression. A turn that produces no assistant text still renders a
 * placeholder in the transcript ("… finished without returning a reply"), and
 * Promote used to write that sentence into the vault as if it were the reply,
 * frontmatter and all.
 *
 * The unit tests cover the refusal itself; this covers the wiring — that the
 * button reaches the guard and the user is told why nothing was saved, rather
 * than the click looking like a silent no-op.
 *
 * `__mock_empty_reply__` is the mock seam that makes an empty turn reachable
 * at all (see MOCK_EMPTY_REPLY_PROMPT in src/utils/streamAiAgent.ts). Without
 * it this path could not be driven, which is why the bug shipped.
 */

const EMPTY_REPLY_PROMPT = '__mock_empty_reply__'

function visibleAgentInput(page: Page) {
  return page.locator('[data-testid="agent-input"]:visible')
}

function visibleAgentSend(page: Page) {
  return page.locator('[data-testid="agent-send"]:visible')
}

test.describe('Promote refuses a turn with no assistant content', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAiAgent(page)
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await pinNotesShellLaunch(page)
    await page.goto('/')

    // Chat is the default center canvas since ADR-0166 — no note selection and
    // no Cmd+Shift+L needed. (The older chat specs still do both, which is why
    // they fail against this shell; see C25.)
    await expect(page.getByTestId('chat-center')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 5000 })
  })

  test('shows the empty-turn placeholder and refuses to promote it', async ({ page }) => {
    await visibleAgentInput(page).fill(EMPTY_REPLY_PROMPT)
    await visibleAgentSend(page).click()

    // The placeholder is what the user sees when a turn produced nothing.
    const response = page.locator('[data-testid="ai-message"]:visible').last()
    await expect(response).toContainText('finished without returning a reply', {
      timeout: 5000,
    })

    const saveToVault = page.locator('[data-testid="ai-message-save-to-vault"]:visible').last()
    await expect(saveToVault).toBeVisible()
    await saveToVault.click()

    // Refused, and said so — not a silent no-op.
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).toContainText('Nothing to promote', { timeout: 5000 })
  })

  test('still promotes a turn that produced real content', async ({ page }) => {
    await visibleAgentInput(page).fill('Hello')
    await visibleAgentSend(page).click()

    const response = page.locator('[data-testid="ai-message"]:visible').last()
    await expect(response).toContainText('You said: "Hello"', { timeout: 5000 })

    const saveToVault = page.locator('[data-testid="ai-message-save-to-vault"]:visible').last()
    await saveToVault.click()

    // The guard must not swallow a real reply — the failure mode of an
    // over-broad refusal is silently losing content the user asked to keep.
    const toast = page.locator('.fixed.bottom-8')
    await expect(toast).not.toContainText('Nothing to promote', { timeout: 5000 })
  })
})
