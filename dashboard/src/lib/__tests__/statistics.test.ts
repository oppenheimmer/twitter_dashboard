import { describe, it, expect } from 'vitest'
import { getGlobalStats, getStatsByYear } from '../statistics'
import type { Like, ReadState } from '@/types/like'

function makeLike(tweetId: string, date: string, readState: ReadState): Like {
  return { tweetId, fullText: '', expandedUrl: '', date, readState, bookmarked: false }
}

describe('getGlobalStats', () => {
  it('returns zeros for empty array', () => {
    expect(getGlobalStats([])).toEqual({
      total: 0,
      read: 0,
      unread: 0,
      inProgress: 0,
      ignored: 0,
      readPercent: 0,
      unreadPercent: 0,
      inProgressPercent: 0,
      ignoredPercent: 0,
    })
  })

  it('counts all read', () => {
    const likes = [
      makeLike('1', '2022-01-01', 'read'),
      makeLike('2', '2022-06-01', 'read'),
    ]
    expect(getGlobalStats(likes)).toEqual({
      total: 2,
      read: 2,
      unread: 0,
      inProgress: 0,
      ignored: 0,
      readPercent: 100,
      unreadPercent: 0,
      inProgressPercent: 0,
      ignoredPercent: 0,
    })
  })

  it('counts all unread', () => {
    const likes = [
      makeLike('1', '2022-01-01', 'unread'),
      makeLike('2', '2022-06-01', 'unread'),
      makeLike('3', '2023-01-01', 'unread'),
    ]
    expect(getGlobalStats(likes)).toEqual({
      total: 3,
      read: 0,
      unread: 3,
      inProgress: 0,
      ignored: 0,
      readPercent: 0,
      unreadPercent: 100,
      inProgressPercent: 0,
      ignoredPercent: 0,
    })
  })

  it('handles all four states', () => {
    const likes = [
      makeLike('1', '2022-01-01', 'read'),
      makeLike('2', '2022-06-01', 'unread'),
      makeLike('3', '2023-01-01', 'in-progress'),
      makeLike('4', '2023-06-01', 'ignore'),
    ]
    expect(getGlobalStats(likes)).toEqual({
      total: 4,
      read: 1,
      unread: 1,
      inProgress: 1,
      ignored: 1,
      readPercent: 25,
      unreadPercent: 25,
      inProgressPercent: 25,
      ignoredPercent: 25,
    })
  })

  it('handles mixed states with correct percentages', () => {
    const likes = [
      makeLike('1', '2022-01-01', 'read'),
      makeLike('2', '2022-06-01', 'read'),
      makeLike('3', '2023-01-01', 'in-progress'),
    ]
    expect(getGlobalStats(likes)).toEqual({
      total: 3,
      read: 2,
      unread: 0,
      inProgress: 1,
      ignored: 0,
      readPercent: 67,
      unreadPercent: 0,
      inProgressPercent: 33,
      ignoredPercent: 0,
    })
  })
})

describe('getStatsByYear', () => {
  it('returns empty array for no likes', () => {
    expect(getStatsByYear([])).toEqual([])
  })

  it('groups by year sorted ascending', () => {
    const likes = [
      makeLike('1', '2023-05-01', 'read'),
      makeLike('2', '2022-03-01', 'unread'),
      makeLike('3', '2022-06-01', 'in-progress'),
      makeLike('4', '2024-11-01', 'ignore'),
    ]
    const result = getStatsByYear(likes)
    expect(result).toEqual([
      { year: '2022', stats: { total: 2, read: 0, unread: 1, inProgress: 1, ignored: 0, readPercent: 0, unreadPercent: 50, inProgressPercent: 50, ignoredPercent: 0 } },
      { year: '2023', stats: { total: 1, read: 1, unread: 0, inProgress: 0, ignored: 0, readPercent: 100, unreadPercent: 0, inProgressPercent: 0, ignoredPercent: 0 } },
      { year: '2024', stats: { total: 1, read: 0, unread: 0, inProgress: 0, ignored: 1, readPercent: 0, unreadPercent: 0, inProgressPercent: 0, ignoredPercent: 100 } },
    ])
  })

  it('handles single year', () => {
    const likes = [
      makeLike('1', '2022-01-01', 'read'),
      makeLike('2', '2022-12-31', 'unread'),
    ]
    const result = getStatsByYear(likes)
    expect(result).toHaveLength(1)
    expect(result[0].year).toBe('2022')
    expect(result[0].stats.total).toBe(2)
  })

  it('handles unknown dates', () => {
    const likes = [
      makeLike('1', 'unknown', 'unread'),
      makeLike('2', '2022-01-01', 'read'),
    ]
    const result = getStatsByYear(likes)
    expect(result).toEqual([
      { year: '2022', stats: { total: 1, read: 1, unread: 0, inProgress: 0, ignored: 0, readPercent: 100, unreadPercent: 0, inProgressPercent: 0, ignoredPercent: 0 } },
      { year: 'unkn', stats: { total: 1, read: 0, unread: 1, inProgress: 0, ignored: 0, readPercent: 0, unreadPercent: 100, inProgressPercent: 0, ignoredPercent: 0 } },
    ])
  })
})
