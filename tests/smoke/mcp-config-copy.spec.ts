import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'

test.describe('MCP config copy', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await pinNotesShellLaunch(page)
    await page.goto('/')
    await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  })

  test('copies the active-vault MCP config from the Settings AI section', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await sendShortcut(page, ',', ['Control'])
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 3_000 })
    await page.getByTestId('settings-advanced-prime-engine-toggle').click()
    await page.getByTestId('settings-copy-mcp-config').click()

    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('"mcpServers"')
    const copiedConfig = await page.evaluate(() => navigator.clipboard.readText())
    const parsedConfig = JSON.parse(copiedConfig) as {
      mcpServers: {
        rhizome: {
          args: string[]
          command: string
          env: Record<string, string>
          type: string
        }
      }
    }
    const rhizomeServer = parsedConfig.mcpServers.rhizome

    expect(rhizomeServer.type).toBe('stdio')
    expect(rhizomeServer.command).toBe('node')
    expect(rhizomeServer.args[0]).toContain('mcp-server/index.js')
    expect(rhizomeServer.env.VAULT_PATH).toBeUndefined()
    expect(rhizomeServer.env.WS_UI_PORT).toBe('9711')
  })
})
