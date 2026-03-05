import { NextResponse } from 'next/server'
import fs from 'fs'
import { CONSOLIDATED_PATH, applyBookmarkChanges } from '@/lib/read-state'

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
    !('changes' in body) ||
    typeof (body as { changes: unknown }).changes !== 'object' ||
    (body as { changes: unknown }).changes === null
  ) {
    return NextResponse.json(
      { error: 'Body must be { changes: Record<string, boolean> }' },
      { status: 400 },
    )
  }

  const changes = (body as { changes: Record<string, boolean> }).changes

  for (const [key, val] of Object.entries(changes)) {
    if (!/^\d+$/.test(key)) {
      return NextResponse.json(
        { error: `Invalid tweetId: ${key}` },
        { status: 400 },
      )
    }
    if (typeof val !== 'boolean') {
      return NextResponse.json(
        { error: `Value for ${key} must be a boolean` },
        { status: 400 },
      )
    }
  }

  let content: string
  try {
    content = fs.readFileSync(CONSOLIDATED_PATH, 'utf-8')
  } catch {
    return NextResponse.json(
      { error: 'CONSOLIDATED.md not found' },
      { status: 404 },
    )
  }

  const result = applyBookmarkChanges(content, changes)
  fs.writeFileSync(CONSOLIDATED_PATH, result.content, 'utf-8')

  return NextResponse.json({ ok: true, updated: result.updated })
}
