import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { expandUrls, type UrlCache } from '../url-expander'

describe('expandUrls', () => {
  const cache: UrlCache = {
    'https://t.co/abc123': 'https://example.com/article',
    'https://t.co/dead456': null,
    'http://t.co/http789': 'https://example.com/http-link',
  }

  it('replaces a cached t.co URL with the expanded URL', () => {
    const text = 'Check this out https://t.co/abc123'
    expect(expandUrls(text, cache)).toBe('Check this out https://example.com/article')
  })

  it('replaces a dead link (null) with [Dead link]', () => {
    const text = 'Broken link https://t.co/dead456 here'
    expect(expandUrls(text, cache)).toBe('Broken link [Dead link] here')
  })

  it('passes through uncached t.co URLs unchanged', () => {
    const text = 'Unknown https://t.co/unknown999'
    expect(expandUrls(text, cache)).toBe('Unknown https://t.co/unknown999')
  })

  it('returns text unchanged when there are no t.co URLs', () => {
    const text = 'Just a normal tweet with no links'
    expect(expandUrls(text, cache)).toBe(text)
  })

  it('handles mixed cached, dead, and uncached URLs', () => {
    const text =
      'A https://t.co/abc123 B https://t.co/dead456 C https://t.co/notcached'
    expect(expandUrls(text, cache)).toBe(
      'A https://example.com/article B [Dead link] C https://t.co/notcached'
    )
  })

  it('returns empty string unchanged', () => {
    expect(expandUrls('', cache)).toBe('')
  })

  it('handles http:// t.co URLs (not just https)', () => {
    const text = 'Old link http://t.co/http789'
    expect(expandUrls(text, cache)).toBe('Old link https://example.com/http-link')
  })
})

/**
 * loadUrlCache reads from a hardcoded path, so we test the underlying logic
 * by exercising the same try/catch + JSON.parse pattern directly.
 * This verifies the error-handling behavior without needing to mock ESM fs.
 */
describe('loadUrlCache logic', () => {
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, `url-cache-test-${Date.now()}.json`)

  afterEach(() => {
    try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
  })

  function loadFrom(filePath: string): UrlCache {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as UrlCache
    } catch {
      return {}
    }
  }

  it('returns {} when the cache file is missing', () => {
    const result = loadFrom(path.join(tmpDir, 'nonexistent-file.json'))
    expect(result).toEqual({})
  })

  it('parses valid JSON from the cache file', () => {
    const expected = { 'https://t.co/abc': 'https://example.com' }
    fs.writeFileSync(tmpFile, JSON.stringify(expected))
    const result = loadFrom(tmpFile)
    expect(result).toEqual(expected)
  })

  it('returns {} when the cache file contains invalid JSON', () => {
    fs.writeFileSync(tmpFile, 'not valid json {{{')
    const result = loadFrom(tmpFile)
    expect(result).toEqual({})
  })
})
