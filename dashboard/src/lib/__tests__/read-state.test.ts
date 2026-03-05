import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import { snowflakeToDate, loadReadState, applyChanges, loadBookmarkState, applyBookmarkChanges } from '../read-state'

describe('snowflakeToDate', () => {
  it('decodes a known tweet ID to the correct date', () => {
    // Tweet ID 1856551798573597051 → 2024-11-13
    expect(snowflakeToDate('1856551798573597051')).toBe('2024-11-13')
  })

  it('returns a date for an empty string (BigInt("") is 0n)', () => {
    // BigInt('') === 0n, which decodes to the Twitter epoch date
    expect(snowflakeToDate('')).toBe('2010-11-04')
  })

  it('returns "unknown" for non-numeric input', () => {
    expect(snowflakeToDate('not-a-number')).toBe('unknown')
  })
})

describe('loadReadState', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an empty Map when file is missing', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const result = loadReadState()
    expect(result.size).toBe(0)
  })

  it('parses legacy Read: Yes and Read: No correctly', () => {
    const content = `# Consolidated Liked Tweets

## 1. [Tweet 1856551798573597051](https://twitter.com/i/web/status/1856551798573597051)

- **Date**: 2024-11-13
- **Read**: Yes
- **URL**: https://example.com
- **Tweet**: Some tweet text

---

## 2. [Tweet 1234567890123456789](https://twitter.com/i/web/status/1234567890123456789)

- **Date**: 2020-01-01
- **Read**: No
- **URL**: https://example.com/2
- **Tweet**: Another tweet

---
`
    vi.spyOn(fs, 'readFileSync').mockReturnValue(content)
    const result = loadReadState()
    expect(result.get('1856551798573597051')).toBe('read')
    expect(result.get('1234567890123456789')).toBe('unread')
    expect(result.size).toBe(2)
  })

  it('parses new-format state values correctly', () => {
    const content = `# Consolidated Liked Tweets

## 1. [Tweet 1111111111111111111](https://twitter.com/i/web/status/1111111111111111111)

- **Date**: 2024-01-01
- **Read**: Read
- **Tweet**: read tweet

---

## 2. [Tweet 2222222222222222222](https://twitter.com/i/web/status/2222222222222222222)

- **Date**: 2024-01-02
- **Read**: Unread
- **Tweet**: unread tweet

---

## 3. [Tweet 3333333333333333333](https://twitter.com/i/web/status/3333333333333333333)

- **Date**: 2024-01-03
- **Read**: In-Progress
- **Tweet**: in-progress tweet

---

## 4. [Tweet 4444444444444444444](https://twitter.com/i/web/status/4444444444444444444)

- **Date**: 2024-01-04
- **Read**: Ignore
- **Tweet**: ignored tweet

---
`
    vi.spyOn(fs, 'readFileSync').mockReturnValue(content)
    const result = loadReadState()
    expect(result.get('1111111111111111111')).toBe('read')
    expect(result.get('2222222222222222222')).toBe('unread')
    expect(result.get('3333333333333333333')).toBe('in-progress')
    expect(result.get('4444444444444444444')).toBe('ignore')
    expect(result.size).toBe(4)
  })

  it('returns empty Map for file with no tweet headings', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('# Just a title\n\nSome text\n')
    const result = loadReadState()
    expect(result.size).toBe(0)
  })
})

