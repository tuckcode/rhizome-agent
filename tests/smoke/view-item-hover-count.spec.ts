import { test, expect, type Locator, type Page } from '@playwright/test'

type MockHandlers = Record<string, ((args?: unknown) => unknown)> | null | undefined

async function installPersistentViewMocks(page: Page) {
  await page.addInitScript(() => {
    type ViewRecord = {
      filename: string
      definition: unknown
    }

    const clone = <T,>(value: T): T => structuredClone(value)
    const views: ViewRecord[] = []

    const apply = (handlers: MockHandlers) => {
      if (!handlers) return handlers

      handlers.list_views = () => views.map((view) => ({
        filename: view.filename,
        definition: clone(view.definition),
      }))

      handlers.save_view_cmd = (args?: unknown) => {
        const next = clone(args as { filename: string; definition: unknown })
        const index = views.findIndex((view) => view.filename === next.filename)
        if (index >= 0) {
          views[index] = next
        } else {
          views.push(next)
        }
        return null
      }

      handlers.delete_view_cmd = (args?: unknown) => {
        const { filename } = args as { filename: string }
        const index = views.findIndex((view) => view.filename === filename)
        if (index >= 0) views.splice(index, 1)
        return null
      }

      return handlers
    }

    let ref = apply(window.__mockHandlers as MockHandlers) ?? null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      get() {
        return apply(ref) ?? ref
      },
      set(value) {
        ref = apply(value as MockHandlers) ?? null
      },
    })
  })
}

async function openCreateViewDialog(page: Page) {
  const viewsHeader = page.locator('button:has(span:text("VIEWS"))')
  await viewsHeader.waitFor({ timeout: 10_000 })
  await viewsHeader.locator('svg').last().click({ force: true })
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
}

async function opacityOf(locator: Locator): Promise<number> {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))
}

test('view row hover swaps the note count with edit/delete actions', async ({ page }) => {
  await installPersistentViewMocks(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await openCreateViewDialog(page)
  await page.getByPlaceholder('e.g. Active Projects, Reading List...').fill('Project View')
  await page.getByTestId('filter-value-input').fill('Project')
  await page.getByRole('button', { name: 'Create' }).click()

  const viewRow = page.locator('div.group').filter({
    has: page.getByText('Project View', { exact: true }),
  }).first()
  await expect(viewRow).toBeVisible({ timeout: 10_000 })

  const countChip = viewRow.locator('span').last()
  const actionStrip = viewRow.locator('div.absolute.right-2.top-1\\/2').first()

  await expect(countChip).toHaveText(/\d+/)
  await expect.poll(() => opacityOf(countChip)).toBeGreaterThan(0.9)
  await expect.poll(() => opacityOf(actionStrip)).toBeLessThan(0.1)

  await viewRow.hover()

  await expect.poll(() => opacityOf(countChip)).toBeLessThan(0.1)
  await expect.poll(() => opacityOf(actionStrip)).toBeGreaterThan(0.9)
  await expect(viewRow.getByTitle('Edit view')).toBeVisible()
  await expect(viewRow.getByTitle('Delete view')).toBeVisible()

  await page.getByTestId('sidebar-top-nav').hover()

  await expect.poll(() => opacityOf(countChip)).toBeGreaterThan(0.9)
  await expect.poll(() => opacityOf(actionStrip)).toBeLessThan(0.1)
})
