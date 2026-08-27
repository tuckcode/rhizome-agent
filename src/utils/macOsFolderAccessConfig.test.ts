import { readFileSync } from 'node:fs'

/**
 * macOS gates Documents, Desktop and Downloads behind TCC. An app only gets a
 * permission prompt for one of them if its Info.plist declares the matching
 * usage string — no key, no prompt, and no way for the user to grant access
 * from inside the app.
 *
 * Rhizome hands the vault path to Prime as the session's working directory
 * (`prime_session_host::create_session`). When the vault lives in a protected
 * folder and the app was never granted access, the Prime session worker dies
 * at launch on `process.cwd()` with `EPERM: uv_cwd`, the supervisor waits 30s
 * for a worker socket that never appears, and chat fails with a generic
 * timeout that looks like a model problem. Diagnosed 2026-08-27; C53.
 *
 * Vaults in `~/Documents` are the common case, so these keys are load-bearing.
 */
describe('macOS protected-folder access', () => {
  const plist = readFileSync(`${process.cwd()}/src-tauri/Info.plist`, 'utf8')

  it.each([
    ['NSDocumentsFolderUsageDescription', 'Documents'],
    ['NSDesktopFolderUsageDescription', 'Desktop'],
    ['NSDownloadsFolderUsageDescription', 'Downloads'],
  ])('declares %s so macOS can prompt for a vault in %s', (key) => {
    expect(plist).toContain(`<key>${key}</key>`)
  })

  it('gives every usage key a non-empty reason, since macOS shows it verbatim', () => {
    const pairs = [...plist.matchAll(/<key>(NS\w*UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g)]
    expect(pairs.length).toBeGreaterThanOrEqual(4)
    for (const [, key, reason] of pairs) {
      expect(reason.trim(), `${key} needs a reason the user will read`).not.toBe('')
    }
  })
})
