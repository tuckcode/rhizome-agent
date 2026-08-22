/**
 * A DOM id for a note's row in the note list.
 *
 * Exists so the list can point `aria-activedescendant` at the row the arrow
 * keys just moved to. Without it the keyboard navigation works and announces
 * nothing: the listbox holds focus, `data-highlighted` moves, and assistive
 * technology is never told which option is active — so arrowing through a
 * vault is silent.
 *
 * A note path is not a valid id on its own: it contains `/`, spaces and dots,
 * which break selectors and CSS escaping. Every character outside `[A-Za-z0-9-]`
 * becomes `_<hex>_`, which is injective — `_` is itself escaped, so no two
 * paths can encode to the same id. Encoding rather than hashing keeps it stable
 * across renders and legible in a DOM inspector, and stability is the actual
 * requirement: `aria-activedescendant` is matched by id, so a value that
 * changes between renders points at nothing.
 */
export function noteOptionId(path: string): string {
  const safe = path.replace(/[^A-Za-z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16)}_`)
  return `note-option-${safe}`
}
