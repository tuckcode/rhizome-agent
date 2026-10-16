/**
 * Collapsed editor is `min-h-[30px]`. A single line at zoom can read
 * 31–32px, so wrap starts only after 32.
 */
export const COMPOSER_MULTILINE_THRESHOLD_PX = 32

/**
 * A wrapped draft is taller than one line even when it has no `\n`.
 * Compare the editor's scrollHeight to the zoom-tolerant floor.
 */
export function composerIsMultiline(
  editor: Pick<HTMLElement, 'scrollHeight'>,
  thresholdPx: number = COMPOSER_MULTILINE_THRESHOLD_PX,
): boolean {
  return editor.scrollHeight > thresholdPx
}
