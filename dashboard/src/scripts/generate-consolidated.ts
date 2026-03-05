/**
 * Generates or updates CONSOLIDATED.md in the asset/ directory.
 *
 * Behavior:
 *   - If CONSOLIDATED.md does not exist → generate it from all archives (first run)
 *   - If CONSOLIDATED.md already exists → only append new unique entries
 *   - Existing entries (including manual Read: Yes edits) are preserved verbatim
 *   - New entries are appended at the end, all entries renumbered 1..N
 *
 * Each entry includes:
 *   - Date   — decoded from the Twitter Snowflake tweet ID
 *   - Tweet  — full tweet body with HTML entities decoded and t.co links expanded
 *   - URL    — the destination URL linked from the tweet
 *   - Read   — defaults to "No"; edit manually to "Yes" to track what you've read
 *
 * Run: npm run generate-consolidated
 */

import fs from 'fs'
import path from 'path'

const ARCHIVE_ROOT = path.resolve(__dirname, '..', '..', '..', 'zip')
const CACHE_PATH = path.resolve(__dirname, '..', '..', '..', 'asset', 'url-cache.json')
const OUTPUT_PATH = path.resolve(__dirname, '..', '..', '..', 'asset', 'CONSOLIDATED.md')

type UrlCache = Record<string, string | null>

type Like = {
  tweetId: string
  date: string
  fullText: string
  url: string
}

type RawLike = {
  like: {
    tweetId: string
    fullText?: string
    expandedUrl?: string
  }
}

function loadCache(): UrlCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as UrlCache
  } catch {
    return {}
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** Decode a Twitter Snowflake ID to a YYYY-MM-DD date string. */
function snowflakeToDate(tweetId: string): string {
  const TWITTER_EPOCH = BigInt(1288834974657)
  try {
    const ms = (BigInt(tweetId) >> BigInt(22)) + TWITTER_EPOCH
    return new Date(Number(ms)).toISOString().split('T')[0]
  } catch {
    return 'unknown'
  }
}

function expandUrls(text: string, cache: UrlCache): string {
  return text.replace(/https?:\/\/t\.co\/\w+/g, (tcoUrl) => {
    if (cache[tcoUrl] === null) return '[Dead link]'
    return cache[tcoUrl] ?? tcoUrl
  })
}

function getArchiveNames(): string[] {
  return fs
    .readdirSync(ARCHIVE_ROOT)
    .filter((n) => /^twitter-\d{4}-\d{2}/.test(n))
    .filter((n) => fs.existsSync(path.join(ARCHIVE_ROOT, n, 'data', 'like.js')))
    .sort()
}

function collectAllLikes(cache: UrlCache): Like[] {
  const map = new Map<string, Like>()

  for (const archive of getArchiveNames()) {
    const filePath = path.join(ARCHIVE_ROOT, archive, 'data', 'like.js')
    const raw = fs.readFileSync(filePath, 'utf-8')

    const jsonStart = raw.indexOf('[')
    if (jsonStart === -1) continue

    let jsonStr = raw.slice(jsonStart).trimEnd()
    if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1)

    const parsed = JSON.parse(jsonStr) as RawLike[]

    for (const entry of parsed) {
      const { tweetId, fullText, expandedUrl } = entry.like
      if (!tweetId || map.has(tweetId)) continue

      const decoded = decodeHtmlEntities(fullText ?? '')
      const body = expandUrls(decoded, cache)
      const url = expandedUrl ?? `https://twitter.com/i/web/status/${tweetId}`

      map.set(tweetId, {
        tweetId,
        date: snowflakeToDate(tweetId),
        fullText: body,
        url,
      })
    }
  }

  // Newest first
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
}

/** Extract all tweetIds from an existing CONSOLIDATED.md file. */
function parseExistingTweetIds(content: string): Set<string> {
  const ids = new Set<string>()
  const regex = /^## \d+\. \[Tweet (\d+)\]/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    ids.add(match[1])
  }
  return ids
}

