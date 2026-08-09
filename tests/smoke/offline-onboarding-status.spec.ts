import { test, expect, type Page } from '@playwright/test'

async function installOnboardingMocks(page: Page, offline: boolean) {
  await page.addInitScript((isOffline: boolean) => {
    localStorage.clear()
    let createdVaultPath: string | null = null

    let ref: Record<string, unknown> | null = null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value as Record<string, unknown>
        ref.load_vault_list = () => ({
          vaults: [],
          active_vault: null,
          hidden_defaults: [],
        })
        ref.get_default_vault_path = () => '/Users/mock/Documents/Getting Started'
        ref.check_vault_exists = (args: { path?: string }) => args.path === createdVaultPath
        ref.create_getting_started_vault = (args: { targetPath?: string | null }) => {
          if (args.targetPath !== '/Users/mock/Documents/Getting Started') {
            throw new Error(`Unexpected Getting Started target: ${args.targetPath}`)
          }
          createdVaultPath = args.targetPath
          return args.targetPath
        }
      },
      get() {
        return ref
      },
    })

    Object.defineProperty(window, 'prompt', {
      configurable: true,
      value: () => '/Users/mock/Documents',
    })

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => !isOffline,
    })
  }, offline)
}

test('offline onboarding disables template cloning and explains clone-later behavior', async ({ page }) => {
  await installOnboardingMocks(page, true)

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await expect(page.getByTestId('welcome-create-new')).toBeEnabled()
  await expect(page.getByTestId('welcome-open-folder')).toBeEnabled()
  await expect(page.getByTestId('welcome-create-vault')).toBeDisabled()
  await expect(page.getByText('Requires internet — clone later. Suggested path: /Users/mock/Documents/Getting Started')).toBeVisible()
})

test('status bar keeps a Getting Started clone entry available after onboarding', async ({ page }) => {
  await installOnboardingMocks(page, false)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('welcome-screen')).toBeVisible()

  await page.getByTestId('welcome-create-vault').click()

  await expect(page.getByText('Getting Started vault cloned and opened at /Users/mock/Documents/Getting Started')).toBeVisible()
  await expect(page.getByTestId('claude-onboarding-screen')).toBeVisible()
  await page.getByTestId('claude-onboarding-continue').click()
  await expect(page.locator('[data-testid="note-list-container"]')).toBeVisible()
  await page.getByTestId('status-vault-trigger').click()
  await expect(page.getByTestId('vault-menu-clone-getting-started')).toBeVisible()
})
