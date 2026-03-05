import { describe, it, expect } from 'vitest'
import { extractWordFrequencies, findTweetsWithWord, STOP_WORDS } from '../word-cloud'
import type { Like } from '@/types/like'

function makeLike(tweetId: string, fullText: string): Like {
  return { tweetId, fullText, expandedUrl: '', date: '2024-01-01', readState: 'unread', bookmarked: false }
}

describe('STOP_WORDS', () => {
  it('contains common English words', () => {
    expect(STOP_WORDS.has('the')).toBe(true)
    expect(STOP_WORDS.has('and')).toBe(true)
    expect(STOP_WORDS.has('but')).toBe(true)
    expect(STOP_WORDS.has('not')).toBe(true)
  })

  it('contains Twitter-specific words', () => {
    expect(STOP_WORDS.has('rt')).toBe(true)
    expect(STOP_WORDS.has('amp')).toBe(true)
    expect(STOP_WORDS.has('via')).toBe(true)
    expect(STOP_WORDS.has('tweet')).toBe(true)
    expect(STOP_WORDS.has('thread')).toBe(true)
    expect(STOP_WORDS.has('lol')).toBe(true)
  })
})

describe('extractWordFrequencies', () => {
  it('counts word frequencies from texts', () => {
    const result = extractWordFrequencies([
      'hello dragon hello',
      'hello again dragon',
    ])
    const hello = result.find((w) => w.word === 'hello')
    const dragon = result.find((w) => w.word === 'dragon')
    expect(hello).toEqual({ word: 'hello', count: 3 })
    expect(dragon).toEqual({ word: 'dragon', count: 2 })
  })

  it('filters out stop words', () => {
    const result = extractWordFrequencies(['the quick brown fox jumps over the lazy dog'])
    const words = result.map((w) => w.word)
    expect(words).not.toContain('the')
    expect(words).not.toContain('over')
    expect(words).toContain('quick')
    expect(words).toContain('brown')
    expect(words).toContain('fox')
  })

  it('strips URLs from text', () => {
    const result = extractWordFrequencies([
      'check https://example.com/foo and t.co/abc123 bar',
    ])
    const words = result.map((w) => w.word)
    expect(words).not.toContain('https')
    expect(words).not.toContain('example')
    expect(words).not.toContain('abc123')
    expect(words).toContain('check')
    expect(words).toContain('bar')
  })

  it('removes [Dead link] markers', () => {
    const result = extractWordFrequencies(['hello [Dead link] dragon'])
    const words = result.map((w) => w.word)
    expect(words).not.toContain('dead')
    expect(words).not.toContain('link')
    expect(words).toContain('hello')
  })

  it('respects maxWords limit', () => {
    // Generate 200 unique words (alpha only, all >= 3 char, not stop words)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'
    const words: string[] = []
    for (let i = 0; i < 200; i++) {
      const a = alphabet[i % 26]
      const b = alphabet[Math.floor(i / 26) % 26]
      words.push(`zzz${a}${b}`)
    }
    const text = words.join(' ')
    const result = extractWordFrequencies([text], 10)
    expect(result.length).toBe(10)
  })

  it('returns empty array for empty input', () => {
    expect(extractWordFrequencies([])).toEqual([])
    expect(extractWordFrequencies([''])).toEqual([])
  })

  it('filters words shorter than 3 characters', () => {
    const result = extractWordFrequencies(['go do it now testing'])
    const words = result.map((w) => w.word)
    expect(words).not.toContain('go')
    expect(words).toContain('testing')
  })
})

describe('findTweetsWithWord', () => {
  const likes = [
    makeLike('100', 'hello dragon testing'),
    makeLike('300', 'hello again testing more'),
    makeLike('200', 'dragon hello zebra'),
  ]

  it('finds tweets containing the exact word', () => {
    const result = findTweetsWithWord(likes, 'testing')
    expect(result).toHaveLength(2)
    expect(result.map((l) => l.tweetId)).toEqual(['300', '100'])
  })

  it('sorts results newest-first by tweetId', () => {
    const result = findTweetsWithWord(likes, 'hello')
    expect(result.map((l) => l.tweetId)).toEqual(['300', '200', '100'])
  })

  it('does not match substrings', () => {
    const testLikes = [
      makeLike('1', 'testing zebra'),
      makeLike('2', 'this is a test case'),
    ]
    const result = findTweetsWithWord(testLikes, 'test')
    // 'test' should match 'test' but not 'testing'
    expect(result).toHaveLength(1)
    expect(result[0].tweetId).toBe('2')
  })

  it('returns empty array when no matches', () => {
    const result = findTweetsWithWord(likes, 'nonexistent')
    expect(result).toEqual([])
  })
})
