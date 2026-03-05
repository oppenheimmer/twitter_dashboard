import type { Like } from '@/types/like'

/** Returns unique years in order of appearance. */
export function getYearsFromLikes(likes: Like[]): string[] {
  const seen = new Set<string>()
  const years: string[] = []
  for (const like of likes) {
    const year = like.date.slice(0, 4) || 'unknown'
    if (!seen.has(year)) {
      seen.add(year)
      years.push(year)
    }
  }
  return years
}

/** Maps each year to the 1-based page number where it first appears. */
export function getYearPageMap(likes: Like[], pageSize: number): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < likes.length; i++) {
    const year = likes[i].date.slice(0, 4) || 'unknown'
    if (!map.has(year)) {
      map.set(year, Math.floor(i / pageSize) + 1)
    }
  }
  return map
}

/** Returns positions where year headings should be inserted in a single page of tweets. */
export function getYearDividers(visible: Like[]): { year: string; beforeIndex: number }[] {
  if (visible.length === 0) return []
  const dividers: { year: string; beforeIndex: number }[] = []
  let prevYear: string | null = null
  for (let i = 0; i < visible.length; i++) {
    const year = visible[i].date.slice(0, 4) || 'unknown'
    if (year !== prevYear) {
      dividers.push({ year, beforeIndex: i })
      prevYear = year
    }
  }
  return dividers
}
