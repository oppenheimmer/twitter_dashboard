/**
 * Core word-cloud generation logic, shared between the CLI script
 * (`npm run generate-word-cloud`) and the server-side stale-regeneration path.
 *
 * All paths are resolved relative to `process.cwd()` (the dashboard/ directory).
 */

import fs from 'fs'
import path from 'path'
import { STOP_WORDS } from './word-cloud'
import {
  WORD_CLOUD_PATH,
  IGNORED_WORDS_MD_PATH,
  loadUserDismissedWords,
  type WordCloudData,
} from './word-cloud-data'

const ARCHIVE_ROOT = path.resolve(process.cwd(), '..', 'zip')
const CACHE_PATH = path.resolve(process.cwd(), '..', 'asset', 'url-cache.json')

type UrlCache = Record<string, string | null>

type RawLike = {
  like: {
    tweetId: string
    fullText?: string
    expandedUrl?: string
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenize(text: string, excludeWords: Set<string>): string[] {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/t\.co\/\S+/g, '')
    .replace(/\[Dead link\]/g, '')
    .toLowerCase()

  const rawWords = cleaned.match(/[a-z']+/g) ?? []
  return rawWords
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 3 && !excludeWords.has(w))
}

function extractWordFrequencies(
  texts: string[],
  excludeWords: Set<string>,
  maxWords = 500,
): { word: string; count: number }[] {
  const counts = new Map<string, number>()

  for (const text of texts) {
    for (const word of tokenize(text, excludeWords)) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxWords)
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

function collectAllTexts(cache: UrlCache): string[] {
  const seen = new Set<string>()
  const texts: string[] = []

  for (const archive of getArchiveNames()) {
    const filePath = path.join(ARCHIVE_ROOT, archive, 'data', 'like.js')
    const raw = fs.readFileSync(filePath, 'utf-8')

    const jsonStart = raw.indexOf('[')
    if (jsonStart === -1) continue

    let jsonStr = raw.slice(jsonStart).trimEnd()
    if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1)

    const parsed = JSON.parse(jsonStr) as RawLike[]

    for (const entry of parsed) {
      const { tweetId, fullText } = entry.like
      if (!tweetId || seen.has(tweetId)) continue
      seen.add(tweetId)

      if (fullText) {
        const decoded = decodeHtmlEntities(fullText)
        const expanded = expandUrls(decoded, cache)
        texts.push(expanded)
      }
    }
  }

  return texts
}

function generateIgnoredWordsMd(builtinWords: string[], userIgnored: string[]): string {
  const lines: string[] = [
    '# Ignored Words',
    '',
    'Words excluded from the word cloud. Built-in stop words are filtered during generation.',
    'User-dismissed words are persisted in IGNOREDWORDS.md and listed below.',
    '',
    '## Built-in Stop Words',
    '',
    builtinWords.sort().join(', '),
    '',
  ]

  if (userIgnored.length > 0) {
    lines.push('## User-Dismissed Words', '')
    lines.push(userIgnored.sort().join(', '), '')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RegenerateOptions {
  /** Print progress to stdout (default: false) */
  verbose?: boolean
}

/**
 * Regenerate word-cloud.json and IGNOREDWORDS.md from scratch.
 *
 * - Reads all archive texts, computes top-500 frequencies
 * - Excludes built-in stop words + user-dismissed words from IGNOREDWORDS.md
 * - Writes both files, returns the fresh WordCloudData
 */
export function regenerateWordCloud(opts: RegenerateOptions = {}): WordCloudData {
  const log = opts.verbose ? console.log.bind(console) : () => {}

  const cache = loadCache()

  const userDismissed = loadUserDismissedWords()
  if (userDismissed.length > 0) {
    log(`Loaded ${userDismissed.length} user-dismissed words from IGNOREDWORDS.md`)
  }

  const excludeWords = new Set([...STOP_WORDS, ...userDismissed])

  log('Collecting texts from all archives...')
  const allTexts = collectAllTexts(cache)
  log(`Collected ${allTexts.length.toLocaleString()} unique tweet texts`)

  log('Computing word frequencies...')
  const frequencies = extractWordFrequencies(allTexts, excludeWords, 500)
  log(`Top words: ${frequencies.slice(0, 10).map((f) => `${f.word}(${f.count})`).join(', ')}`)

  const data: WordCloudData = { frequencies, ignoredWords: [] }
  fs.writeFileSync(WORD_CLOUD_PATH, JSON.stringify(data, null, 2), 'utf-8')
  log(`Done → ${WORD_CLOUD_PATH} (${frequencies.length} words, ${userDismissed.length} user-dismissed)`)

  const builtinList = Array.from(STOP_WORDS)
  fs.writeFileSync(IGNORED_WORDS_MD_PATH, generateIgnoredWordsMd(builtinList, userDismissed), 'utf-8')
  log(`Done → ${IGNORED_WORDS_MD_PATH}`)

  return data
}