/** Format a single entry block with the given sequence number. */
function formatEntry(like: Like, num: number): string {
  const tweetUrl = `https://twitter.com/i/web/status/${like.tweetId}`
  const body = like.fullText.replace(/\n+/g, ' ').trim()

  return [
    `## ${num}. [Tweet ${like.tweetId}](${tweetUrl})`,
    '',
    `- **Date**: ${like.date}`,
    `- **Read**: Unread`,
    `- **Bookmark**: No`,
    `- **URL**: ${like.url}`,
    `- **Tweet**: ${body}`,
    '',
    '---',
    '',
  ].join('\n')
}

/** Renumber all entry headings (## N. [Tweet ...]) sequentially from 1. */
function renumber(content: string): string {
  let counter = 0
  return content.replace(/^## \d+\. \[Tweet /gm, () => {
    counter++
    return `## ${counter}. [Tweet `
  })
}

/** Update the header's Total count and Generated timestamp. */
function updateHeader(content: string, total: number): string {
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  let updated = content.replace(
    /^\*\*Generated:\*\* .+$/m,
    `**Generated:** ${generated}  `
  )
  updated = updated.replace(
    /^\*\*Total:\*\* .+$/m,
    `**Total:** ${total.toLocaleString()} unique liked tweets`
  )
  return updated
}

function buildFreshMarkdown(likes: Like[]): string {
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  const lines: string[] = [
    '# Consolidated Liked Tweets',
    '',
    `**Generated:** ${generated}  `,
    `**Total:** ${likes.length.toLocaleString()} unique liked tweets`,
    '',
    '> Edit the **Read** field for any entry from `No` to `Yes` to track what you have read.',
    '',
    '---',
    '',
  ]

  likes.forEach((like, i) => {
    const tweetUrl = `https://twitter.com/i/web/status/${like.tweetId}`
    const body = like.fullText.replace(/\n+/g, ' ').trim()

    lines.push(`## ${i + 1}. [Tweet ${like.tweetId}](${tweetUrl})`)
    lines.push('')
    lines.push(`- **Date**: ${like.date}`)
    lines.push(`- **Read**: No`)
    lines.push(`- **Bookmark**: No`)
    lines.push(`- **URL**: ${like.url}`)
    lines.push(`- **Tweet**: ${body}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

// --- Main ---

const cache = loadCache()
console.log('Collecting likes from all archives...')
const allLikes = collectAllLikes(cache)
console.log(`Total unique likes across archives: ${allLikes.length.toLocaleString()}`)

if (!fs.existsSync(OUTPUT_PATH)) {
  // First run: generate from scratch
  console.log('No existing CONSOLIDATED.md found. Generating from scratch...')
  fs.writeFileSync(OUTPUT_PATH, buildFreshMarkdown(allLikes), 'utf-8')
  console.log(`Done → ${OUTPUT_PATH} (${allLikes.length.toLocaleString()} entries)`)
} else {
  // Append-only: preserve existing entries, add only new ones
  const existing = fs.readFileSync(OUTPUT_PATH, 'utf-8')
  const existingIds = parseExistingTweetIds(existing)
  console.log(`Existing CONSOLIDATED.md has ${existingIds.size.toLocaleString()} entries.`)

  const newLikes = allLikes.filter((l) => !existingIds.has(l.tweetId))

  if (newLikes.length === 0) {
    console.log('No new entries to add. File unchanged.')
  } else {
    console.log(`Appending ${newLikes.length.toLocaleString()} new entries...`)

    // Sort new entries newest-first (among themselves)
    newLikes.sort((a, b) => b.date.localeCompare(a.date))

    // Build new entry blocks numbered after existing entries
    const startNum = existingIds.size + 1
    const newBlocks = newLikes.map((like, i) => formatEntry(like, startNum + i)).join('')

    // Append new entries at the end of existing content
    let updated = existing.trimEnd() + '\n\n' + newBlocks

    // Update header with new total and timestamp
    const newTotal = existingIds.size + newLikes.length
    updated = updateHeader(updated, newTotal)

    // Renumber all entries 1..N
    updated = renumber(updated)

    fs.writeFileSync(OUTPUT_PATH, updated, 'utf-8')
    console.log(`Done → ${OUTPUT_PATH} (${newTotal.toLocaleString()} total entries, ${newLikes.length} new)`)
  }
}