describe('applyChanges', () => {
  const sampleContent = `# Consolidated Liked Tweets

## 1. [Tweet 1856551798573597051](https://twitter.com/i/web/status/1856551798573597051)

- **Date**: 2024-11-13
- **Read**: No
- **URL**: https://example.com
- **Tweet**: Some tweet text

---

## 2. [Tweet 1234567890123456789](https://twitter.com/i/web/status/1234567890123456789)

- **Date**: 2020-01-01
- **Read**: Yes
- **URL**: https://example.com/2
- **Tweet**: Another tweet

---

## 3. [Tweet 9999999999999999999](https://twitter.com/i/web/status/9999999999999999999)

- **Date**: 2023-06-15
- **Read**: No
- **URL**: https://example.com/3
- **Tweet**: Third tweet

---
`

  it('changes Read: No → Read (new format) for a matching tweetId', () => {
    const { content, updated } = applyChanges(sampleContent, { '1856551798573597051': 'read' })
    expect(updated).toBe(1)
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.includes('[Tweet 1856551798573597051]'))
    const readLine = lines.slice(idx).find((l) => l.includes('**Read**'))
    expect(readLine).toBe('- **Read**: Read')
  })

  it('changes Read: Yes → Unread (new format) for a matching tweetId', () => {
    const { content, updated } = applyChanges(sampleContent, { '1234567890123456789': 'unread' })
    expect(updated).toBe(1)
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.includes('[Tweet 1234567890123456789]'))
    const readLine = lines.slice(idx).find((l) => l.includes('**Read**'))
    expect(readLine).toBe('- **Read**: Unread')
  })

  it('sets In-Progress state', () => {
    const { content, updated } = applyChanges(sampleContent, { '1856551798573597051': 'in-progress' })
    expect(updated).toBe(1)
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.includes('[Tweet 1856551798573597051]'))
    const readLine = lines.slice(idx).find((l) => l.includes('**Read**'))
    expect(readLine).toBe('- **Read**: In-Progress')
  })

  it('sets Ignore state', () => {
    const { content, updated } = applyChanges(sampleContent, { '9999999999999999999': 'ignore' })
    expect(updated).toBe(1)
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.includes('[Tweet 9999999999999999999]'))
    const readLine = lines.slice(idx).find((l) => l.includes('**Read**'))
    expect(readLine).toBe('- **Read**: Ignore')
  })

  it('handles multiple changes in one call', () => {
    const { content, updated } = applyChanges(sampleContent, {
      '1856551798573597051': 'read',
      '1234567890123456789': 'in-progress',
      '9999999999999999999': 'ignore',
    })
    expect(updated).toBe(3)
    const lines = content.split('\n')

    const idx1 = lines.findIndex((l) => l.includes('[Tweet 1856551798573597051]'))
    expect(lines.slice(idx1).find((l) => l.includes('**Read**'))).toBe('- **Read**: Read')

    const idx2 = lines.findIndex((l) => l.includes('[Tweet 1234567890123456789]'))
    expect(lines.slice(idx2).find((l) => l.includes('**Read**'))).toBe('- **Read**: In-Progress')

    const idx3 = lines.findIndex((l) => l.includes('[Tweet 9999999999999999999]'))
    expect(lines.slice(idx3).find((l) => l.includes('**Read**'))).toBe('- **Read**: Ignore')
  })

  it('leaves non-matching entries untouched', () => {
    const { content, updated } = applyChanges(sampleContent, { '1856551798573597051': 'read' })
    expect(updated).toBe(1)
    const lines = content.split('\n')
    const idx2 = lines.findIndex((l) => l.includes('[Tweet 1234567890123456789]'))
    expect(lines.slice(idx2).find((l) => l.includes('**Read**'))).toBe('- **Read**: Yes')
    const idx3 = lines.findIndex((l) => l.includes('[Tweet 9999999999999999999]'))
    expect(lines.slice(idx3).find((l) => l.includes('**Read**'))).toBe('- **Read**: No')
  })

  it('preserves exact formatting (no extra whitespace changes)', () => {
    const { content } = applyChanges(sampleContent, { '1856551798573597051': 'read' })
    const originalLines = sampleContent.split('\n')
    const newLines = content.split('\n')
    expect(newLines.length).toBe(originalLines.length)

    let diffCount = 0
    for (let i = 0; i < originalLines.length; i++) {
      if (originalLines[i] !== newLines[i]) diffCount++
    }
    expect(diffCount).toBe(1)
  })

  it('does not count a no-op change (already in desired state)', () => {
    // Content with new-format values
    const newContent = sampleContent.replace('- **Read**: Yes', '- **Read**: Read')
    const { updated } = applyChanges(newContent, { '1234567890123456789': 'read' })
    expect(updated).toBe(0)
  })
})

