'use client'

export default function ExportButton({ archive }: { archive: string }) {
  return (
    <a
      href={`/archive/${archive}/export`}
      download
      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" /><polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" /></svg>
      Export to Markdown
    </a>
  )
}
