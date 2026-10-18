const STORAGE_KEY = 'rhizome.visionSendAnyway'

function readIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function visionSendAnywayFor(modelId: string | null | undefined): boolean {
  const id = modelId?.trim()
  if (!id) return false
  return readIds().includes(id)
}

export function rememberVisionSendAnyway(modelId: string | null | undefined): void {
  const id = modelId?.trim()
  if (!id) return
  const ids = readIds()
  if (ids.includes(id)) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id]))
}

export function forgetVisionSendAnyway(modelId: string | null | undefined): void {
  const id = modelId?.trim()
  if (!id) return
  const ids = readIds().filter((saved) => saved !== id)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}
