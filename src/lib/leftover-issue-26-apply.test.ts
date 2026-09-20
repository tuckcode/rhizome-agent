import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const indicator = readFileSync(
  `${process.cwd()}/src/components/VersionUpdateIndicator.tsx`,
  'utf8',
)
const hook = readFileSync(`${process.cwd()}/src/hooks/usePrimeUpdate.ts`, 'utf8')
const rust = readFileSync(`${process.cwd()}/src-tauri/src/prime_update.rs`, 'utf8')
const copy = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
const mock = readFileSync(`${process.cwd()}/src/mock-tauri/mock-handlers.ts`, 'utf8')

describe('leftover issue 26 in-app Chat-engine apply', () => {
  it('applies from the modal click, not GitHub as the primary path', () => {
    expect(indicator).toContain('primeActions.applyEngineUpdate()')
    expect(indicator).not.toMatch(/onUpdateNow=\{\(\) => \{\s*primeActions\.openPrimeReleasePage\(\)/)
    expect(indicator).toContain('Chat engine ${primeHeadingVersion}')
    expect(indicator).toContain('never updates the Chat engine unattended')
    expect(hook).toContain("callHost<ApplyPrimeUpdateResult>('apply_prime_update'")
    expect(hook).toContain('chatBusy:')
    expect(rust).toContain('pub fn apply_prime_update')
    expect(rust).toContain('prime_session_host::is_streaming()')
    expect(rust).toContain('Chat is still answering. Wait until the reply finishes, then update.')
    expect(copy).not.toContain('versionUpdate.primeHeading')
    expect(copy).not.toContain('versionUpdate.primeNeverAutoUpdates')
    expect(mock).toContain("version: '0.9.4'")
    expect(mock).not.toMatch(/check_prime_update:\s*\(\)\s*=>\s*null/)
    expect(mock).not.toMatch(/list_prime_sessions:\s*\(\)\s*=>\s*\[\]/)
  })
})
