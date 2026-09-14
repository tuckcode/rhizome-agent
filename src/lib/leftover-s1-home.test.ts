import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('HOME vault refuse and S1 frontmatter leftover', () => {
  it('refuses $HOME as a vault because that is #46', () => {
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/vault_list.rs`,
      'utf8',
    )
    expect(rust).toContain('fn reject_home_vault_list')
    expect(rust).toContain(
      "The home directory cannot be a vault. That scopes MCP tools to all of $HOME and writes into Prime's global settings (#46).",
    )
    expect(rust).toContain('fn save_refuses_the_home_directory_as_a_vault')
  })

  it('keeps MCP frontmatter data-only and lists executable languages without running them', () => {
    const vault = readFileSync(`${process.cwd()}/mcp-server/vault.js`, 'utf8')
    const security = readFileSync(
      `${process.cwd()}/mcp-server/vault.security.test.js`,
      'utf8',
    )
    expect(vault).toContain('EXECUTABLE_FRONTMATTER_LANGUAGES')
    expect(vault).toContain("'javascript'")
    expect(vault).toContain("'coffee'")
    expect(security).toContain("describe('S1 executable frontmatter'")
    expect(security).toContain('reads ---yaml and ---json tags as data only')
  })
})
