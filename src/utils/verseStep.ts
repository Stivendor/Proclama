export type VerseStep =
  | { kind: 'same-chapter'; index: number }
  | { kind: 'other-chapter'; chapter: number; edge: 'first' | 'last' }
  | { kind: 'none' }

/**
 * Decide a qué versículo saltar al pulsar una flecha en la Biblia.
 * No salta de libro: en el borde del libro devuelve 'none'.
 */
export function planVerseStep({
  currentIndex,
  verseCount,
  chapter,
  chapterCount,
  dir,
}: {
  currentIndex: number
  verseCount: number
  chapter: number
  chapterCount: number
  dir: 1 | -1
}): VerseStep {
  if (currentIndex < 0) return { kind: 'none' }

  const target = currentIndex + dir
  if (target >= 0 && target < verseCount) return { kind: 'same-chapter', index: target }

  const nextChapter = chapter + dir
  if (nextChapter < 1 || nextChapter > chapterCount) return { kind: 'none' }

  return { kind: 'other-chapter', chapter: nextChapter, edge: dir === 1 ? 'first' : 'last' }
}
