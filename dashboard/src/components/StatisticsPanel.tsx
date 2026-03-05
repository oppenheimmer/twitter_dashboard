'use client'

import { useState } from 'react'
import type { Like } from '@/types/like'
import { getGlobalStats, getStatsByYear, type ReadStats } from '@/lib/statistics'

type ViewMode = 'bar' | 'pie'

const SEGMENTS = [
  { key: 'read' as const, label: 'Read', color: '#16a34a', darkColor: '#16a34a' },
  { key: 'inProgress' as const, label: 'In Progress', color: '#93c5fd', darkColor: '#60a5fa' },
  { key: 'ignored' as const, label: 'Ignore', color: '#000000', darkColor: '#f4f4f5' },
  { key: 'unread' as const, label: 'Unread', color: '#d4d4d8', darkColor: '#3f3f46' },
] as const

function Bar({ stats }: { stats: ReadStats }) {
  const segments = SEGMENTS.map((s) => ({
    ...s,
    count: stats[s.key],
    width: stats.total === 0 ? 0 : (stats[s.key] / stats.total) * 100,
  }))

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-700">
        {segments.map((seg) =>
          seg.width > 0 ? (
            <div
              key={seg.key}
              className="transition-all"
              style={{ width: `${seg.width}%`, backgroundColor: 'var(--seg-color)' }}
              ref={(el) => {
                if (el) {
                  el.style.setProperty('--seg-color', seg.color)
                  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    el.style.setProperty('--seg-color', seg.darkColor)
                  }
                }
              }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        {segments.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: seg.color }}
            />
            <span className="dark:hidden">{seg.label}: {seg.count.toLocaleString()}</span>
            <span
              className="hidden dark:inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: seg.darkColor }}
            />
            <span className="hidden dark:inline">{seg.label}: {seg.count.toLocaleString()}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function PieChart({ stats, size = 120 }: { stats: ReadStats; size?: number }) {
  const r = size / 2
  const strokeWidth = size * 0.2
  const radius = r - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  const arcs = SEGMENTS.map((s) => ({
    ...s,
    fraction: stats.total === 0 ? 0 : stats[s.key] / stats.total,
  }))

  let offset = 0
  const arcElements = arcs.map((arc) => {
    const arcLen = circumference * arc.fraction
    const currentOffset = offset
    offset += arcLen
    if (arcLen === 0) return null
    return (
      <circle
        key={arc.key}
        cx={r}
        cy={r}
        r={radius}
        fill="none"
        stroke={arc.color}
        className={arc.key === 'unread' ? 'stroke-zinc-200 dark:stroke-zinc-700' : arc.key === 'ignored' ? 'stroke-black dark:stroke-zinc-100' : arc.key === 'inProgress' ? 'stroke-blue-300 dark:stroke-blue-400' : ''}
        strokeWidth={strokeWidth}
        strokeDasharray={`${arcLen} ${circumference - arcLen}`}
        strokeDashoffset={-currentOffset}
        transform={`rotate(-90 ${r} ${r})`}
      />
    )
  })

  const mainPercent = stats.readPercent

  return (
    <svg width={size} height={size} className="block">
      {/* Background circle */}
      <circle
        cx={r}
        cy={r}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-zinc-200 dark:text-zinc-700"
      />
      {arcElements}
      {/* Center text */}
      <text
        x={r}
        y={r}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-zinc-800 dark:fill-zinc-200"
        fontSize={size * 0.2}
        fontWeight="bold"
      >
        {mainPercent}%
      </text>
    </svg>
  )
}

function PieLegend({ stats }: { stats: ReadStats }) {
  return (
    <div className="text-sm text-zinc-600 dark:text-zinc-400">
      {SEGMENTS.map((seg) => (
        <p key={seg.key} className={seg.key !== 'read' ? 'mt-1' : ''}>
          <span
            className="inline-block h-3 w-3 rounded-sm mr-2 align-middle"
            style={{ backgroundColor: seg.color }}
          />
          {seg.label}: {stats[seg.key].toLocaleString()}
        </p>
      ))}
      <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">Total: {stats.total.toLocaleString()}</p>
    </div>
  )
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-600">
      <button
        onClick={() => onChange('bar')}
        className={`px-3 py-1 text-sm transition-colors ${
          mode === 'bar'
            ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
            : 'bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
        } rounded-l-md`}
      >
        Bar
      </button>
      <button
        onClick={() => onChange('pie')}
        className={`px-3 py-1 text-sm transition-colors ${
          mode === 'pie'
            ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
            : 'bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
        } rounded-r-md`}
      >
        Pie
      </button>
    </div>
  )
}

export default function StatisticsPanel({ likes }: { likes: Like[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>('bar')
  const global = getGlobalStats(likes)
  const byYear = getStatsByYear(likes)

  return (
    <div className="space-y-8">
      {/* View toggle */}
      <div className="flex justify-end">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Global overview */}
      <section>
        <h2
          className="mb-4 text-2xl font-bold"
          style={{ color: '#990000' }}
        >
          Overall Progress
        </h2>
        {viewMode === 'bar' ? (
          <>
            <Bar stats={global} />
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {global.read.toLocaleString()} / {global.total.toLocaleString()} read ({global.readPercent}%)
            </p>
          </>
        ) : (
          <div className="flex items-center gap-6">
            <PieChart stats={global} size={140} />
            <PieLegend stats={global} />
          </div>
        )}
      </section>

      {/* Year-wise breakdown */}
      <section>
        <h2
          className="mb-4 text-2xl font-bold"
          style={{ color: '#990000' }}
        >
          By Year
        </h2>
        {viewMode === 'bar' ? (
          <div className="space-y-4">
            {byYear.map(({ year, stats }) => (
              <div key={year}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {year}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {stats.read.toLocaleString()} / {stats.total.toLocaleString()} ({stats.readPercent}%)
                  </span>
                </div>
                <Bar stats={stats} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {byYear.map(({ year, stats }) => (
              <div key={year} className="flex flex-col items-center gap-2">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {year}
                </span>
                <PieChart stats={stats} size={100} />
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {stats.read.toLocaleString()} / {stats.total.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
