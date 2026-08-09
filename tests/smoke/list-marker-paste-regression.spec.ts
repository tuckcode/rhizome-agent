import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

function writeListNote(vaultPath: string, filename: string, title: string, body: string): void {
  fs.writeFileSync(path.join(vaultPath, 'note', filename), `---
Is A: Note
Status: Active
---

# ${title}

${body}
`, 'utf8')
}

test.beforeEach(async ({ page, context }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  writeListNote(tempVaultDir, 'note-b.md', 'Note B', '- Seed bullet item')
  writeListNote(tempVaultDir, 'note-c.md', 'Note C', '- [ ] Seed checklist item')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openNote(page: Page, title: string): Promise<void> {
  await page.locator('[data-testid="note-list-container"]').getByText(title, { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value)
  }, text)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
}

async function expectPastedFreshListItem(page: Page, options: {
  contentType: string
  expectedTexts: string[]
  pastedText: string
  seedText: string
}): Promise<void> {
  const listItems = page.locator(`.bn-block-content[data-content-type="${options.contentType}"]`)
  const seedItem = listItems.filter({ hasText: options.seedText }).first()
  await expect(seedItem).toBeVisible({ timeout: 5_000 })
  await seedItem.click()

  const countBefore = await listItems.count()

  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(listItems).toHaveCount(countBefore + 1)

  const freshItem = listItems.last()
  await pasteText(page, options.pastedText)

  for (const text of options.expectedTexts) {
    await expect(freshItem).toContainText(text)
  }
  await expect(listItems).toHaveCount(countBefore + 1)
}

test('pasting into fresh bullet and checklist items preserves their markers', async ({ page }) => {
  await openNote(page, 'Note B')
  await expectPastedFreshListItem(page, {
    contentType: 'bulletListItem',
    expectedTexts: ['Pasted bullet item'],
    pastedText: 'Pasted bullet item',
    seedText: 'Seed bullet item',
  })

  await openNote(page, 'Note C')
  await expectPastedFreshListItem(page, {
    contentType: 'checkListItem',
    expectedTexts: ['Pasted checklist line one', 'line two'],
    pastedText: 'Pasted checklist line one\nline two',
    seedText: 'Seed checklist item',
  })
})
