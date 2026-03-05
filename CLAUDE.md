# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 16 dashboard (React 19, Tailwind CSS 4) for browsing, searching, and tracking liked tweets from personal Twitter data archives. The archives are exported via Twitter's Data Privacy feature and placed in `zip/`. The dashboard lives in `dashboard/`.

## Tech Stack

- **Next.js 16.1.6** (App Router)
- **React 19.2.3**
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **TypeScript 5**
- **Vitest 4** for unit tests
- **tsx** for running TypeScript CLI scripts

## Running the Dashboard

```bash
cd dashboard
npm install   # first time only
npm run dev   # starts at http://localhost:3000
```

The `predev` hook runs `preflight-runner.ts` automatically before the dev server starts (see Preflight System below).

Archives are detected dynamically from `../zip/` at runtime via the `ARCHIVE_ROOT` environment variable (resolved in `next.config.ts` to the absolute path of `../zip/`). No code change is needed when a new archive is added.

## Preflight System

The preflight system (`src/lib/preflight.ts` + `src/scripts/preflight-runner.ts`) runs automatically before `npm run dev` via the `predev` script hook. It can also be run manually with `npm run preflight`.

Checks performed:

1. **node_modules exists** — errors if missing, auto-runs `npm install`
2. **node_modules freshness** — warns if `package.json` / `package-lock.json` is newer than `node_modules/.package-lock.json`, auto-runs `npm install`
3. **Key packages present** — spot-checks that `next`, `react`, `react-dom` are resolvable
4. **Next.js version match** — warns if `.next` was built with a different Next.js version, auto-deletes `.next`
5. **Build integrity** — validates `.next/build-manifest.json` when build output is present, auto-deletes `.next` if corrupt

Each check returns `ok | warn | error` with an optional auto-fix (`npm-install` or `delete-next`). Fixes are applied in order: delete `.next` first, then `npm install`.

## Archive Structure

Each dated directory under `zip/` follows the same layout:

```
zip/twitter-YYYY-MM(-DD)/
├── Your archive.html        # Main entry point; open in browser
├── data/
│   ├── manifest.js          # Archive metadata, file index, and integrity info
│   ├── README.txt           # Twitter's data dictionary (70+ data types explained)
│   ├── account.js           # Account details
│   ├── tweet.js             # All tweets
│   ├── like.js              # Liked tweets
│   ├── direct-messages*.js  # DM conversations
│   ├── follower.js          # Followers
│   ├── following.js         # Following
│   ├── personalization.js   # Inferred interests and demographics
│   └── [60+ more .js files] # Other data categories
└── assets/
    └── js/                  # Bundled viewer app (runtime, modules, i18n, main)
```

### Viewing raw archives

Each archive includes Twitter's built-in viewer — open `Your archive.html` in a desktop browser:

```bash
xdg-open zip/twitter-2024-11/"Your archive.html"
```

### Available archives

- `twitter-2022-02`, `twitter-2022-03`, `twitter-2022-05`, `twitter-2022-06`
- `twitter-2022-10`, `twitter-2022-11`
- `twitter-2023-05`, `twitter-2023-12`
- `twitter-2024-11`, `twitter-2026-02`

### Data format

Every Twitter data file follows this pattern:

```javascript
window.YTD.category.part0 = [
  { /* data object */ },
  ...
]
```

The viewer loads these globals dynamically. `manifest.js` declares the full index of files and is loaded first by `Your archive.html` to validate the archive. The field-level reference for all 70+ data types is in `zip/<archive>/data/README.txt`.

## Dashboard Source Structure

