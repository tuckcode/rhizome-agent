import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { vaultContext } from './vault.js'

export async function readAgentInstructions(vaultPath) {
  const instructionsPath = path.join(vaultPath, 'AGENTS.md')
  try {
    return {
      path: instructionsPath,
      content: await readFile(instructionsPath, 'utf8'),
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export async function vaultContextWithInstructions(vaultPath) {
  return {
    ...(await vaultContext(vaultPath)),
    agentInstructions: await readAgentInstructions(vaultPath),
  }
}
