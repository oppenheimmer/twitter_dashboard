import { Like, ReadState } from '@/types/like'

const NEXT_STATE: Record<ReadState, ReadState> = {
  'unread': 'read',
  'read': 'in-progress',
  'in-progress': 'ignore',
  'ignore': 'unread',
}

const DOT_COLORS: Record<ReadState, string> = {
  'read': 'bg-green-500',
  'unread': 'bg-zinc-300 dark:bg-zinc-600',
  'in-progress': 'bg-blue-300 dark:bg-blue-400',
  'ignore': 'bg-black dark:bg-zinc-100',
}

const LABEL_COLORS: Record<ReadState, string> = {
  'read': 'text-green-600 dark:text-green-400',
  'unread': 'text-zinc-400 dark:text-zinc-500',
  'in-progress': 'text-blue-500 dark:text-blue-400',
  'ignore': 'text-black dark:text-zinc-100',
}

const LABELS: Record<ReadState, string> = {
  'read': 'Read',
  'unread': 'Unread',
  'in-progress': 'In Progress',
  'ignore': 'Ignore',
}

type LikeCardProps = {
  like: Like
  readStateOverride?: ReadState
  onCycleState?: (tweetId: string, newState: ReadState) => void
  bookmarkOverride?: boolean
  onToggleBookmark?: (tweetId: string, bookmarked: boolean) => void
}

export default function LikeCard({ like, readStateOverride, onCycleState, bookmarkOverride, onToggleBookmark }: LikeCardProps) {
  const effectiveState = readStateOverride ?? like.readState
  const hasPendingChange = readStateOverride !== undefined && readStateOverride !== like.readState
  const effectiveBookmark = bookmarkOverride ?? like.bookmarked
  const hasPendingBookmark = bookmarkOverride !== undefined && bookmarkOverride !== like.bookmarked

  return (
    <article className="flex rounded-lg border border-zinc-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      {/* Left: date + read indicator */}
      <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 border-r border-zinc-200 p-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => onCycleState?.(like.tweetId, NEXT_STATE[effectiveState])}
          className={`flex flex-col items-center gap-1 rounded-md px-1 py-1 transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
            hasPendingChange ? 'ring-2 ring-blue-400' : ''
          }`}
          title={`${LABELS[effectiveState]} — click to cycle`}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full transition-colors duration-200 ${DOT_COLORS[effectiveState]}`}
          />
          <span
            className={`text-[10px] font-medium ${LABEL_COLORS[effectiveState]}`}
          >
            {LABELS[effectiveState]}
          </span>
        </button>
        <span className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
          {like.date}
        </span>
        <button
          type="button"
          onClick={() => onToggleBookmark?.(like.tweetId, !effectiveBookmark)}
          className={`mt-1 flex items-center justify-center rounded-md p-1 transition-colors cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
            hasPendingBookmark ? 'ring-2 ring-blue-400' : ''
          }`}
          title={effectiveBookmark ? 'Bookmarked — click to remove' : 'Click to bookmark'}
        >
          <svg
            className={`h-4 w-4 transition-colors duration-200 ${
              effectiveBookmark
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-zinc-300 dark:text-zinc-600'
            }`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            fill={effectiveBookmark ? 'currentColor' : 'none'}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>

      {/* Right: tweet content */}
      <div className="flex flex-col gap-2 p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {like.fullText}
        </p>
        <a
          href={like.expandedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link inline-block text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View tweet <span className="inline-block transition-transform duration-200 group-hover/link:translate-x-0.5">&rarr;</span>
        </a>
      </div>
    </article>
  )
}
