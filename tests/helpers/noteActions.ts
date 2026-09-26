import type { Page } from '@playwright/test'

/**
 * Note header actions live inline when the note pane is wide and in the
 * "More note actions" menu when it is narrow (native audit 2026-09-26:
 * tools fold before the title does). Specs about an action's behaviour
 * should not depend on which one the current width chose.
 */
/**
 * The header measures itself after first paint, so an inline action seen in
 * that first frame can fold into "…" a moment later. Try inline briefly,
 * then fall back to the menu.
 */
async function clickInlineIfItStays(page: Page, role: 'button' | 'radio', name: string) {
  const inline = page.locator('.breadcrumb-bar').getByRole(role, { name, exact: true })
  if (!(await inline.isVisible())) return false
  try {
    await inline.click({ timeout: 2_000 })
    return true
  } catch {
    return false
  }
}

async function openNoteActionsMenu(page: Page) {
  await page.locator('.breadcrumb-bar').getByRole('button', { name: 'More note actions' }).click()
}

export async function clickNoteAction(page: Page, name: string) {
  if (await clickInlineIfItStays(page, 'button', name)) return
  await openNoteActionsMenu(page)
  await page.getByRole('menuitem', { name, exact: true }).click()
}

/** Like clickNoteAction, but a no-op when neither place offers the action. */
export async function clickNoteActionIfOffered(page: Page, name: string) {
  if (await clickInlineIfItStays(page, 'button', name)) return
  const more = page.locator('.breadcrumb-bar').getByRole('button', { name: 'More note actions' })
  if (!(await more.isVisible())) return
  await more.click()
  const item = page.getByRole('menuitem', { name, exact: true })
  if (await item.count()) await item.click()
  else await page.keyboard.press('Escape')
}

/** On top / Beside, wherever the placement control currently sits. */
export async function chooseNotePlacement(page: Page, placement: 'top' | 'beside') {
  const name = placement === 'top' ? 'Note on top of Chat' : 'Note beside Chat'
  if (await clickInlineIfItStays(page, 'radio', name)) return
  await openNoteActionsMenu(page)
  await page.getByRole('radio', { name }).click()
  if (await page.getByRole('menu').isVisible()) await page.keyboard.press('Escape')
}
