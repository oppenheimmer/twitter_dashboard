/**
 * One-time offline script to expand all t.co URLs found in like.js files.
 * Run: npm run expand-urls
 *
 * Reads url-cache.json (if present) and only processes uncached URLs.
 * Saves progress every 100 URLs so it's resumable.
 *
 * Includes retry logic with exponential backoff to handle rate limiting,
 * and a dead-link recheck pass to recover URLs incorrectly marked dead.
 */

import fs from 'fs'
import path from 'path'

const ARCHIVE_ROOT = path.resolve(__dirname, '..', '..', '..', 'zip')
const CACHE_PATH = path.resolve(__dirname, '..', '..', '..', 'asset', 'url-cache.json')
const CONCURRENCY = 5
const RECHECK_CONCURRENCY = 3
const SAVE_INTERVAL = 100
const REQUEST_DELAY_MS = 200
const MAX_RETRIES = 3

const ARCHIVE_NAMES = fs.readdirSync(ARCHIVE_ROOT)
  .filter(n => /^twitter-\d{4}-\d{2}/.test(n))
  .sort()

type UrlCache = Record<string, string | null>

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadCache(): UrlCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as UrlCache
  } catch {
    return {}
  }
}

function saveCache(cache: UrlCache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

function extractTcoUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/t\.co\/\w+/g)
  return matches ?? []
}

async function expandUrl(url: string): Promise<string | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok || res.redirected) {
        return res.url
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after')
        const waitMs = retryAfter
          ? (parseInt(retryAfter, 10) || 1) * 1000
          : Math.pow(2, attempt) * 1000
        console.log(`  Rate limited on ${url}, waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`)
        await sleep(waitMs)
        continue
      }

      // Other HTTP errors — retry with backoff
      if (attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * 1000)
        continue
      }
      return null
    } catch {
      if (attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * 1000)
        continue
      }
      return null
    }
  }
  return null
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onComplete: (result: T, index: number) => void
) {
  let index = 0
  let running = 0
  let done = 0

  return new Promise<void>((resolve, reject) => {
    function next() {
      while (running < limit && index < tasks.length) {
        const i = index++
        running++
        tasks[i]()
          .then((result) => {
            onComplete(result, i)
            done++
            running--
            if (done === tasks.length) resolve()
            else next()
          })
          .catch(reject)
      }
    }
    next()
  })
}

async function main() {
  const cache = loadCache()

  // Collect all unique t.co URLs across all archives
  const allUrls = new Set<string>()
  for (const archive of ARCHIVE_NAMES) {
    const likeJsPath = path.join(ARCHIVE_ROOT, archive, 'data', 'like.js')
    if (!fs.existsSync(likeJsPath)) {
      console.warn(`Skipping missing: ${likeJsPath}`)
      continue
    }
    const raw = fs.readFileSync(likeJsPath, 'utf-8')
    for (const url of extractTcoUrls(raw)) {
      allUrls.add(url)
    }
  }

  const uncached = Array.from(allUrls).filter((url) => !(url in cache))
  console.log(`Total unique t.co URLs: ${allUrls.size}`)
  console.log(`Already cached: ${allUrls.size - uncached.length}`)
  console.log(`To expand: ${uncached.length}`)

  if (uncached.length > 0) {
    let processed = 0

    const tasks = uncached.map((url) => async () => {
      await sleep(REQUEST_DELAY_MS)
      const expanded = await expandUrl(url)
      cache[url] = expanded
      processed++
      const label = expanded ?? '[Dead link]'
      console.log(`[${processed}/${uncached.length}] ${url} → ${label}`)
      if (processed % SAVE_INTERVAL === 0) {
        saveCache(cache)
        console.log(`  (saved cache at ${processed} entries)`)
      }
      return { url, expanded }
    })

    await runWithConcurrency(tasks, CONCURRENCY, () => {})
    saveCache(cache)
    console.log(`\nExpansion pass complete.`)
  } else {
    console.log('No new URLs to expand.')
  }

  // Dead-link recheck pass
  const deadLinks = Object.entries(cache).filter(([, v]) => v === null).map(([url]) => url)
  if (deadLinks.length > 0) {
    console.log(`\nRechecking ${deadLinks.length} dead links...`)
    let rechecked = 0
    let recovered = 0

    const recheckTasks = deadLinks.map((url) => async () => {
      await sleep(REQUEST_DELAY_MS)
      const expanded = await expandUrl(url)
      rechecked++
      if (expanded !== null) {
        cache[url] = expanded
        recovered++
        console.log(`  [Recovered] ${url} → ${expanded}`)
      }
      if (rechecked % SAVE_INTERVAL === 0) {
        saveCache(cache)
      }
      return { url, expanded }
    })

    await runWithConcurrency(recheckTasks, RECHECK_CONCURRENCY, () => {})
    saveCache(cache)
    console.log(`Recheck complete: ${recovered}/${deadLinks.length} dead links recovered.`)
  } else {
    console.log('\nNo dead links to recheck.')
  }

  console.log(`\nDone. Cache written to ${CACHE_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
