import { nativeSessionPath } from './nativeChatTranscript'

export const SESSION_TITLE_MAX_CHARS = 60

export function collapseSessionTitle(
  text: string | null | undefined,
  max = SESSION_TITLE_MAX_CHARS,
): string | null {
  if (!text) return null
  const collapsed = text.replace(/\s+/gu, ' ').trim()
  if (!collapsed) return null
  const chars = [...collapsed]
  if (chars.length <= max) return collapsed
  return `${chars.slice(0, max).join('')}…`
}

export function sessionHeaderReport(input: {
  activeSessionPath?: string | null
  primeSessionPath?: string | null
  nativeSessionId?: string | null
  firstUserMessage?: string | null
}): { path: string | null; title: string | null } | null {
  const nativePath = input.nativeSessionId
    ? nativeSessionPath(input.nativeSessionId)
    : null
  if (input.activeSessionPath && nativePath && input.activeSessionPath !== nativePath) {
    return null
  }
  if (
    input.activeSessionPath
    && input.primeSessionPath
    && input.activeSessionPath !== input.primeSessionPath
  ) {
    return null
  }
  return {
    path: input.activeSessionPath ?? input.primeSessionPath ?? nativePath ?? null,
    title: collapseSessionTitle(input.firstUserMessage),
  }
}

export function sessionTitleRefreshKey(
  isStreaming: boolean | undefined,
  path: string | null | undefined,
): string {
  return `${isStreaming ? '1' : '0'}|${path ?? ''}`
}
