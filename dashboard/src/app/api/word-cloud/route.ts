import { NextResponse } from 'next/server'
import { loadWordCloudData, saveWordCloudData, addUserDismissedWord } from '@/lib/word-cloud-data'

export async function GET() {
  return NextResponse.json(loadWordCloudData())
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('word' in body) ||
    typeof (body as { word: unknown }).word !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Body must be { word: string }' },
      { status: 400 },
    )
  }

  const word = (body as { word: string }).word.trim().toLowerCase()
  if (!word) {
    return NextResponse.json({ error: 'Word must not be empty' }, { status: 400 })
  }

  const data = loadWordCloudData()

  // Remove the word from frequencies (immediate cleanup for current session)
  data.frequencies = data.frequencies.filter((f) => f.word !== word)

  // Clear ignoredWords in JSON — dismissed words live in IGNOREDWORDS.md
  data.ignoredWords = []

  // Mark stale so next page load triggers a full regeneration (backfills 500 slots)
  data.stale = true

  saveWordCloudData(data)

  // Persist dismissal to IGNOREDWORDS.md
  addUserDismissedWord(word)

  return NextResponse.json({ ok: true, ignoredWords: [] })
}
