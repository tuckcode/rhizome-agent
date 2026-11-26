import { test, expect, type Page } from '@playwright/test'

// Fresh profile: no consent, no vault, no model. First run should go
// consent, welcome, vault, model step, shell (run plan section 3.4).

const VAULT_PATH = '/Users/mock/demo-vault-v2'
const STATE_KEY = 'rhizome:test-first-run-state'

interface FirstRunState {
  consented: boolean
  vaults: Array<{ label: string; path: string }>
  active_vault: string | null
}

async function mockFreshProfile(page: Page) {
  await page.addInitScript(({ stateKey, vaultPath }) => {
    type Handler = (args?: Record<string, unknown>) => unknown
    type Handlers = Record<string, Handler> & { __firstRunWrapped?: boolean }

    // Clear once per test, not on every reload, so a reload sees what first run saved.
    if (!sessionStorage.getItem(stateKey)) {
      localStorage.clear()
      sessionStorage.setItem(stateKey, '1')
    }
    localStorage.setItem('tolaria:ai-agents-onboarding-dismissed', '1')
    localStorage.setItem('tolaria:claude-code-onboarding-dismissed', '1')

    const readState = (): FirstRunState => JSON.parse(
      localStorage.getItem(stateKey) ?? '{"consented":false,"vaults":[],"active_vault":null}',
    ) as FirstRunState
    const writeState = (patch: Partial<FirstRunState>) => {
      localStorage.setItem(stateKey, JSON.stringify({ ...readState(), ...patch }))
    }

    Object.defineProperty(window, 'prompt', { configurable: true, value: () => vaultPath })

    const wrap = (handlers: Handlers | undefined) => {
      if (!handlers || handlers.__firstRunWrapped) return handlers
      handlers.__firstRunWrapped = true
      const getSettings = handlers.get_settings
      const saveSettings = handlers.save_settings
      handlers.get_settings = () => {
        const settings = getSettings() as Record<string, unknown>
        if (readState().consented) return settings
        return { ...settings, telemetry_consent: null, crash_reporting_enabled: null, analytics_enabled: null }
      }
      handlers.save_settings = (args?: Record<string, unknown>) => {
        const settings = (args?.settings ?? {}) as Record<string, unknown>
        if (settings.telemetry_consent != null) writeState({ consented: true })
        return saveSettings(args)
      }
      handlers.load_vault_list = () => {
        const state = readState()
        return { vaults: state.vaults, active_vault: state.active_vault, hidden_defaults: [] }
      }
      handlers.save_vault_list = (args?: Record<string, unknown>) => {
        const list = args?.list as { vaults: FirstRunState['vaults']; active_vault: string | null }
        writeState({ vaults: list.vaults, active_vault: list.active_vault })
        return null
      }
      return handlers
    }

    let ref: Handlers | undefined
    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) { ref = wrap(value as Handlers | undefined) },
      get() { return ref },
    })
  }, { stateKey: STATE_KEY, vaultPath: VAULT_PATH })
}

async function finishConsentAndVault(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Help improve Rhizome')).toBeVisible()
  await page.getByTestId('telemetry-decline').click()

  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await page.getByTestId('welcome-open-folder').click()
}

async function savedChatTarget(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const handlers = (window as unknown as { __mockHandlers?: Record<string, () => Record<string, unknown>> }).__mockHandlers
    return handlers?.get_settings().native_chat_target ?? null
  })
}

test('fresh profile connects a detected local model after the vault step @smoke', async ({ page }) => {
  await mockFreshProfile(page)
  await finishConsentAndVault(page)

  const step = page.getByTestId('first-run-model-step')
  await expect(step).toBeVisible({ timeout: 5_000 })
  // The browser mock answers as a running Ollama, so the local path leads.
  await expect(page.getByTestId('first-run-model-path-local')).toHaveAttribute('aria-pressed', 'true')
  await expect(step).toContainText('Ollama is running with 2 models.')
  await page.getByTestId('first-run-model-local-use').click()

  await expect(step).not.toBeVisible()
  await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  await expect.poll(() => savedChatTarget(page)).toBe('ollama/llama3.2')
})

test('Set up later ends the step for good, and a reload goes straight to the shell @smoke', async ({ page }) => {
  await mockFreshProfile(page)
  await finishConsentAndVault(page)

  await expect(page.getByTestId('first-run-model-step')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('first-run-model-skip').click()
  await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  expect(await savedChatTarget(page)).toBeNull()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('first-run-model-step')).toHaveCount(0)
  await expect(page.getByTestId('welcome-screen')).toHaveCount(0)
})

test('the API key path shows the provider and key fields @smoke', async ({ page }) => {
  await mockFreshProfile(page)
  await finishConsentAndVault(page)

  await expect(page.getByTestId('first-run-model-step')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('first-run-model-path-api_key').click()
  await expect(page.getByTestId('first-run-model-key-provider')).toBeVisible()
  await expect(page.getByTestId('first-run-model-key-input')).toHaveAttribute('type', 'password')
  await expect(page.getByTestId('first-run-model-key-save')).toBeDisabled()
})
