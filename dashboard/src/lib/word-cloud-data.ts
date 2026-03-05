import fs from 'fs'
import path from 'path'
import type { WordFrequency } from './word-cloud'

export interface WordCloudData {
  frequencies: WordFrequency[]
  ignoredWords: string[]
  stale?: boolean
}

export const WORD_CLOUD_PATH = path.resolve(process.cwd(), '..', 'asset', 'word-cloud.json')
export const IGNORED_WORDS_MD_PATH = path.resolve(process.cwd(), '..', 'asset', 'IGNOREDWORDS.md')

export function loadWordCloudData(): WordCloudData {
  try {
    const data: WordCloudData = JSON.parse(fs.readFileSync(WORD_CLOUD_PATH, 'utf-8'))

    if (data.stale) {
      // A word was dismissed since the last full generation — regenerate now
      // to backfill frequency slots and clear the stale flag.
      const { regenerateWordCloud } = require('./word-cloud-generator') as typeof import('./word-cloud-generator')
      return regenerateWordCloud()
    }

    return data
  } catch {
    return { frequencies: [], ignoredWords: [] }
  }
}

export function saveWordCloudData(data: WordCloudData): void {
  fs.writeFileSync(WORD_CLOUD_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Parse the "User-Dismissed Words" section from IGNOREDWORDS.md.
 * Returns an array of words, or empty if the section doesn't exist.
 */
export function parseUserDismissedWords(mdContent: string): string[] {
  const marker = '## User-Dismissed Words'
  const idx = mdContent.indexOf(marker)
  if (idx === -1) return []

  const after = mdContent.slice(idx + marker.length)
  // The next section (if any) starts with "## "
  const nextSection = after.indexOf('\n## ')
  const block = nextSection === -1 ? after : after.slice(0, nextSection)
  const trimmed = block.trim()
  if (!trimmed) return []

  return trimmed.split(',').map((w) => w.trim()).filter(Boolean)
}

/**
 * Read existing user-dismissed words from IGNOREDWORDS.md.
 */
export function loadUserDismissedWords(): string[] {
  try {
    const content = fs.readFileSync(IGNORED_WORDS_MD_PATH, 'utf-8')
    return parseUserDismissedWords(content)
  } catch {
    return []
  }
}

/**
 * Add a word to the "User-Dismissed Words" section of IGNOREDWORDS.md.
 * Creates the section if it doesn't exist. Preserves existing content.
 */
export function addUserDismissedWord(word: string): void {
  let content: string
  try {
    content = fs.readFileSync(IGNORED_WORDS_MD_PATH, 'utf-8')
  } catch {
    // File doesn't exist yet — create minimal structure
    content = '# Ignored Words\n\n'
  }

  const existing = parseUserDismissedWords(content)
  if (existing.includes(word)) return

  existing.push(word)
  existing.sort()

  const marker = '## User-Dismissed Words'
  const idx = content.indexOf(marker)

  if (idx === -1) {
    // Append new section
    const suffix = content.endsWith('\n') ? '' : '\n'
    content = content + suffix + '\n' + marker + '\n\n' + existing.join(', ') + '\n'
  } else {
    // Replace existing section content
    const beforeSection = content.slice(0, idx)
    const after = content.slice(idx + marker.length)
    const nextSection = after.indexOf('\n## ')
    const rest = nextSection === -1 ? '' : after.slice(nextSection)
    content = beforeSection + marker + '\n\n' + existing.join(', ') + '\n' + rest
  }

  fs.writeFileSync(IGNORED_WORDS_MD_PATH, content, 'utf-8')
}
