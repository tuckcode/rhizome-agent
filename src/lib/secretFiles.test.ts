import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BLOCK_SECRET_FILES,
  SECRET_FILE_PATTERN_LINES,
  shouldBlockSecretFiles,
} from './secretFiles'

describe('shouldBlockSecretFiles', () => {
  it('defaults on when the setting is absent', () => {
    expect(DEFAULT_BLOCK_SECRET_FILES).toBe(true)
    expect(shouldBlockSecretFiles({})).toBe(true)
    expect(shouldBlockSecretFiles({ block_secret_files: null })).toBe(true)
  })

  it('honours an explicit false', () => {
    expect(shouldBlockSecretFiles({ block_secret_files: false })).toBe(false)
    expect(shouldBlockSecretFiles({ block_secret_files: true })).toBe(true)
  })

  it('lists the denylist patterns for the info popover', () => {
    expect(SECRET_FILE_PATTERN_LINES.length).toBeGreaterThan(0)
    expect(SECRET_FILE_PATTERN_LINES.join('\n')).toMatch(/id_rsa/)
    expect(SECRET_FILE_PATTERN_LINES.join('\n')).toMatch(/\.env\.example/)
  })
})
