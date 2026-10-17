export function segmentGraphemes(text: string): string[] {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (
      locales?: string | string[],
      options?: { granularity: 'grapheme' },
    ) => { segment: (input: string) => Iterable<{ segment: string }> }
  }).Segmenter
  if (Segmenter) {
    return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)]
      .map((part) => part.segment)
  }
  return [...text]
}

export function sliceGraphemes(text: string, max: number): string {
  const parts = segmentGraphemes(text)
  if (parts.length <= max) return text
  return `${parts.slice(0, max).join('')}…`
}
