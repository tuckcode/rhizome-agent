import { sliceGraphemes } from './graphemeSlice'
import { nativeSessionPath } from './nativeChatTranscript'

export const SESSION_TITLE_MAX_CHARS = 60

export function collapseSessionTitle(
  text: string | null | undefined,
  max = SESSION_TITLE_MAX_CHARS,
): string | null {
  if (!text) return null
  const collapsed = text.replace(/\s+/gu, ' ').trim()
  if (!collapsed) return null
  return sliceGraphemes(collapsed, max)
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
  // A new path with no native id yet still holds leftover messages from the
  // previous conversation. Only trust firstUserMessage when this path already
  // owns a session, or when no path has been selected yet.
  const titleTrusted = !input.activeSessionPath
    || Boolean(nativePath && input.activeSessionPath === nativePath)
    || Boolean(input.primeSessionPath && input.activeSessionPath === input.primeSessionPath)
  return {
    path: input.activeSessionPath ?? input.primeSessionPath ?? nativePath ?? null,
    title: titleTrusted ? collapseSessionTitle(input.firstUserMessage) : null,
  }
}

export function sessionTitleRefreshKey(
  isStreaming: boolean | undefined,
  path: string | null | undefined,
): string {
  return `${isStreaming ? '1' : '0'}|${path ?? ''}`
}
