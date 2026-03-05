import { NextResponse } from 'next/server'
import { parseAllArchives } from '@/lib/parser'
import { buildMarkdown } from '@/lib/markdown'

export async function GET() {
  const likes = parseAllArchives()
  const markdown = buildMarkdown(likes, 'all-archives')

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="all-archives-likes.md"',
    },
  })
}
