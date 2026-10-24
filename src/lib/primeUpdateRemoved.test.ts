import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// ADR-0189: Prime is no longer a chat engine, so Rhizome must not offer to
// update the outside prime-agent CLI. Guards against the path coming back.
const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8')

describe('Prime update path is removed (ADR-0189)', () => {
  it('has no Prime update hook, banner, or Rust module', () => {
    expect(existsSync(`${root}/src/hooks/usePrimeUpdate.ts`)).toBe(false)
    expect(existsSync(`${root}/src/components/ChatEngineUpdateBanner.tsx`)).toBe(false)
    expect(existsSync(`${root}/src-tauri/src/prime_update.rs`)).toBe(false)
  })

  it('registers and mocks no Prime update command', () => {
    for (const path of [
      'src-tauri/src/lib.rs',
      'src-tauri/src/commands/system.rs',
      'src/mock-tauri/mock-handlers.ts',
    ]) {
      expect(read(path)).not.toMatch(/check_prime_update|apply_prime_update/)
    }
  })

  it('offers no Chat engine update in the app chrome', () => {
    for (const path of [
      'src/App.tsx',
      'src/components/ChatHome.tsx',
      'src/components/VersionUpdateIndicator.tsx',
    ]) {
      const source = read(path)
      expect(source).not.toMatch(/usePrimeUpdate|ChatEngineUpdate|chatEngineUpdate|Chat engine/)
    }
  })
})
