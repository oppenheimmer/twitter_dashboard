import { describe, it, expect } from 'vitest'
import { getYearsFromLikes, getYearPageMap, getYearDividers } from '../year-groups'
import type { Like } from '@/types/like'

function makeLike(tweetId: string, date: string): Like {
  return { tweetId, fullText: '', expandedUrl: '', date, readState: 'unread', bookmarked: false }
}

describe('getYearsFromLikes', () => {
  it('returns empty array for no likes', () => {
    expect(getYearsFromLikes([])).toEqual([])
  })

  it('returns single year', () => {
    const likes = [makeLike('1', '2022-03-01'), makeLike('2', '2022-05-10')]
    expect(getYearsFromLikes(likes)).toEqual(['2022'])
  })

  it('returns multiple years in order of appearance', () => {
    const likes = [
      makeLike('1', '2023-01-01'),
      makeLike('2', '2022-06-15'),
      makeLike('3', '2024-11-01'),
    ]
    expect(getYearsFromLikes(likes)).toEqual(['2023', '2022', '2024'])
  })

  it('deduplicates years', () => {
    const likes = [
      makeLike('1', '2022-01-01'),
      makeLike('2', '2023-06-15'),
      makeLike('3', '2022-12-01'),
    ]
    expect(getYearsFromLikes(likes)).toEqual(['2022', '2023'])
  })

  it('handles unknown dates', () => {
    const likes = [makeLike('1', 'unknown')]
    expect(getYearsFromLikes(likes)).toEqual(['unkn'])
  })
})

describe('getYearPageMap', () => {
  it('maps single page correctly', () => {
    const likes = [makeLike('1', '2022-01-01'), makeLike('2', '2022-06-01')]
    const map = getYearPageMap(likes, 50)
    expect(map.get('2022')).toBe(1)
  })

  it('maps year at page boundary', () => {
    const likes = [
      ...Array.from({ length: 50 }, (_, i) => makeLike(String(i), '2022-01-01')),
      makeLike('50', '2023-03-01'),
    ]
    const map = getYearPageMap(likes, 50)
    expect(map.get('2022')).toBe(1)
    expect(map.get('2023')).toBe(2)
  })

  it('uses first occurrence when year spans pages', () => {
    const likes = [
      ...Array.from({ length: 60 }, (_, i) => makeLike(String(i), '2022-01-01')),
    ]
    const map = getYearPageMap(likes, 50)
    expect(map.get('2022')).toBe(1)
  })
})

describe('getYearDividers', () => {
  it('returns empty for no items', () => {
    expect(getYearDividers([])).toEqual([])
  })

  it('returns single divider for one-year page', () => {
    const visible = [makeLike('1', '2022-03-01'), makeLike('2', '2022-06-01')]
    expect(getYearDividers(visible)).toEqual([{ year: '2022', beforeIndex: 0 }])
  })

  it('returns dividers at year transitions', () => {
    const visible = [
      makeLike('1', '2022-01-01'),
      makeLike('2', '2022-06-01'),
      makeLike('3', '2023-01-01'),
      makeLike('4', '2024-05-01'),
    ]
    expect(getYearDividers(visible)).toEqual([
      { year: '2022', beforeIndex: 0 },
      { year: '2023', beforeIndex: 2 },
      { year: '2024', beforeIndex: 3 },
    ])
  })

  it('handles unknown dates', () => {
    const visible = [makeLike('1', 'unknown'), makeLike('2', '2022-01-01')]
    expect(getYearDividers(visible)).toEqual([
      { year: 'unkn', beforeIndex: 0 },
      { year: '2022', beforeIndex: 1 },
    ])
  })
})
