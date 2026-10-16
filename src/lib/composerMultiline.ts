/** Collapsed composer editor height: `min-h-[30px]` hugs the send control. */
export const COMPOSER_SINGLE_LINE_HEIGHT_PX = 30

/**
 * A wrapped draft is taller than one line even when it has no `\n`.
 * Compare the editor's scrollHeight to that single-line floor.
 */
export function composerIsMultiline(
  editor: Pick<HTMLElement, 'scrollHeight'>,
  singleLineHeightPx: number = COMPOSER_SINGLE_LINE_HEIGHT_PX,
): boolean {
  return editor.scrollHeight > singleLineHeightPx
}
