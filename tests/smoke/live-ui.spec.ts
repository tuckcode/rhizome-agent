import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import type { UiSnapshot } from '../../src/utils/uiAudit'

/**
 * `pnpm live-ui` (#50): the agent reads the running app as data instead of
 * looking at screenshots of it.
 *
 * The layout checks run in a real browser on purpose. jsdom has no layout
 * engine: `scrollHeight` and `clientHeight` are always 0 there, so a jsdom
 * test of "does this panel scroll" can only pass on numbers it stubbed itself.
 *
 * Untagged, so it runs in the regression lane, not the 5-minute smoke lane.
 */

const SCRIPT = fileURLToPath(new URL('../../scripts/live-ui.mjs', import.meta.url))

/**
 * Two panels with the same `overflow-y: auto` column and 1000px of content.
 *
 * - `trapped`: the column sits under a plain block parent, so it grows to fit
 *   its content and never overflows. The parent clips it. This is the Chat
 *   transcript bug that 5,829 passing tests did not see.
 * - `fixed`: the column is a `flex: 1; min-height: 0` child of a fixed-height
 *   flex parent, so it keeps the parent's height and scrolls.
 */
const FIXTURE = `
  <div style="position:fixed;inset:0;background:white;z-index:2147483647">
    <div data-testid="trapped-panel" style="height:200px;width:300px;overflow:hidden">
      <div data-testid="trapped-column" style="overflow-y:auto">
        <div style="height:1000px">content</div>
      </div>
    </div>
    <div data-testid="fixed-panel" style="height:200px;width:300px;overflow:hidden;display:flex;flex-direction:column">
      <div data-testid="fixed-column" style="flex:1 1 0;min-height:0;overflow-y:auto">
        <div style="height:1000px">content</div>
      </div>
    </div>
    <button data-testid="fixture-button" style="width:80px;height:30px">Send</button>
  </div>
`

async function snapshotFixture(page: import('@playwright/test').Page): Promise<UiSnapshot> {
  // Any page from the dev server gives the origin the module import needs.
  await page.goto('/')
  return page.evaluate(async (html) => {
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.replaceChildren(host)
    const module = await import('/src/utils/uiAudit.ts')
    return module.snapshotUi(host)
  }, FIXTURE) as Promise<UiSnapshot>
}

function runLiveUi(args: string[], baseUrl: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      { env: { ...process.env, BASE_URL: baseUrl }, timeout: 60_000 },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

test.describe('live UI snapshot', () => {
  test('a column trapped under a block parent cannot scroll, and its parent clips it', async ({ page }) => {
    const { wells } = await snapshotFixture(page)
    const byId = new Map(wells.map((well) => [well.testId, well]))

    expect(byId.get('trapped-column')).toMatchObject({ canScroll: false, reason: 'no-overflow' })
    expect(byId.get('trapped-panel')).toMatchObject({ canScroll: false, reason: 'clipped' })
  })

  test('a min-height-0 flex column scrolls, and its parent is not reported', async ({ page }) => {
    const { wells } = await snapshotFixture(page)
    const byId = new Map(wells.map((well) => [well.testId, well]))

    const fixed = byId.get('fixed-column')
    expect(fixed).toMatchObject({ canScroll: true, reason: 'scrolls', overflowY: 'auto' })
    expect(fixed!.scrollHeight).toBeGreaterThan(fixed!.clientHeight)
    expect(byId.has('fixed-panel')).toBe(false)
  })

  test('controls carry a role, a label, and a box', async ({ page }) => {
    const { controls } = await snapshotFixture(page)

    expect(controls).toContainEqual(
      expect.objectContaining({ role: 'button', label: 'Send', testId: 'fixture-button', width: 80, height: 30 }),
    )
  })
})

test.describe('pnpm live-ui', () => {
  test('prints the Chat screen as text from the running dev app', async ({ baseURL }) => {
    test.setTimeout(90_000)
    const { code, stdout, stderr } = await runLiveUi(['--screen', 'chat'], baseURL!)

    expect(code, stderr).toBe(0)
    expect(stdout).toContain('## Screen: chat')
    expect(stdout).toContain('### Layout findings')
    expect(stdout).toContain('### Scroll wells')
    expect(stdout).toContain('### Controls')
    expect(stdout).toContain('### Console errors')
    expect(stdout).toMatch(/canScroll=(true|false)/u)
  })

  test('says how to start the dev app when nothing is running', async () => {
    const { code, stdout, stderr } = await runLiveUi([], 'http://127.0.0.1:9')

    expect(code).toBe(1)
    expect(stdout).toBe('')
    expect(stderr).toContain('http://127.0.0.1:9')
    expect(stderr).toContain('pnpm dev')
    expect(stderr).toContain('does not start')
  })

  test('says so when the server is not the Rhizome dev app', async () => {
    const server = createServer((_request, response) => response.end('not rhizome'))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    try {
      const { code, stdout, stderr } = await runLiveUi(['--screen', 'chat'], `http://127.0.0.1:${port}`)

      expect(code).toBe(1)
      expect(stdout).toBe('')
      expect(stderr).toContain('is not the Rhizome dev app')
      expect(stderr).toContain('/src/utils/uiAudit.ts')
    } finally {
      server.close()
    }
  })

  test('rejects an unknown screen name', async ({ baseURL }) => {
    const { code, stderr } = await runLiveUi(['--screen', 'nope'], baseURL!)

    expect(code).toBe(2)
    expect(stderr).toContain('Unknown screen "nope"')
    expect(stderr).toContain('chat')
  })
})
