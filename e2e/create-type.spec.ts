import { test, expect } from '@playwright/test'

test.describe('Create New Type Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5203')
    await page.waitForSelector('text=All Notes')
  })

  test('clicking + on Types section opens Create Type dialog', async ({ page }) => {
    // Hover over the Types section to reveal the + button
    const typesSection = page.locator('text=Types').first()
    await typesSection.hover()

    // Click the + button next to Types
    const createTypeBtn = page.locator('[title="New Type"]')
    await createTypeBtn.click()

    // Dialog should open with correct title and elements
    await expect(page.locator('text=Create New Type')).toBeVisible()
    await expect(page.locator('input[placeholder="e.g. Recipe, Book, Habit..."]')).toBeVisible()
    await expect(page.locator('text=Creates a type document')).toBeVisible()

    await page.screenshot({ path: 'test-results/create-type-dialog.png', fullPage: true })
  })

  test('Create button is disabled when name is empty', async ({ page }) => {
    const typesSection = page.locator('text=Types').first()
    await typesSection.hover()
    await page.locator('[title="New Type"]').click()

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeDisabled()
  })

  test('can create a new type and it appears in sidebar', async ({ page }) => {
    // Open Create Type dialog
    const typesSection = page.locator('text=Types').first()
    await typesSection.hover()
    await page.locator('[title="New Type"]').click()

    // Type a name and submit
    await page.locator('input[placeholder="e.g. Recipe, Book, Habit..."]').fill('Workout')
    await page.locator('button:has-text("Create")').click()

    // Dialog should close
    await expect(page.locator('text=Create New Type')).not.toBeVisible()

    // New type should appear as a sidebar section (pluralized)
    await expect(page.locator('text=Workouts')).toBeVisible({ timeout: 3000 })

    // The type document should open in the editor
    await expect(page.locator('text=Workout').first()).toBeVisible()

    await page.screenshot({ path: 'test-results/after-create-type.png', fullPage: true })
  })

  test('newly created type appears in Create Note dialog type selector', async ({ page }) => {
    // First, create a custom type
    const typesSection = page.locator('text=Types').first()
    await typesSection.hover()
    await page.locator('[title="New Type"]').click()
    await page.locator('input[placeholder="e.g. Recipe, Book, Habit..."]').fill('Workout')
    await page.locator('button:has-text("Create")').click()

    // Now open Create Note dialog
    await page.keyboard.press('Meta+n')
    await page.waitForSelector('text=Create New Note')

    // Built-in types should be visible
    await expect(page.locator('button:has-text("Note")')).toBeVisible()
    await expect(page.locator('button:has-text("Project")')).toBeVisible()

    // Our custom type should also be visible
    await expect(page.locator('button:has-text("Workout")')).toBeVisible()

    await page.screenshot({ path: 'test-results/create-note-with-custom-type.png', fullPage: true })
  })

  test('can create an instance of a custom type', async ({ page }) => {
    // First, create a custom type
    const typesSection = page.locator('text=Types').first()
    await typesSection.hover()
    await page.locator('[title="New Type"]').click()
    await page.locator('input[placeholder="e.g. Recipe, Book, Habit..."]').fill('Workout')
    await page.locator('button:has-text("Create")').click()
    await expect(page.locator('text=Workouts')).toBeVisible({ timeout: 3000 })

    // Hover over the new Workouts section and click +
    const workoutsSection = page.locator('text=Workouts').first()
    await workoutsSection.hover()
    await page.locator('[title="New Workout"]').click()

    // Create Note dialog should open
    await expect(page.locator('text=Create New Note')).toBeVisible()

    // Type a title and create
    await page.locator('input[placeholder="Enter note title..."]').fill('Morning Run')
    await page.locator('button:has-text("Create")').last().click()

    // The note should open in editor
    await expect(page.locator('text=Morning Run').first()).toBeVisible({ timeout: 3000 })

    await page.screenshot({ path: 'test-results/custom-type-instance.png', fullPage: true })
  })

  test('Cancel closes the dialog without creating', async ({ page }) => {
    const typesSection = page.locator('text=Types').first()
    await typesSection.hover()
    await page.locator('[title="New Type"]').click()

    await page.locator('input[placeholder="e.g. Recipe, Book, Habit..."]').fill('ShouldNotExist')
    await page.locator('button:has-text("Cancel")').click()

    // Dialog should close
    await expect(page.locator('text=Create New Type')).not.toBeVisible()

    // Type should NOT appear in sidebar
    await expect(page.locator('text=ShouldNotExists')).not.toBeVisible()
  })
})
