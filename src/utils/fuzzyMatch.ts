/** Search rank tier: 0 = exact match, 1 = prefix match, 2 = fuzzy only. Lower is better. */
export function searchRank(query: string, target: string): number {
  const q = query.trim().toLowerCase()
  const t = target.trim().toLowerCase()
  if (t === q) return 0
  if (t.startsWith(q)) return 1
  return 2
}

/**
 * Rank a note by how well its title/aliases match the query.
 * Tiers: 0 = title exact, 1 = alias exact, 2 = title prefix,
 * 3 = alias prefix, 4 = fuzzy only. Lower is better.
 *
 * Title exact match (tier 0) is exclusive to the title — an alias
 * exact match only reaches tier 1, ensuring the note whose title
 * matches exactly always sorts first.
 */
export function bestSearchRank(query: string, title: string, aliases: string[]): number {
  const q = query.trim().toLowerCase()
  const t = title.trim().toLowerCase()

  if (t === q) return 0

  let aliasExact = false
  let aliasPrefix = false
  for (const alias of aliases) {
    const a = alias.trim().toLowerCase()
    if (a === q) { aliasExact = true; break }
    if (a.startsWith(q)) aliasPrefix = true
  }

  if (aliasExact) return 1
  if (t.startsWith(q)) return 2
  if (aliasPrefix) return 3
  return 4
}

/** Fuzzy match: all query chars must appear in order in the target. */
export function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  let score = 0
  let lastMatchIndex = -1

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t.charAt(ti) === q.charAt(qi)) {
      if (ti === lastMatchIndex + 1) score += 2
      const previousChar = t.charAt(ti - 1)
      if (ti === 0 || previousChar === ' ' || previousChar === '-') score += 3
      score += 1
      lastMatchIndex = ti
      qi++
    }
  }

  return { match: qi === q.length, score }
}
