import { test } from '@playwright/test'

test('find note selectors', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Get all clickable elements with their text
  const info = await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="cursor-pointer"]')
    return Array.from(items).slice(0, 20).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().slice(0, 50),
      cls: el.className.toString().slice(0, 80),
      rect: el.getBoundingClientRect().toJSON()
    }))
  })
  console.log(JSON.stringify(info, null, 2))
})
