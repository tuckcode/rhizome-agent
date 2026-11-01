import { test, expect, type Page } from '@playwright/test'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'
import { installMockAiAgent } from './helpers'

/**
 * Seeds an unlisted Ollama model so Settings/chip must format it without a
 * catalog match (the unit-test path with a configured provider already passes).
 */
async function seedUnlistedOllamaTarget(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Handler = (args?: Record<string, unknown>) => unknown
    type BrowserWindow = Window & typeof globalThis & {
      __mockHandlers?: Record<string, Handler>
    }

    const apply = (handlers?: Record<string, Handler> | null) => {
      if (!handlers) return handlers ?? null
      const originalGetSettings = handlers.get_settings
      handlers.get_settings = () => ({
        ...(typeof originalGetSettings === 'function'
          ? (originalGetSettings() as Record<string, unknown>)
          : {}),
        native_chat_target: 'ollama/qwen2.5',
        // Empty providers: real Settings often opens before/without a matching
        // configured row, so the label must not fall back to the raw id.
        ai_model_providers: [],
      })
      return handlers
    }

    const browserWindow = window as BrowserWindow
    let ref = apply(browserWindow.__mockHandlers) ?? null
    Object.defineProperty(browserWindow, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = apply(value as Record<string, Handler> | undefined) ?? null
      },
      get() {
        return apply(ref) ?? ref
      },
    })
  })
}

async function openComposerModelMenu(page: Page): Promise<void> {
  const trigger = page.getByTestId('native-chat-model-trigger').first()
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  await trigger.click()
  await expect(page.getByTestId('native-chat-model-menu')).toBeVisible({ timeout: 5_000 })
}

test.describe('Provider UX settings focus and labels @smoke', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(90_000)
    await installMockAiAgent(page)
    await seedUnlistedOllamaTarget(page)
    await pinNotesShellLaunch(page)
    await page.goto('/')
    await expect(page.getByTestId('chat-center')).toBeVisible({ timeout: 15_000 })
  })

  test('unlisted Settings chat model shows Provider · model, not the raw id', async ({ page }) => {
    const chipLabel = page.getByTestId('native-chat-model-trigger-label').first()
    await expect(chipLabel).toHaveText('Ollama · qwen2.5', { timeout: 10_000 })
    await expect(chipLabel).not.toHaveText('ollama/qwen2.5')

    await page.locator('body').click({ position: { x: 2, y: 2 } })
    await page.keyboard.press('Control+,')
    const panel = page.getByTestId('settings-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const settingsLabel = panel.getByTestId('native-chat-model-trigger-label')
    await expect(settingsLabel).toHaveText('Ollama · qwen2.5')
    await expect(settingsLabel).not.toHaveText('ollama/qwen2.5')
  })

  test('Add key focuses the provider key row instead of settings-pull-interval', async ({ page }) => {
    await openComposerModelMenu(page)
    // OpenAI's picker header may offer ChatGPT sign-in instead of Add key (#284). Use whichever
    // provider still exposes Add key; focus must land on that provider's Connected key field.
    const addKey = page.getByTestId('native-chat-model-add-key').first()
    await expect(addKey).toBeVisible({ timeout: 10_000 })
    await addKey.click()

    const panel = page.getByTestId('settings-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const focusedKey = page.locator('[data-testid^="settings-connected-key-"]:focus')
    await expect(focusedKey).toBeVisible({ timeout: 5_000 })

    const pullInterval = page.getByTestId('settings-pull-interval')
    await expect(pullInterval).not.toBeFocused()

    const keyFor = await focusedKey.getAttribute('data-key-for')
    expect(keyFor).toMatch(/^summary-provider-row-/)
    const keyRow = page.locator(`[id="${keyFor}"]`)
    await expect(keyRow).toBeVisible()
    const inView = await keyRow.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const panel = document.querySelector('[data-testid="settings-panel"]')
      const panelRect = panel?.getBoundingClientRect()
      if (!panelRect) return false
      return rect.top >= panelRect.top - 8 && rect.bottom <= panelRect.bottom + 8
    })
    expect(inView).toBe(true)
  })

  test('composer chip prefers shrinking the provider span', async ({ page }) => {
    // Select a catalog model so the chip splits provider/model spans.
    await openComposerModelMenu(page)
    const llama = page.getByTestId('native-chat-model-ollama/llama3.2')
    if (await llama.count()) {
      await llama.click()
    } else {
      await page.getByRole('menuitem', { name: /llama3\.2/i }).first().click()
    }
    await expect(page.getByTestId('native-chat-model-menu')).toHaveCount(0)

    const provider = page.getByTestId('native-chat-model-trigger-provider').first()
    const model = page.getByTestId('native-chat-model-trigger-model').first()
    await expect(provider).toBeVisible()
    await expect(model).toBeVisible()

    await expect(provider).toHaveClass(/shrink-\[999\]/)
    await expect(provider).toHaveClass(/min-w-0/)
    await expect(provider).toHaveClass(/truncate/)
    await expect(model).toHaveClass(/min-w-0/)
    await expect(model).toHaveClass(/truncate/)
    await expect(model).not.toHaveClass(/shrink-\[999\]/)
  })
})
