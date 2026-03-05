import { NextResponse } from 'next/server'
import { notFound } from 'next/navigation'
import { getArchiveNames } from '@/lib/archives'
import { parseLikeJs } from '@/lib/parser'
import { buildMarkdown } from '@/lib/markdown'

type RouteContext = {
  params: Promise<{ archive: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { archive } = await params

  if (!getArchiveNames().includes(archive)) {
    notFound()
  }

  const likes = parseLikeJs(archive)
  const markdown = buildMarkdown(likes, archive)

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${archive}-likes.md"`,
    },
  })
}
