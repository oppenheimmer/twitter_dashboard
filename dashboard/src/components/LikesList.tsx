'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Like, ReadState } from '@/types/like'
import LikeCard from '@/components/LikeCard'
import ExportButton from '@/components/ExportButton'
import { getYearsFromLikes, getYearPageMap, getYearDividers } from '@/lib/year-groups'

const PAGE_SIZE = 50

type SortOrder = 'newest' | 'oldest'

export default function LikesList({
  likes,
  archive,
}: {
  likes: Like[]
  archive: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [sortOrder, setSortOrder] = useState<SortOrder>('oldest')
  const [overrides, setOverrides] = useState<Map<string, ReadState>>(new Map())
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Map<string, boolean>>(new Map())
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    let result = likes
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((l) => l.fullText.toLowerCase().includes(q))
    }
    return result.toSorted((a, b) => {
      const cmp = BigInt(a.tweetId) < BigInt(b.tweetId) ? -1 : BigInt(a.tweetId) > BigInt(b.tweetId) ? 1 : 0
      return sortOrder === 'newest' ? -cmp : cmp
    })
  }, [likes, query, sortOrder])

  useEffect(() => {
    setPage(1)
  }, [query, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const years = useMemo(() => getYearsFromLikes(filtered), [filtered])
  const yearPageMap = useMemo(() => getYearPageMap(filtered, PAGE_SIZE), [filtered])
  const dividers = useMemo(() => getYearDividers(visible), [visible])
  const dividerMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const d of dividers) map.set(d.beforeIndex, d.year)
    return map
  }, [dividers])

  const activeYear = visible.length > 0 ? visible[0].date.slice(0, 4) || 'unknown' : null

  const [scrollToYear, setScrollToYear] = useState<string | null>(null)

  useEffect(() => {
    if (scrollToYear) {
      requestAnimationFrame(() => {
        document.getElementById(`year-${scrollToYear}`)?.scrollIntoView({ behavior: 'smooth' })
        setScrollToYear(null)
      })
    }
  }, [scrollToYear, visible])

  function handleYearClick(year: string) {
    const targetPage = yearPageMap.get(year)
    if (targetPage !== undefined) {
      setPage(targetPage)
      setScrollToYear(year)
    }
  }

  const handleCycleState = useCallback((tweetId: string, newState: ReadState) => {
    setOverrides((prev) => {
      const next = new Map(prev)
      const original = likes.find((l) => l.tweetId === tweetId)?.readState ?? 'unread'
      if (newState === original) {
        next.delete(tweetId)
      } else {
        next.set(tweetId, newState)
      }
      return next
    })
  }, [likes])

  const handleToggleBookmark = useCallback((tweetId: string, bookmarked: boolean) => {
    setBookmarkOverrides((prev) => {
      const next = new Map(prev)
      const original = likes.find((l) => l.tweetId === tweetId)?.bookmarked ?? false
      if (bookmarked === original) {
        next.delete(tweetId)
      } else {
        next.set(tweetId, bookmarked)
      }
      return next
    })
  }, [likes])

  const totalPending = overrides.size + bookmarkOverrides.size

  const handleSave = useCallback(async () => {
    if (totalPending === 0) return
    setSaving(true)
    try {
      const promises: Promise<Response>[] = []

      if (overrides.size > 0) {
        const changes: Record<string, ReadState> = {}
        for (const [id, val] of overrides) {
          changes[id] = val
        }
        promises.push(fetch('/api/read-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes }),
        }))
      }

      if (bookmarkOverrides.size > 0) {
        const changes: Record<string, boolean> = {}
        for (const [id, val] of bookmarkOverrides) {
          changes[id] = val
        }
        promises.push(fetch('/api/bookmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes }),
        }))
      }

      const results = await Promise.all(promises)
      if (results.every((r) => r.ok)) {
        setOverrides(new Map())
        setBookmarkOverrides(new Map())
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }, [overrides, bookmarkOverrides, totalPending, router])

  return (
    <div className="flex flex-col gap-6">
      {/* Controls row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tweet text…"
            className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-4">
          {totalPending > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : `Save changes (${totalPending})`}
            </button>
          )}
          <button
            onClick={() => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {sortOrder === 'newest' ? '↓ From Newest' : '↑ From Oldest'}
          </button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {filtered.length.toLocaleString()} unique tweet
            {filtered.length !== 1 ? 's' : ''}
          </span>
          <ExportButton archive={archive} />
        </div>
      </div>

      {/* Year side panel */}
      {years.length > 1 && (
        <nav className="fixed left-8 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => handleYearClick(year)}
              className="rounded px-2 py-1 text-left text-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
              style={year === activeYear ? { color: '#990000', fontWeight: 'bold' } : undefined}
            >
              {year}
            </button>
          ))}
        </nav>
      )}

      {/* Tweet cards */}
      <div className="flex flex-col gap-3">
        {visible.map((like, i) => (
          <div key={like.tweetId}>
            {dividerMap.has(i) && (
              <h2
                id={`year-${dividerMap.get(i)}`}
                className="text-2xl font-bold scroll-mt-20 mb-3"
                style={{ color: '#990000' }}
              >
                {dividerMap.get(i)}
              </h2>
            )}
            <LikeCard
              like={like}
              readStateOverride={overrides.has(like.tweetId) ? overrides.get(like.tweetId) : undefined}
              onCycleState={handleCycleState}
              bookmarkOverride={bookmarkOverrides.has(like.tweetId) ? bookmarkOverrides.get(like.tweetId) : undefined}
              onToggleBookmark={handleToggleBookmark}
            />
          </div>
        ))}
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /><path d="M8 11h6" strokeLinecap="round" /></svg>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No tweets match your search.
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Try a different search term.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            &larr; Prev
          </button>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
