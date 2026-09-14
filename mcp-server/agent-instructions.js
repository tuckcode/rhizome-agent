import path from 'node:path'
import { readContainedVaultText, vaultContext } from './vault.js'

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
