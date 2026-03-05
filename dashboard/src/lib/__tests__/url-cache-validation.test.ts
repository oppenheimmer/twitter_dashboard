import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const CACHE_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'asset', 'url-cache.json')
const cacheExists = fs.existsSync(CACHE_PATH)

describe.skipIf(!cacheExists)('url-cache.json validation', () => {
  let raw: string
  let cache: Record<string, unknown>

  it('is valid JSON', () => {
    raw = fs.readFileSync(CACHE_PATH, 'utf-8')
    cache = JSON.parse(raw)
    expect(typeof cache).toBe('object')
    expect(cache).not.toBeNull()
    expect(Array.isArray(cache)).toBe(false)
  })

  it('has no empty string values', () => {
    raw ??= fs.readFileSync(CACHE_PATH, 'utf-8')
    cache ??= JSON.parse(raw)
    const emptyKeys = Object.entries(cache)
      .filter(([, v]) => v === '')
      .map(([k]) => k)
    expect(emptyKeys).toEqual([])
  })

  it('all keys match t.co URL pattern', () => {
    raw ??= fs.readFileSync(CACHE_PATH, 'utf-8')
    cache ??= JSON.parse(raw)
    const pattern = /^https?:\/\/t\.co\/\w+$/
    const badKeys = Object.keys(cache).filter((k) => !pattern.test(k))
    expect(badKeys).toEqual([])
  })

  it('all non-null values start with http', () => {
    raw ??= fs.readFileSync(CACHE_PATH, 'utf-8')
    cache ??= JSON.parse(raw)
    const bad = Object.entries(cache)
      .filter(([, v]) => v !== null && typeof v === 'string' && !v.startsWith('http'))
      .map(([k]) => k)
    expect(bad).toEqual([])
  })

  it('values are only string or null', () => {
    raw ??= fs.readFileSync(CACHE_PATH, 'utf-8')
    cache ??= JSON.parse(raw)
    const bad = Object.entries(cache)
      .filter(([, v]) => v !== null && typeof v !== 'string')
      .map(([k, v]) => `${k}: ${typeof v}`)
    expect(bad).toEqual([])
  })

  it('has no duplicate keys in raw file', () => {
    raw ??= fs.readFileSync(CACHE_PATH, 'utf-8')
    // JSON.parse silently deduplicates; count keys in raw text vs parsed object
    const rawKeyCount = (raw.match(/"https?:\/\/t\.co\/\w+":/g) || []).length
    cache ??= JSON.parse(raw)
    const parsedKeyCount = Object.keys(cache).length
    expect(rawKeyCount).toBe(parsedKeyCount)
  })

  it('logs dead-link stats', () => {
    raw ??= fs.readFileSync(CACHE_PATH, 'utf-8')
    cache ??= JSON.parse(raw)
    const total = Object.keys(cache).length
    const deadCount = Object.values(cache).filter((v) => v === null).length
    const pct = total > 0 ? ((deadCount / total) * 100).toFixed(1) : '0.0'
    console.log(`URL cache stats: ${total} entries, ${deadCount} dead links (${pct}%)`)
    expect(total).toBeGreaterThan(0)
  })
})
