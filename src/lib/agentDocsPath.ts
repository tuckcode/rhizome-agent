import { invoke } from '@tauri-apps/api/core'

let cachedAgentDocsPath: string | null | undefined

export async function getAgentDocsPath(): Promise<string | undefined> {
  if (cachedAgentDocsPath !== undefined) return cachedAgentDocsPath ?? undefined

  try {
    const path = await invoke<string>('get_agent_docs_path')
    cachedAgentDocsPath = path.trim() || null
  } catch {
    cachedAgentDocsPath = null
  }

  return cachedAgentDocsPath ?? undefined
}

export function resetAgentDocsPathCacheForTests(): void {
  cachedAgentDocsPath = undefined
}
