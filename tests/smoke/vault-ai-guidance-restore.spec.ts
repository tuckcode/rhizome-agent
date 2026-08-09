import { test, expect } from '@playwright/test'
import { closeCommandPalette, executeCommand, findCommand, openCommandPalette } from './helpers'

test('vault guidance restore command recovers missing managed guidance', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      value: () => '/Users/luca/Laputa',
    })

    let ref: Record<string, unknown> | null = null
    let guidanceStatus = {
      agents_state: 'missing',
      claude_state: 'managed',
      gemini_state: 'managed',
      can_restore: true,
    }

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value as Record<string, unknown>

        ref.get_default_vault_path = () => '/Users/luca/Laputa'
        ref.check_vault_exists = (args: { path: string }) => args.path === '/Users/luca/Laputa'
        ref.get_vault_ai_guidance_status = () => ({ ...guidanceStatus })
        ref.restore_vault_ai_guidance = () => {
          guidanceStatus = {
            agents_state: 'managed',
            claude_state: 'managed',
            gemini_state: 'managed',
            can_restore: false,
          }
          return { ...guidanceStatus }
        }
      },
      get() {
        return ref
      },
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })

  // The AI workspace owns the guidance status affordance.
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle AI Panel')
  await expect(page.getByTestId('ai-guidance-warning')).toHaveText(/Rhizome guidance missing or broken/)
  await expect(page.getByTestId('ai-guidance-restore')).toBeVisible()

  await openCommandPalette(page)
  expect(await findCommand(page, 'Restore Rhizome AI Guidance')).toBe(true)
  await page.keyboard.press('Enter')

  await expect(page.getByText('Rhizome AI guidance restored')).toBeVisible()
  await expect(page.getByTestId('ai-guidance-warning')).toHaveCount(0)
  await expect(page.getByTestId('ai-guidance-restore')).toHaveCount(0)

  await openCommandPalette(page)
  expect(await findCommand(page, 'Restore Rhizome AI Guidance')).toBe(false)
  await closeCommandPalette(page)
})

test('guidance warning restore button repairs guidance without the command palette', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      value: () => '/Users/luca/Laputa',
    })

    let ref: Record<string, unknown> | null = null
    let guidanceStatus = {
      agents_state: 'broken',
      claude_state: 'managed',
      gemini_state: 'managed',
      can_restore: true,
    }

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value as Record<string, unknown>

        ref.get_default_vault_path = () => '/Users/luca/Laputa'
        ref.check_vault_exists = (args: { path: string }) => args.path === '/Users/luca/Laputa'
        ref.get_vault_ai_guidance_status = () => ({ ...guidanceStatus })
        ref.restore_vault_ai_guidance = () => {
          guidanceStatus = {
            agents_state: 'managed',
            claude_state: 'managed',
            gemini_state: 'managed',
            can_restore: false,
          }
          return { ...guidanceStatus }
        }
      },
      get() {
        return ref
      },
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })

  await openCommandPalette(page)
  await executeCommand(page, 'Toggle AI Panel')

  await page.getByTestId('ai-guidance-restore').click()

  await expect(page.getByText('Rhizome AI guidance restored')).toBeVisible()
  await expect(page.getByTestId('ai-guidance-warning')).toHaveCount(0)
})
