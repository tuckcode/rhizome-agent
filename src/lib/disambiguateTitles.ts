/**
 * Make every rendered title distinct.
 *
 * Observed live the first time this shipped (#13): four running sessions, none
 * with a `firstMessage` — a session with no messages yet has none — two of
 * them rooted at `/Users/dtc`. Both rows rendered as "dtc": identical, and
 * giving the user no way to tell which session was which or that they were
 * even two different sessions. A row you cannot tell apart from its neighbour
 * is not a row you can click.
 *
 * Only collisions get a suffix; a title that is already unique is left alone,
 * because appending an id to everything would make the common case noisier to
 * fix the rare one.
 *
 * **The suffix is the caller's to choose, and choosing it badly is easy.** Ids
 * differ in shape between lists: a daemon handle is random throughout, so its
 * first characters distinguish it, while a saved session's id is a uuidv7
 * whose leading characters are a *timestamp*. Measured on 93 real logs in
 * `~/.prime/agent/sessions`, the first six characters yielded 23 distinct
 * values and one prefix covered 23 sessions — a suffix that would have
 * rendered "Untitled · 01a004" twice and fixed nothing. Pick the part of the
 * id that actually varies between neighbours.
 */
export function disambiguateTitles<T extends { title: string }>(
  rows: T[],
  suffix: (row: T) => string,
  /**
   * What counts as "the same row". Defaults to the title alone, which is right
   * when the title is all the row shows. A caller whose row renders more than
   * a title should key on the whole of it — suffixing a title that sits above
   * a distinguishing second line adds noise to fix nothing. See #33.
   */
  key: (row: T) => string = (row) => row.title,
): T[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1)
  if (![...counts.values()].some((count) => count > 1)) return rows

  return rows.map((row) =>
    (counts.get(key(row)) ?? 0) > 1 ? { ...row, title: `${row.title} · ${suffix(row)}` } : row,
  )
}