```
dashboard/src/
├── app/
│   ├── page.tsx                        # Redirects / → /archive/all
│   ├── layout.tsx                      # Root layout with ArchiveSwitcher
│   ├── archive/all/page.tsx            # All-archives merged view
│   ├── archive/all/export/route.ts     # Markdown export for combined view
│   ├── archive/[archive]/page.tsx      # Single-archive view
│   ├── archive/[archive]/export/route.ts
│   └── api/
│       ├── read-state/route.ts         # POST: patch read states in CONSOLIDATED.md
│       ├── bookmark/route.ts           # POST: patch bookmark states in CONSOLIDATED.md
│       └── word-cloud/route.ts         # GET: fetch data; POST: dismiss a word
├── components/
│   ├── ArchiveSwitcher.tsx             # Header dropdown + tab buttons (Statistics, Insights, Bookmarks)
│   ├── LikesList.tsx                   # Main tweet list with search, sort, pagination, year nav
│   ├── LikeCard.tsx                    # Single tweet card (read cycle, bookmark, content)
│   ├── StatisticsPanel.tsx             # Read/unread bar graphs (overall + per-year)
│   ├── InsightsPanel.tsx               # Word cloud + click-to-filter
│   ├── BookmarksPanel.tsx              # Filtered view of bookmarked tweets only
│   └── ExportButton.tsx                # Markdown export trigger
├── lib/
│   ├── archives.ts                     # getArchiveNames() — reads ARCHIVE_ROOT
│   ├── parser.ts                       # parseLikeJs(), parseAllArchives() — dedup, URL expansion, read state
│   ├── read-state.ts                   # CONSOLIDATED.md read/write, snowflakeToDate(), applyChanges()
│   ├── url-expander.ts                 # loadUrlCache(), expandUrls()
│   ├── statistics.ts                   # computeStatistics()
│   ├── word-cloud.ts                   # Word frequency computation
│   ├── word-cloud-data.ts              # loadWordCloudData(), saveWordCloudData(), addUserDismissedWord()
│   ├── word-cloud-generator.ts         # Full regeneration logic
│   ├── markdown.ts                     # Markdown export formatting
│   ├── year-groups.ts                  # Year divider and year-page mapping utilities
│   ├── preflight.ts                    # Preflight check functions
│   └── __tests__/                      # 7 test files (see Testing below)
├── scripts/
│   ├── expand-urls.ts                  # CLI: build/update t.co URL expansion cache
│   ├── generate-consolidated.ts        # CLI: create/append CONSOLIDATED.md
│   ├── generate-word-cloud.ts          # CLI: generate word-cloud.json
│   └── preflight-runner.ts             # CLI: run preflight checks with auto-fix
└── types/
    └── like.ts                         # ReadState type + Like interface
```

## Type Definitions

```typescript
// src/types/like.ts
type ReadState = "read" | "unread" | "in-progress" | "ignore";

interface Like {
  tweetId: string;
  fullText: string;
  expandedUrl: string;
  date: string; // YYYY-MM-DD (decoded from Snowflake ID)
  readState: ReadState;
  bookmarked: boolean;
}
```

## 4-State Read Tracking

Each tweet cycles through four states when clicked: **Unread → Read → In-Progress → Ignore → Unread**. Visual indicators:

- **Read** — green dot
- **Unread** — gray dot
- **In-Progress** — blue dot
- **Ignore** — black dot (white in dark mode)

Changes are batched client-side and saved via `POST /api/read-state` with body `{ changes: { tweetId: ReadState } }`. The API patches the `- **Read**: <Value>` line in `CONSOLIDATED.md`.

## Bookmarks

Each tweet card displays a star icon. Clicking it toggles the bookmark state (filled yellow star = bookmarked). A dedicated **Bookmarks tab** (`?tab=bookmarks`) filters to only bookmarked tweets, with its own search, sort, pagination, and year navigation.

Bookmark changes are batched alongside read-state changes and persisted via `POST /api/bookmark` with body `{ changes: { tweetId: boolean } }`. Bookmark state is stored as `- **Bookmark**: Yes/No` in each CONSOLIDATED.md entry.

## CONSOLIDATED.md (append-only)

`asset/CONSOLIDATED.md` is the ground truth for read-tracking and bookmark status. Each entry has a `Read` field (Unread/Read/In-Progress/Ignore) and a `Bookmark` field (Yes/No).

Running `npm run generate-consolidated`:

