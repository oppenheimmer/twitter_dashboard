import fs from 'fs'
import path from 'path'
import type { ReadState } from '@/types/like'

export const CONSOLIDATED_PATH = path.resolve(process.cwd(), '..', 'asset', 'CONSOLIDATED.md')

const TWITTER_EPOCH = BigInt(1288834974657)

/** Decode a Twitter Snowflake ID to a YYYY-MM-DD date string. */
export function snowflakeToDate(tweetId: string): string {
  try {
    const ms = (BigInt(tweetId) >> BigInt(22)) + TWITTER_EPOCH
    return new Date(Number(ms)).toISOString().split('T')[0]
  } catch {
    return 'unknown'
  }
}

const VALUE_TO_STATE: Record<string, ReadState> = {
  'Yes': 'read',
  'No': 'unread',
  'Read': 'read',
  'Unread': 'unread',
  'In-Progress': 'in-progress',
  'Ignore': 'ignore',
}

const STATE_TO_VALUE: Record<ReadState, string> = {
  'read': 'Read',
  'unread': 'Unread',
  'in-progress': 'In-Progress',
  'ignore': 'Ignore',
}

/**
 * Parse asset/CONSOLIDATED.md and return a Map<tweetId, ReadState>.
 * Returns an empty Map if the file is missing or cannot be parsed.
 */
export function loadReadState(): Map<string, ReadState> {
  const filePath = CONSOLIDATED_PATH
  const map = new Map<string, ReadState>()

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return map
  }

  const headingRe = /^## \d+\. \[Tweet (\d+)\]/gm
  let match: RegExpExecArray | null
  while ((match = headingRe.exec(content)) !== null) {
    const tweetId = match[1]
    const afterHeading = content.slice(match.index + match[0].length, match.index + match[0].length + 500)
    const readMatch = afterHeading.match(/- \*\*Read\*\*:\s*(Yes|No|Read|Unread|In-Progress|Ignore)/)
    if (readMatch) {
      map.set(tweetId, VALUE_TO_STATE[readMatch[1]] ?? 'unread')
    }
  }

  return map
}

/**
 * Parse asset/CONSOLIDATED.md and return a Map<tweetId, boolean> for bookmark state.
 * Returns an empty Map if the file is missing or cannot be parsed.
 */
export function loadBookmarkState(): Map<string, boolean> {
  const filePath = CONSOLIDATED_PATH
  const map = new Map<string, boolean>()

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return map
  }

  const headingRe = /^## \d+\. \[Tweet (\d+)\]/gm
  let match: RegExpExecArray | null
  while ((match = headingRe.exec(content)) !== null) {
    const tweetId = match[1]
    const afterHeading = content.slice(match.index + match[0].length, match.index + match[0].length + 500)
    const bookmarkMatch = afterHeading.match(/- \*\*Bookmark\*\*:\s*(Yes|No)/)
    if (bookmarkMatch) {
      map.set(tweetId, bookmarkMatch[1] === 'Yes')
    }
  }

  return map
}

/**
 * Apply read-state changes to CONSOLIDATED.md content.
 * Pure function: takes the file content and a map of tweetId → newReadState,
 * returns the updated content string.
 */
export function applyChanges(content: string, changes: Record<string, ReadState>): { content: string; updated: number } {
  let currentTweetId: string | null = null
  let updated = 0
  const headingRe = /^## \d+\. \[Tweet (\d+)\]/
  const readLineRe = /^(- \*\*Read\*\*:\s*)(Yes|No|Read|Unread|In-Progress|Ignore)(.*)$/

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(headingRe)
    if (headingMatch) {
      currentTweetId = headingMatch[1]
      continue
    }
    if (currentTweetId && currentTweetId in changes) {
      const readMatch = lines[i].match(readLineRe)
      if (readMatch) {
        const newValue = STATE_TO_VALUE[changes[currentTweetId]]
        if (readMatch[2] !== newValue) {
          lines[i] = `${readMatch[1]}${newValue}${readMatch[3]}`
          updated++
        }
        currentTweetId = null
      }
    }
  }

  return { content: lines.join('\n'), updated }
}

/**
 * Apply bookmark changes to CONSOLIDATED.md content.
 * Pure function: takes the file content and a map of tweetId → boolean,
 * returns the updated content string.
 */
export function applyBookmarkChanges(content: string, changes: Record<string, boolean>): { content: string; updated: number } {
  let currentTweetId: string | null = null
  let updated = 0
  const headingRe = /^## \d+\. \[Tweet (\d+)\]/
  const bookmarkLineRe = /^(- \*\*Bookmark\*\*:\s*)(Yes|No)(.*)$/

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(headingRe)
    if (headingMatch) {
      currentTweetId = headingMatch[1]
      continue
    }
    if (currentTweetId && currentTweetId in changes) {
      const bookmarkMatch = lines[i].match(bookmarkLineRe)
      if (bookmarkMatch) {
        const newValue = changes[currentTweetId] ? 'Yes' : 'No'
        if (bookmarkMatch[2] !== newValue) {
          lines[i] = `${bookmarkMatch[1]}${newValue}${bookmarkMatch[3]}`
          updated++
        }
        currentTweetId = null
      }
    }
  }

  return { content: lines.join('\n'), updated }
}
