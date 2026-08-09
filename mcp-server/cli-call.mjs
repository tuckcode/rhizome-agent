#!/usr/bin/env node
/**
 * One-shot Rhizome MCP tool caller for Prime (and other agents).
 *
 * Usage:
 *   node cli-call.mjs <toolName> [jsonArgs]
 *
 * Env:
 *   VAULT_PATH   required vault root
 *   VAULT_PATHS  optional JSON array of vault roots
 *
 * Speaks MCP over stdio to ./index.js, prints tool text/JSON to stdout, exits.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const toolName = process.argv[2]
const argsJson = process.argv[3] ?? '{}'

if (!toolName) {
  console.error('Usage: node cli-call.mjs <toolName> [jsonArgs]')
  process.exit(2)
}

let args
try {
  args = JSON.parse(argsJson)
} catch (error) {
  console.error(`Invalid jsonArgs: ${error}`)
  process.exit(2)
}

const vaultPath = process.env.VAULT_PATH?.trim()
if (!vaultPath) {
  console.error('VAULT_PATH is required')
  process.exit(2)
}

const serverPath = path.join(__dirname, 'index.js')
const env = {
  ...process.env,
  VAULT_PATH: vaultPath,
  VAULT_PATHS: process.env.VAULT_PATHS || JSON.stringify([vaultPath]),
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env,
  stderr: 'pipe',
})

const client = new Client({ name: 'rhizome-cli-call', version: '0.1.0' }, { capabilities: {} })

try {
  await client.connect(transport)
  const result = await client.callTool({ name: toolName, arguments: args })
  const text = (result.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  if (result.isError) {
    console.error(text || JSON.stringify(result))
    process.exit(1)
  }
  process.stdout.write(text || JSON.stringify(result, null, 2))
  process.stdout.write('\n')
  await client.close()
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
