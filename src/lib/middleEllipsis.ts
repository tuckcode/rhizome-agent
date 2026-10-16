/** Middle ellipsis for long model ids that would otherwise clip at the end. */
export function middleEllipsis(text: string, maxChars: number): string {
  if (maxChars < 2 || text.length <= maxChars) return text
  const keep = maxChars - 1
  const head = Math.ceil(keep / 2)
  const tail = Math.floor(keep / 2)
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`
}

/** Fits the composer chip at 11px mono in `max-w-[8.5rem]`. */
export const NATIVE_CHAT_MODEL_CHIP_LABEL_MAX_CHARS = 18