- **First run** (file doesn't exist): generates the full file from all archives
- **Subsequent runs**: only appends new entries not already present — existing entries and manual edits are preserved verbatim
- Safe to re-run any time (e.g. after adding a new archive to `zip/`)

## URL Expansion Cache

t.co short URLs in tweet text are expanded using `asset/url-cache.json`. Build or update:

```bash
cd dashboard
npm run expand-urls   # runs src/scripts/expand-urls.ts via tsx
```

The script scans all `like.js` files for t.co URLs, expands them via HTTP (following redirects), and writes results to `asset/url-cache.json`. It is resumable — already-cached URLs are skipped. Dead links are stored as `null` and displayed as `[Dead link]` in the UI. Uses rate-limit-aware retry logic (3 retries with exponential backoff, respects `Retry-After` headers) and automatically rechecks previously dead links on each run.

## Word Cloud Generation and Dismissal

Word frequencies are precomputed into `asset/word-cloud.json` (top 500 words). Generate or regenerate with:

```bash
cd dashboard
npm run generate-word-cloud   # runs src/scripts/generate-word-cloud.ts via tsx
```

**Dismissing words**: Clicking the X on a word in the cloud triggers `POST /api/word-cloud` which:

1. Removes the word from `frequencies[]` in `word-cloud.json` (immediate cleanup)
2. Persists the word to the "User-Dismissed Words" section of `asset/IGNOREDWORDS.md`
3. Sets a `stale: true` flag in `word-cloud.json`

**Stale-flag regeneration**: On the next page load, `loadWordCloudData()` detects `stale: true` and automatically runs a full regeneration — recomputing all 500 frequency slots while excluding dismissed words.

`IGNOREDWORDS.md` is the permanent record of user-dismissed words. Both the dismiss route and `npm run generate-word-cloud` read from it to exclude those words from frequency computation.

## Year Dividers and Navigation

Year divider headings (bold, dark red `#990000`, h2 size) appear inline at each year boundary in the tweet list. On wide screens (>= 1280px), a sticky side panel on the left (vertically centered) lists all years — clicking a year navigates to the correct page and scrolls to that heading. The sort toggle shows "↑ From Oldest" / "↓ From Newest".

## Dashboard Tabs

The header contains four states controlled by `?tab=` query parameter:

- **(default)** — tweet list with search, sort, pagination, year navigation, export
- **`?tab=statistics`** — read/unread bar graphs (overall + per-year)
- **`?tab=insights`** — word cloud; click a word to see matching tweets
- **`?tab=bookmarks`** — filtered view of bookmarked tweets only

## API Routes

| Endpoint          | Method | Description                                                                    |
| ----------------- | ------ | ------------------------------------------------------------------------------ |
| `/api/read-state` | POST   | Patch read states in CONSOLIDATED.md (`{ changes: { tweetId: ReadState } }`)   |
| `/api/bookmark`   | POST   | Patch bookmark states in CONSOLIDATED.md (`{ changes: { tweetId: boolean } }`) |
| `/api/word-cloud` | GET    | Fetch word cloud data (auto-regenerates if stale)                              |
| `/api/word-cloud` | POST   | Dismiss a word from the cloud (`{ word: string }`)                             |

## Testing

Unit tests use **Vitest 4** and live in `src/lib/__tests__/`:

| Test file                      | Covers                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `preflight.test.ts`            | All 5 preflight checks + `requiredFixes()`                                                                |
| `read-state.test.ts`           | `loadReadState()`, `loadBookmarkState()`, `applyChanges()`, `applyBookmarkChanges()`, `snowflakeToDate()` |
| `statistics.test.ts`           | `computeStatistics()`                                                                                     |
| `url-cache-validation.test.ts` | URL cache JSON structure validation                                                                       |
| `url-expander.test.ts`         | `expandUrls()`, `loadUrlCache()`                                                                          |
| `word-cloud.test.ts`           | Word frequency computation                                                                                |
| `year-groups.test.ts`          | Year divider and year-page mapping                                                                        |

```bash
cd dashboard
npm test              # single run
npm run test:watch    # watch mode
```

## Commands

All commands run from inside `dashboard/`:

| Command                         | Description                                         |
| ------------------------------- | --------------------------------------------------- |
| `npm run dev`                   | Start dev server (runs preflight via `predev` hook) |
| `npm run build`                 | Production build                                    |
| `npm run start`                 | Serve production build                              |
| `npm run preflight`             | Run dependency & build-cache checks manually        |
| `npm run expand-urls`           | Build/update the t.co URL expansion cache           |
| `npm run generate-consolidated` | Create or append to `asset/CONSOLIDATED.md`         |
| `npm run generate-word-cloud`   | Generate or refresh word cloud frequencies          |
| `npm test`                      | Run unit tests (Vitest)                             |
| `npm run test:watch`            | Run tests in watch mode                             |
| `npm run lint`                  | Run ESLint                                          |

## Git Hooks

`scripts/pre-commit` auto-unstages junk files (`.DS_Store`, `node_modules/`, `.next/`, etc.), warns if `package.json` changed without `package-lock.json`, and blocks files larger than 1 MB. Install with:

```bash
cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```
