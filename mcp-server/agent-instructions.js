import path from 'node:path'
import { readContainedVaultText, vaultContext } from './vault.js'

// Sent once in the MCP initialize reply, so clients see it without a tool
// call. Static on purpose: no vault paths or dates, so it never breaks a
// client's prompt cache. Vault-specific rules stay in AGENTS.md.
export const SERVER_INSTRUCTIONS = `Rhizome is the user's long-term knowledge vault: plain Markdown notes on their disk.

Read before answering:
- Call get_vault_context once per session for the vault's own AGENTS.md conventions.
- Use rhizome_search when the user's question may already be answered in the vault (past decisions, research, how something works).

Save durable knowledge with rhizome_distill when the conversation produces it:
- a decision and its reasoning;
- a workflow, integration detail or failure mode that was worked out;
- a durable fact the user states;
- any "remember this" / "save this to the wiki".
Do not save one-off requests, dead ends, or what the vault already holds.

Keep how-to-work-with-the-user preferences in your own client memory, not here. Rhizome holds knowledge.`

export async function readAgentInstructions(vaultPath) {
  const content = await readContainedVaultText(vaultPath, 'AGENTS.md')
  if (content === null) return null
  return {
    path: path.join(vaultPath, 'AGENTS.md'),
    content,
  }
}

export async function vaultContextWithInstructions(vaultPath) {
  return {
    ...(await vaultContext(vaultPath)),
    agentInstructions: await readAgentInstructions(vaultPath),
  }
}