describe('loadBookmarkState', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an empty Map when file is missing', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const result = loadBookmarkState()
    expect(result.size).toBe(0)
  })

  it('parses Bookmark: Yes and Bookmark: No correctly', () => {
    const content = `# Consolidated Liked Tweets

## 1. [Tweet 1856551798573597051](https://twitter.com/i/web/status/1856551798573597051)

- **Date**: 2024-11-13
- **Read**: Read
- **Bookmark**: Yes
- **URL**: https://example.com
- **Tweet**: Some tweet text

---

## 2. [Tweet 1234567890123456789](https://twitter.com/i/web/status/1234567890123456789)

- **Date**: 2020-01-01
- **Read**: Unread
- **Bookmark**: No
- **URL**: https://example.com/2
- **Tweet**: Another tweet

---
`
    vi.spyOn(fs, 'readFileSync').mockReturnValue(content)
    const result = loadBookmarkState()
    expect(result.get('1856551798573597051')).toBe(true)
    expect(result.get('1234567890123456789')).toBe(false)
    expect(result.size).toBe(2)
  })
})

describe('applyBookmarkChanges', () => {
  const sampleContent = `# Consolidated Liked Tweets

## 1. [Tweet 1856551798573597051](https://twitter.com/i/web/status/1856551798573597051)

- **Date**: 2024-11-13
- **Read**: No
- **Bookmark**: No
- **URL**: https://example.com
- **Tweet**: Some tweet text

---

## 2. [Tweet 1234567890123456789](https://twitter.com/i/web/status/1234567890123456789)

- **Date**: 2020-01-01
- **Read**: Yes
- **Bookmark**: Yes
- **URL**: https://example.com/2
- **Tweet**: Another tweet

---
`

  it('changes Bookmark: No → Yes for a matching tweetId', () => {
    const { content, updated } = applyBookmarkChanges(sampleContent, { '1856551798573597051': true })
    expect(updated).toBe(1)
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.includes('[Tweet 1856551798573597051]'))
    const bmLine = lines.slice(idx).find((l) => l.includes('**Bookmark**'))
    expect(bmLine).toBe('- **Bookmark**: Yes')
  })

  it('changes Bookmark: Yes → No for a matching tweetId', () => {
    const { content, updated } = applyBookmarkChanges(sampleContent, { '1234567890123456789': false })
    expect(updated).toBe(1)
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.includes('[Tweet 1234567890123456789]'))
    const bmLine = lines.slice(idx).find((l) => l.includes('**Bookmark**'))
    expect(bmLine).toBe('- **Bookmark**: No')
  })

  it('does not count a no-op bookmark change', () => {
    const { updated } = applyBookmarkChanges(sampleContent, { '1234567890123456789': true })
    expect(updated).toBe(0)
  })

  it('handles multiple bookmark changes in one call', () => {
    const { content, updated } = applyBookmarkChanges(sampleContent, {
      '1856551798573597051': true,
      '1234567890123456789': false,
    })
    expect(updated).toBe(2)
    const lines = content.split('\n')
    const idx1 = lines.findIndex((l) => l.includes('[Tweet 1856551798573597051]'))
    expect(lines.slice(idx1).find((l) => l.includes('**Bookmark**'))).toBe('- **Bookmark**: Yes')
    const idx2 = lines.findIndex((l) => l.includes('[Tweet 1234567890123456789]'))
    expect(lines.slice(idx2).find((l) => l.includes('**Bookmark**'))).toBe('- **Bookmark**: No')
  })
})
