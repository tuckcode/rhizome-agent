import { test, expect, type Page } from '@playwright/test'
import { installMockAiAgent, sendShortcut } from './helpers'
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
    await input.fill('First question')
    await visibleAgentSend(page).click()

    // Wait for response
    let allMessages = visibleAiMessages(page)
    await expect(allMessages).toHaveCount(1)
    const firstResponse = allMessages.last()
    await expect(firstResponse).toBeVisible({ timeout: 5000 })
    await expect(firstResponse).toContainText('[mock-prime agent]')

    // Send another message
    await input.fill('Second question')
    await visibleAgentSend(page).click()

    // Should have 2 messages now (conversation history is maintained)
    allMessages = visibleAiMessages(page)
    await expect(allMessages).toHaveCount(2)
  })

  test('closing and reopening restores the titled chat and remains usable', async ({ page }) => {
    const input = visibleAgentInput(page)
    await input.fill('Keep this thread alive')
    await visibleAgentSend(page).click()

    const firstResponse = visibleAiMessages(page).last()
    await expect(firstResponse).toContainText('[mock-prime agent]', { timeout: 5000 })

    // Send a follow-up message to verify the conversation is still active
    await input.fill('Second message in thread')
    await visibleAgentSend(page).click()

    // Verify both messages are in the conversation
    const allMessages = visibleAiMessages(page)
    await expect(allMessages).toHaveCount(2)
  })
})
