import { Like } from '@/types/like'

export function buildMarkdown(likes: Like[], archiveName: string): string {
  const lines: string[] = [
    `# Twitter Likes — ${archiveName}`,
    '',
    `**Total:** ${likes.length} liked tweets`,
    '',
    '---',
    '',
  ]

  likes.forEach((like, i) => {
    const tweetUrl = `https://twitter.com/i/web/status/${like.tweetId}`
    lines.push(`## ${i + 1}. [Tweet ${like.tweetId}](${tweetUrl})`)
    lines.push('')
    lines.push(like.fullText)
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}
