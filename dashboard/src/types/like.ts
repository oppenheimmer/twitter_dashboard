export type ReadState = 'read' | 'unread' | 'in-progress' | 'ignore'

export interface Like {
  tweetId: string
  fullText: string
  expandedUrl: string
  date: string
  readState: ReadState
  bookmarked: boolean
}
