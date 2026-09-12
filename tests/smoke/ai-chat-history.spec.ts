import { test, expect, type Page } from '@playwright/test'
import { installMockAiAgent } from './helpers'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'

function visibleAgentInput(page: Page) {
  return page.locator('[data-testid="agent-input"]:visible')
}

function visibleAgentSend(page: Page) {
  return page.locator('[data-testid="agent-send"]:visible')
}

function visibleAiMessages(page: Page) {
  return page.locator('[data-testid="ai-message"]:visible')
}

test.describe('AI chat conversation history', () => {
  test.beforeEach(async ({ page }) => {
    await installMockAiAgent(page)
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await pinNotesShellLaunch(page)
    await page.goto('/')

    // Chat is the default center canvas since ADR-0166 — no note selection and
    // no Cmd+Shift+L needed. (The older chat specs still do both, which is why
    // they fail against this shell; see C52.)
    await expect(page.getByTestId('chat-center')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 5000 })
  })

  test('first message renders a mocked AI response', async ({ page }) => {
    // Find the input and send a message
    const input = visibleAgentInput(page)
    await input.fill('Hello')
    await visibleAgentSend(page).click()

    // Wait for mock response to appear
    const response = visibleAiMessages(page).last()
    await expect(response).toBeVisible({ timeout: 5000 })

    await expect(response).toContainText('[mock-prime agent]')
    await expect(response).toContainText('You said: "Hello"')
  })

  test('development mode labels its fake model as a mock, not a real provider', async ({ page }) => {
    await expect(page.getByTestId('prime-model-chip')).toContainText('Mock model')
  })

  test('the compact rail opens on hover and closes when the pointer leaves', async ({ page }) => {
    const rail = page.getByTestId('command-rail')
    await expect(rail).toHaveAttribute('data-expanded', 'false')

    const compactBox = await rail.boundingBox()
    if (!compactBox) throw new Error('Command rail has no visible box')
    await page.mouse.move(compactBox.x + compactBox.width - 1, compactBox.y + 220)
    await expect(rail).toHaveAttribute('data-expanded', 'true')
    await expect(rail.getByTestId('prime-session-list')).toBeVisible()
    await page.waitForTimeout(600)
    await expect(rail).toHaveAttribute('data-expanded', 'true')

    await visibleAgentInput(page).hover()
    await expect(rail).toHaveAttribute('data-expanded', 'false')
  })

  test('the expanded rail can be dragged wider and remembers its width', async ({ page }) => {
    const rail = page.getByTestId('command-rail')
    await rail.hover()
    await expect(rail).toHaveCSS('width', '240px')
    const handle = page.getByTestId('command-rail-resize')
    const handleBox = await handle.boundingBox()
    if (!handleBox) throw new Error('Command rail resize handle has no visible box')

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 200)
    await page.mouse.down()
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 80, handleBox.y + 200)
    await page.mouse.up()

    await expect(rail).toHaveCSS('width', '320px')
    await expect(rail).toHaveAttribute('data-pinned', 'true')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('rhizome:command-rail-width')))
      .toBe('320')
  })

  test('second message appends to the current visible conversation', async ({ page }) => {
    // Send first message
    const input = visibleAgentInput(page)
    await input.fill('What is 2+2?')
    await visibleAgentSend(page).click()

    // Wait for first response to appear
    const firstResponse = visibleAiMessages(page).last()
    await expect(firstResponse).toBeVisible({ timeout: 5000 })
    await expect(firstResponse).toContainText('[mock-prime agent]')

    // Send second message
    await input.fill('What was my previous question?')
    await visibleAgentSend(page).click()

    const messages = visibleAiMessages(page)
    await expect(messages).toHaveCount(2)
    await expect(messages.first()).toContainText('What is 2+2?')
    const secondResponse = page.getByTestId('ai-message').last()
    await expect(secondResponse).toContainText('What was my previous question?', { timeout: 5000 })
  })

  test('history resets after clearing conversation', async ({ page }) => {
    // Send first message
    const input = visibleAgentInput(page)
    await input.fill('Hello')
    await visibleAgentSend(page).click()

    // Wait for response
    const firstResponse = visibleAiMessages(page).last()
    await expect(firstResponse).toBeVisible({ timeout: 5000 })

    // Clear conversation (the "New chat" control in the session subhead).
    await page
      .locator('[data-testid="prime-session-subhead"]')
      .getByTitle('New chat')
      .click()
    await page.waitForTimeout(300)

    // Messages should be cleared
    await expect(visibleAiMessages(page)).toHaveCount(0)

    // Send new message — should have no history
    await visibleAgentInput(page).fill('Fresh start')
    await visibleAgentSend(page).click()

    const freshResponse = visibleAiMessages(page).last()
    await expect(freshResponse).toBeVisible({ timeout: 5000 })
    await expect(freshResponse).toContainText('[mock-prime agent]')
    await expect(freshResponse).toContainText('You said: "Fresh start"')
  })

  test('switching sessions in the sidebar preserves each one\'s own history', async ({ page }) => {
    // Chat no longer has a whole-panel close/reopen cycle post-ADR-0166 — it's
    // the permanent center canvas. What replaced "close and reopen" as the way
    // to step away from a thread and come back is switching sessions in the
    // sidebar, which the fixture vault seeds with more than one session.
    const vaultSession = page.getByRole('button', {
      name: /^Open session Where does the vault watcher debounce\?/,
    })
    const releaseSession = page.getByRole('button', {
      name: /^Open session Draft the release notes/,
    })
    await expect(vaultSession).toBeVisible({ timeout: 5000 })
    await expect(releaseSession).toBeVisible({ timeout: 5000 })

    await vaultSession.click()
    await expect(visibleAiMessages(page).first()).toContainText('vault watcher', { timeout: 5000 })
    const vaultText = await visibleAiMessages(page).first().innerText()

    await releaseSession.click()
    await expect
      .poll(async () => (await visibleAiMessages(page).first().innerText()) !== vaultText, {
        timeout: 5000,
      })
      .toBe(true)

    // Switching back restores the first session's own content, not a mix.
    await vaultSession.click()
    await expect
      .poll(async () => visibleAiMessages(page).first().innerText(), { timeout: 5000 })
      .toBe(vaultText)
  })

  test('a replayed vault read is visible beside the answer and opens the note pane', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 815 })
    await page.getByTestId('command-rail').hover()
    await page.getByRole('button', { name: 'Pin sidebar' }).click()
    const railSessions = page.getByTestId('command-rail-sessions')
    const releaseSession = page.getByRole('button', {
      name: /^Open session Draft the release notes/,
    })

    await expect(railSessions.getByTestId('prime-session-list')).toBeVisible()
    await releaseSession.click()

    const sources = page.getByTestId('retrieved-note-sources')
    await expect(sources).toContainText('From your vault')

    await page.getByRole('button', { name: 'Open release-plan.md' }).click()

    await expect(railSessions.getByTestId('prime-session-list')).toBeVisible()
    await expect(page.getByTestId('chat-note-pane')).toContainText('release-plan.md')
    await expect(page.getByTestId('chat-note-pane')).toContainText('Rhizome Agent Release Plan')

    await page.getByTestId('chat-note-hover-region').hover()
    await page.getByTestId('agent-input').hover()
    const noteEdge = page.getByTestId('chat-note-hover-edge')
    await expect(noteEdge).toHaveText('Inbox')
    await noteEdge.hover()
    await expect(page.getByTestId('chat-note-pane')).toContainText('Rhizome Agent Release Plan')

    await page.getByRole('button', { name: 'Back to notes' }).click()
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('vault-panel-navigation')).toBeVisible()
    await expect(page.getByTestId('vault-panel-note-list')).toBeVisible()
    await expect(page.getByTestId('chat-note-pane')).toHaveCount(0)
    await expect(railSessions.getByTestId('prime-session-list')).toBeVisible()

    await page.getByTestId('vault-panel-collapse').click()
    await page.getByRole('button', { name: 'Open release-plan.md' }).click()
    await page.getByRole('button', { name: 'Close note' }).click()
    await expect(page.getByTestId('chat-note-pane')).toHaveCount(0)
    await expect(page.getByTestId('chat-note-hover-edge')).toHaveCount(0)

    await page.getByRole('button', { name: 'Open release-plan.md' }).click()
    await expect(railSessions.getByTestId('prime-session-list')).toBeVisible()
    await page.setViewportSize({ width: 1500, height: 900 })
    await expect(railSessions.getByTestId('prime-session-list')).toBeVisible()
    await expect(page.getByTestId('chat-note-pane')).toContainText('Rhizome Agent Release Plan')
  })
})
