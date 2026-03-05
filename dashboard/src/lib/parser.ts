import fs from 'fs'
import path from 'path'
import { Like } from '@/types/like'
import { loadUrlCache, expandUrls, UrlCache } from '@/lib/url-expander'
import { getArchiveNames } from '@/lib/archives'
import { snowflakeToDate, loadReadState, loadBookmarkState } from '@/lib/read-state'

const ARCHIVE_ROOT = process.env.ARCHIVE_ROOT!

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

type RawLike = {
  like: {
    tweetId: string
    fullText?: string
    expandedUrl?: string
  }
}

function readAndParseLikeJsIntoMap(
  archiveName: string,
  cache: UrlCache,
  map: Map<string, Like>
): void {
  const filePath = path.join(ARCHIVE_ROOT, archiveName, 'data', 'like.js')
  const raw = fs.readFileSync(filePath, 'utf-8')

  const jsonStart = raw.indexOf('[')
  if (jsonStart === -1) throw new Error(`Malformed like.js in ${archiveName}: no array found`)

  let jsonStr = raw.slice(jsonStart).trimEnd()
  if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1)

  const parsed = JSON.parse(jsonStr) as RawLike[]

  for (const entry of parsed) {
    const { tweetId, fullText, expandedUrl } = entry.like
    if (!tweetId) continue
    if (!map.has(tweetId)) {
      const text = fullText ?? ''
      const decoded = decodeHtmlEntities(text)
      const expanded = expandUrls(decoded, cache)
      const url = expandedUrl ?? `https://twitter.com/i/web/status/${tweetId}`
      map.set(tweetId, { tweetId, fullText: expanded, expandedUrl: url, date: snowflakeToDate(tweetId), readState: 'unread', bookmarked: false })
    }
  }
}

export function parseLikeJs(archiveName: string): Like[] {
  // Path-traversal guard
  const safeName = path.basename(archiveName)
  if (!getArchiveNames().includes(safeName)) {
    throw new Error(`Unknown archive: ${archiveName}`)
  }

  const cache = loadUrlCache()
  const map = new Map<string, Like>()
  readAndParseLikeJsIntoMap(safeName, cache, map)
  return applyReadState(map)
}

export function parseAllArchives(): Like[] {
  const cache = loadUrlCache()
  const map = new Map<string, Like>()
  for (const archiveName of getArchiveNames()) {
    readAndParseLikeJsIntoMap(archiveName, cache, map)
  }
  return applyReadState(map)
}

function applyReadState(map: Map<string, Like>): Like[] {
  const readState = loadReadState()
  const bookmarkState = loadBookmarkState()
  for (const [tweetId, like] of map) {
    const state = readState.get(tweetId)
    if (state !== undefined) {
      like.readState = state
    }
    const bookmarked = bookmarkState.get(tweetId)
    if (bookmarked !== undefined) {
      like.bookmarked = bookmarked
    }
  }
  return Array.from(map.values())
}
