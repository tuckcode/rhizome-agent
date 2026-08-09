import { test, expect } from '@playwright/test'

test('AI chat panel: open, send message, close', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(2000)

  // Click the first note in the list — note items are cursor-pointer divs inside .app__note-list
  const noteItem = page.locator('.app__note-list .cursor-pointer').first()
  await noteItem.click()
  await page.waitForTimeout(800)

  // Screenshot before opening AI chat
  await page.screenshot({ path: 'test-results/ai-chat-before.png', fullPage: true })

  // Find the Sparkle button in the breadcrumb/info bar and click it
  const sparkleButton = page.locator('button[title="Open AI Chat"]')
  await expect(sparkleButton).toBeVisible({ timeout: 5000 })
  await sparkleButton.click()
  await page.waitForTimeout(300)

  // AI Chat panel should be visible
  const aiChatHeader = page.locator('text=AI Chat')
  await expect(aiChatHeader).toBeVisible()

  // Screenshot with AI chat panel open
  await page.screenshot({ path: 'test-results/ai-chat-open.png', fullPage: true })

  // Context pills should be visible
  await expect(page.locator('text=Frontmatter')).toBeVisible()
  await expect(page.locator('text=Links')).toBeVisible()

  // Type a message and send
  const textarea = page.locator('textarea[placeholder="Ask about this document..."]')
  await textarea.fill('Summarize this note')
  await page.locator('button[title="Send message"]').click()

  // Should see user message
  await expect(page.locator('text=Summarize this note')).toBeVisible()

  // Wait for typing indicator to appear
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/ai-chat-typing.png', fullPage: true })

  // Wait for mock response
  await page.waitForTimeout(1200)
  await expect(page.locator('text=words and links to')).toBeVisible({ timeout: 5000 })

  // Screenshot with response
  await page.screenshot({ path: 'test-results/ai-chat-response.png', fullPage: true })

  // Test quick action pill
  const expandButton = page.locator('button', { hasText: 'Expand' })
  await expandButton.click()
  await page.waitForTimeout(1800)
  await expect(page.locator('text=Add more detail to the introduction')).toBeVisible({ timeout: 5000 })

  // Screenshot with quick action response
  await page.screenshot({ path: 'test-results/ai-chat-quick-action.png', fullPage: true })

  // Close the panel using the X button in the AI Chat header
  await page.locator('button[title="Close AI Chat"]').last().click()
  await page.waitForTimeout(300)

  // Inspector should be back
  await expect(page.locator('text=Properties')).toBeVisible()

  // Screenshot after closing
  await page.screenshot({ path: 'test-results/ai-chat-closed.png', fullPage: true })
})
