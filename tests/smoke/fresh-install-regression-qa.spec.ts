import { test, expect, type Page } from '@playwright/test'
import { openCommandPalette, findCommand, sendShortcut } from './helpers'
import { triggerMenuCommand } from './testBridge'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

/**
 * Fresh-install regression QA: verify all 7 Done tasks work on a fresh
 * MacBook without pre-configured environment.
 *
 * Tasks under test:
 * 1. MCP server foundation + auto-registration
 * 3. AGENTS.md vault-level instructions
 * 4. AI Agent panel: vault-native AI
 * 5. Claude API wiring + full agent loop
 * 6. AI panel UI (3 layers + steady run border, ADR-0193)
 * 7. /api/ai/agent endpoint fix (uses Tauri invoke, not fetch)
 */

let tempVaultDir: string | null = null

/** Open a fixture note. The chat-centre shell shows the AI panel beside it. */
async function openNoteWithAiPanel(page: Page) {
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
  await page.locator('[data-testid="note-list-container"]').getByText('Note B', { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  const panel = page.getByTestId('ai-panel')
  if (!(await panel.isVisible().catch(() => false))) {
    await triggerMenuCommand(page, APP_COMMAND_IDS.viewToggleAiChat)
  }
  await expect(panel).toBeVisible({ timeout: 5_000 })
  return panel
}

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
  tempVaultDir = null
})

test.describe('Fresh-install regression: AI panel renders and works @smoke', () => {
  test('AI panel has the 3-layer structure', async ({ page }) => {
    const panel = await openNoteWithAiPanel(page)

    // Layer 1: the new-chat screen
    await expect(panel.getByTestId('ai-panel-empty-state')).toBeVisible()
    // Layer 2: the run status line above the composer
    await expect(panel.getByTestId('chat-run-status-line')).toBeAttached()
    // Layer 3: input area with send button
    await expect(page.getByTestId('agent-input')).toBeVisible()
    await expect(page.getByTestId('agent-send')).toBeVisible()
  })

  test('AI panel input is focusable and sendable', async ({ page }) => {
    await openNoteWithAiPanel(page)

    const input = page.getByTestId('agent-input')
    await input.fill('Test message')

    // Send button should be enabled when input has text
    const sendBtn = page.getByTestId('agent-send')
    await expect(sendBtn).toBeEnabled()

    // Click send — the browser build answers with the mock native agent
    await sendBtn.click()
    const response = page.getByTestId('ai-message').last()
    await expect(response).toBeVisible({ timeout: 5000 })
    await expect(response).toContainText('Test message')
  })

  test('AI panel closes with Hide Chat', async ({ page }) => {
    const panel = await openNoteWithAiPanel(page)

    await page.getByRole('button', { name: 'Hide Chat' }).click()
    await expect(panel).not.toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor')).toBeVisible()
  })

  test('AI panel border does not pulse (ADR-0193)', async ({ page }) => {
    const panel = await openNoteWithAiPanel(page)

    // The run status line replaced the pulse. No keyframe may come back.
    const hasPulseKeyframe = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'ai-border-pulse') {
              return true
            }
          }
        } catch { /* cross-origin sheets */ }
      }
      return false
    })
    expect(hasPulseKeyframe).toBe(false)

    // The panel never animates, before or after a run. The browser mock
    // answers synchronously, so the 2px primary border while a run is
    // active is covered by aiPanelPulse.test.ts, not here.
    const animationName = () => panel.evaluate((el) => getComputedStyle(el).animationName)
    expect(await animationName()).toBe('none')
    await page.getByTestId('agent-input').fill('Test message')
    await page.getByTestId('agent-send').click()
    await expect(page.getByTestId('ai-message').last()).toBeVisible({ timeout: 5000 })
    expect(await animationName()).toBe('none')
  })
})

test.describe('Fresh-install regression: search and command palette @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/')
    await page.waitForTimeout(500)
  })

  test('search UI renders and is accessible via Cmd+P', async ({ page }) => {
    // Cmd+P should open search/note switcher
    await sendShortcut(page, 'p', ['Control'])
    await page.waitForTimeout(500)

    // Search input should be visible
    const searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="command"]'),
    )
    await expect(searchInput).toBeVisible({ timeout: 2000 })
  })

  test('Cmd+K command palette includes Repair Vault', async ({ page }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'Repair Vault')
    expect(found).toBe(true)
  })
})

test.describe('Fresh-install regression: no /api/ai/agent endpoint @smoke', () => {
  test('fetching /api/ai/agent returns 404 or no response', async ({ page }) => {
    // In dev mode, the Vite proxy plugin handles /api/ai/agent,
    // but in production Tauri there is no HTTP server at all.
    // The key verification is that ai-agent.ts uses invoke(), not fetch().
    // We verify this indirectly by checking the AiPanel doesn't make fetch calls.
    const fetchCalls: string[] = []
    page.on('request', req => {
      if (req.url().includes('/api/ai/agent')) {
        fetchCalls.push(req.url())
      }
    })

    // Open AI panel and send a message
    await openNoteWithAiPanel(page)
    await page.getByTestId('agent-input').fill('Test')
    await page.getByTestId('agent-send').click()
    await expect(page.getByTestId('ai-message').last()).toBeVisible({ timeout: 5000 })

    // No fetch to /api/ai/agent should have been made
    expect(fetchCalls).toHaveLength(0)
  })
})
