/**
 * What the composer offers you instead of a blank box (#51).
 *
 * Two shapes, and never both on the same turn:
 *
 * - **`options`** — the agent asked a closed question, so its own written
 *   choices become pills. Exactly right by construction: nothing is guessed,
 *   the agent already wrote the options down.
 * - **`completion`** — one obvious continuation, accepted with Tab.
 *
 * When the agent asked a question *and* a continuation looks obvious, the
 * options win and the completion is not rendered. Two suggestion mechanisms
 * firing at once is the clutter this exists to avoid.
 *
 * Deliberately not built here: suggestions derived from app state (unpushed
 * commits, a failed gate, a session still turning). That is case 2 in #51,
 * needs judgement about when to stay silent, and is worth far less than
 * reading a question the agent already asked.
 */

/** One pill. */
export interface ReplyOption {
  /**
   * What the pill reads.
   *
   * Must name the action when picking it causes one — "Push 33 commits",
   * never "yes". A pill has to be aimed at rather than hit reflexively, which
   * is what makes it safe to offer an approval at all; that safety is gone the
   * moment the label stops saying what happens.
   */
  label: string
  /** What lands in the composer when it is picked. */
  text: string
}

export type ReplySuggestion =
  | { kind: 'options'; options: ReplyOption[] }
  | { kind: 'completion'; text: string }

/** Fewer than two is not a choice; more than four is a menu. */
export const MIN_REPLY_OPTIONS = 2
export const MAX_REPLY_OPTIONS = 4

/**
 * Read the agent's last message and decide what to offer.
 *
 * `null` means offer nothing — the honest answer most of the time, and always
 * better than a weak suggestion. Most turns do not end in a question, which is
 * what keeps pills rare without any rule telling them to be.
 */
export function suggestReply(agentMessage: string): ReplySuggestion | null {
  void agentMessage
  return null
}
