import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import ArchiveSwitcher from '@/components/ArchiveSwitcher'
import { getArchiveNames } from '@/lib/archives'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Twitter Likes Explorer',
  description: 'Browse and search your Twitter likes archive',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const archiveNames = getArchiveNames()

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 antialiased dark:bg-zinc-950`}
      >
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Twitter Likes Explorer
            </h1>
            <ArchiveSwitcher archiveNames={archiveNames} />
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
