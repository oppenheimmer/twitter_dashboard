import fs from 'fs'
import path from 'path'

export type UrlCache = Record<string, string | null>

const CACHE_PATH = path.resolve(process.cwd(), '..', 'asset', 'url-cache.json')

export function loadUrlCache(): UrlCache {
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf-8')
    return JSON.parse(raw) as UrlCache
  } catch {
    return {}
  }
}

export function expandUrls(text: string, cache: UrlCache): string {
  return text.replace(/https?:\/\/t\.co\/\w+/g, (tcoUrl) => {
    if (cache[tcoUrl] === null) return '[Dead link]'
    return cache[tcoUrl] ?? tcoUrl
  })
}
