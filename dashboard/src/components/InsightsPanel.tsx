'use client'

import { useState, useMemo } from 'react'
import type { Like } from '@/types/like'
import { extractWordFrequencies, findTweetsWithWord } from '@/lib/word-cloud'
import type { WordCloudData } from '@/lib/word-cloud-data'
import LikeCard from '@/components/LikeCard'

const PAGE_SIZE = 50

const COLORS = ['#990000', '#16a34a', '#2563eb', '#9333ea', '#d97706', '#0d9488']

interface InsightsPanelProps {
  likes: Like[]
  wordCloudData?: WordCloudData
}

export default function InsightsPanel({ likes, wordCloudData }: InsightsPanelProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(
    () => new Set(wordCloudData?.ignoredWords ?? []),
  )
  const [hoveredWord, setHoveredWord] = useState<string | null>(null)

  const baseFreqs = useMemo(() => {
    if (wordCloudData && wordCloudData.frequencies.length > 0) {
      return wordCloudData.frequencies
    }
    return extractWordFrequencies(likes.map((l) => l.fullText))
  }, [likes, wordCloudData])

  const wordFreqs = useMemo(
    () => baseFreqs.filter((wf) => !ignoredWords.has(wf.word)),
    [baseFreqs, ignoredWords],
  )

  const filteredTweets = useMemo(() => {
    if (!selectedWord) return []
    return findTweetsWithWord(likes, selectedWord)
  }, [likes, selectedWord])

  const maxCount = wordFreqs.length > 0 ? wordFreqs[0].count : 1
  const minCount = wordFreqs.length > 0 ? wordFreqs[wordFreqs.length - 1].count : 1

  function fontSize(count: number): number {
    if (maxCount === minCount) return 28
    const t = Math.log(count - minCount + 1) / Math.log(maxCount - minCount + 1)
    return 14 + t * 34
  }

  function handleWordClick(word: string) {
    if (selectedWord === word) {
      setSelectedWord(null)
    } else {
      setSelectedWord(word)
      setPage(1)
    }
  }

  function handleIgnoreWord(word: string) {
    setIgnoredWords((prev) => {
      const next = new Set(prev)
      next.add(word)
      return next
    })
    if (selectedWord === word) {
      setSelectedWord(null)
    }
    fetch('/api/word-cloud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    })
  }

  const totalPages = Math.max(1, Math.ceil(filteredTweets.length / PAGE_SIZE))
  const visible = filteredTweets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Word cloud */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2
          className="mb-4 text-2xl font-bold"
          style={{ color: '#990000' }}
        >
          Word Cloud
        </h2>
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
          {wordFreqs.map((wf, i) => (
            <span
              key={wf.word}
              className="relative inline-block"
              onMouseEnter={() => setHoveredWord(wf.word)}
              onMouseLeave={() => setHoveredWord(null)}
            >
              <button
                onClick={() => handleWordClick(wf.word)}
                title={`${wf.word}: ${wf.count} tweets`}
                className={`cursor-pointer rounded px-1 py-0.5 transition-all duration-150 ${
                  selectedWord === wf.word ? 'ring-2 ring-blue-500' : ''
                } ${
                  hoveredWord === wf.word
                    ? 'scale-110 ring-2 ring-zinc-300'
                    : ''
                }`}
                style={{
                  fontSize: `${fontSize(wf.count)}px`,
                  color: COLORS[i % COLORS.length],
                  fontWeight: wf.count === maxCount ? 'bold' : 'normal',
                }}
              >
                {wf.word}
              </button>
              {hoveredWord === wf.word && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleIgnoreWord(wf.word)
                  }}
                  title={`Remove "${wf.word}" from cloud`}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white shadow-sm transition-opacity hover:bg-red-600"
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>
      </section>

      {/* Filtered tweets */}
      {selectedWord && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2
              className="text-2xl font-bold"
              style={{ color: '#990000' }}
            >
              Tweets containing &ldquo;{selectedWord}&rdquo;
            </h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {filteredTweets.length}
            </span>
            <button
              onClick={() => setSelectedWord(null)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {visible.map((like) => (
              <LikeCard key={like.tweetId} like={like} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
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
        </section>
      )}
    </div>
  )
}
