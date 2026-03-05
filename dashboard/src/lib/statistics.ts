import type { Like } from '@/types/like'

export interface ReadStats {
  total: number
  read: number
  unread: number
  inProgress: number
  ignored: number
  readPercent: number
  unreadPercent: number
  inProgressPercent: number
  ignoredPercent: number
}

export function getGlobalStats(likes: Like[]): ReadStats {
  const total = likes.length
  let read = 0
  let inProgress = 0
  let ignored = 0
  for (const l of likes) {
    if (l.readState === 'read') read++
    else if (l.readState === 'in-progress') inProgress++
    else if (l.readState === 'ignore') ignored++
  }
  const unread = total - read - inProgress - ignored
  const pct = (n: number) => total === 0 ? 0 : Math.round((n / total) * 100)
  return {
    total,
    read,
    unread,
    inProgress,
    ignored,
    readPercent: pct(read),
    unreadPercent: pct(unread),
    inProgressPercent: pct(inProgress),
    ignoredPercent: pct(ignored),
  }
}

export function getStatsByYear(
  likes: Like[],
): { year: string; stats: ReadStats }[] {
  const groups = new Map<string, Like[]>()
  for (const like of likes) {
    const year = like.date.slice(0, 4)
    const arr = groups.get(year)
    if (arr) {
      arr.push(like)
    } else {
      groups.set(year, [like])
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, yearLikes]) => ({
      year,
      stats: getGlobalStats(yearLikes),
    }))
}
