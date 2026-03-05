# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a collection of personal Twitter data archives exported from Twitter's Data Privacy feature. Each archive is self-contained and can be viewed by opening `Your archive.html` in a desktop web browser.

## Viewing an Archive

```bash
# Open any archive's viewer in a browser
xdg-open zip/twitter-2024-11/"Your archive.html"
# or
firefox zip/twitter-2022-02/"Your archive.html"
```

There is no build system, package manager, or test suite — the archives are pre-built by Twitter.

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

Available archives (oldest to newest):
- `twitter-2022-02` through `twitter-2022-11` (six monthly snapshots)
- `twitter-2023-05`, `twitter-2023-12`
- `twitter-2026-02` (most recent)

## Data Format

Every data file follows this pattern:

```javascript
window.YTD.category.part0 = [
  { /* data object */ },
  ...
]
```

The viewer loads these globals dynamically. `manifest.js` declares the full index of files and is loaded first by `Your archive.html` to validate the archive.

## Data Reference

`zip/twitter-2022-02/data/README.txt` is the authoritative field-level reference for all 70+ data types. It also maps each category to CCPA classifications (Identifiers, Online Activity, Location, Inferences, etc.).

## Likes Explorer Dashboard

An interactive Next.js 15 dashboard for browsing and searching liked tweets lives in `dashboard/`.

### Running the dashboard

```bash
cd dashboard
npm install   # first time only
npm run dev   # starts at http://localhost:3000
```

The app reads archive data directly from `../zip/` via server-side file reads. It redirects `/` to `/archive/all` (the globally-deduplicated combined view) by default.

Archives are detected dynamically from `../zip/` at runtime — no code change needed when a new archive is added.

### Default view: All Archives

`/archive/all` merges all detected archives into a single globally-deduplicated list (first-seen `tweetId` wins). The export at `/archive/all/export` downloads `all-archives-likes.md`.

### URL expansion cache

t.co short URLs in tweet text are expanded using a pre-built cache file `asset/url-cache.json`. This file is safe to gitignore. To build or update the cache:

```bash
cd dashboard
npm run expand-urls   # runs src/scripts/expand-urls.ts via tsx
```

The script scans all `like.js` files for t.co URLs, expands them via HTTP (following redirects), and writes results to `asset/url-cache.json`. It is resumable — already-cached URLs are skipped. Dead links are stored as `null` and displayed as `[Dead link]` in the UI. The script uses rate-limit-aware retry logic (3 retries with exponential backoff, respects `Retry-After` headers) and automatically rechecks previously dead links on each run to recover URLs that were incorrectly marked dead due to transient failures.

### Generated assets

The `asset/` directory holds generated/data files that are gitignored:
- `asset/url-cache.json` — t.co URL expansion cache
- `asset/CONSOLIDATED.md` — stateful record of all liked tweets (see below)
- `asset/word-cloud.json` — precomputed top-500 word frequencies for the word cloud
- `asset/IGNOREDWORDS.md` — built-in stop words + user-dismissed words (permanent record)

### CONSOLIDATED.md (append-only)

`asset/CONSOLIDATED.md` is the ground truth for read-tracking and bookmark status. Each entry has a `Read` field (Unread/Read/In-Progress/Ignore) and a `Bookmark` field (Yes/No).

Running `npm run generate-consolidated`:
- **First run** (file doesn't exist): generates the full file from all archives
- **Subsequent runs**: only appends new entries not already present — existing entries and manual `Read: Yes` edits are preserved verbatim
- Safe to re-run any time (e.g. after adding a new archive to `zip/`)

Read indicators (green/gray dots) on each tweet card are clickable toggle buttons. Changes are batched client-side and persisted via "Save changes" button, which calls `POST /api/read-state` to patch CONSOLIDATED.md in place. A star icon below the date allows bookmarking tweets — clicking it toggles the bookmark state (filled yellow star = bookmarked). Bookmark changes are batched alongside read-state changes and saved via `POST /api/bookmark`, which patches the `**Bookmark**: Yes/No` field in CONSOLIDATED.md.

### Available archives

- `twitter-2022-02`, `twitter-2022-03`, `twitter-2022-05`, `twitter-2022-06`
- `twitter-2022-10`, `twitter-2022-11`
- `twitter-2023-05`, `twitter-2023-12`
- `twitter-2024-11`, `twitter-2026-02`

Switch between archives using the dropdown in the dashboard header. "All Archives" is the first option (globally deduplicated). Each single-archive view is deduplicated by `tweetId` within that archive.

### Bookmark

Each tweet card displays a star icon below the date. Clicking it toggles the bookmark state. Bookmarked tweets show a filled yellow star; unbookmarked tweets show an outline star. Bookmark changes are batched client-side alongside read-state changes and persisted via the "Save changes" button. The bookmark API endpoint is `POST /api/bookmark` with body `{ changes: { tweetId: boolean } }`. Bookmark state is stored as `- **Bookmark**: Yes/No` in each CONSOLIDATED.md entry, between the Read and URL fields.

### Year dividers and navigation

Year divider headings (bold, dark red `#990000`, h2 size) appear inline at each year boundary in the tweet list. On wide screens (>= 1280px), a sticky side panel on the left (vertically centered) lists all years present in the current view at h2 size — clicking a year navigates to the correct page and scrolls to that heading. The sort toggle shows "↑ From Oldest" / "↓ From Newest" with directional arrows.

### Statistics tab

A "Statistics" button next to the archive dropdown toggles between the tweet list and a statistics view (`?tab=statistics`). The statistics panel shows:
- **Overall Progress** — a horizontal bar graph of read (green) vs unread (gray) counts with percentage
- **By Year** — per-year breakdown with individual bar graphs

Stats update automatically when switching archives.

### Insights tab

An "Insights" button next to Statistics in the header toggles to an insights view (`?tab=insights`). The insights panel shows:
- **Word cloud** — top 100 most frequent words from tweet text (stop words filtered, URLs stripped)
- **Click a word** to see matching tweets sorted newest-first
- **Pagination** for filtered results (50 per page)

### Word cloud generation and dismissal

Word frequencies are precomputed into `asset/word-cloud.json` (top 500 words). Generate or regenerate with:

```bash
cd dashboard
npm run generate-word-cloud   # runs src/scripts/generate-word-cloud.ts via tsx
```

**Dismissing words**: Clicking the X on a word in the cloud triggers `POST /api/word-cloud` which:
1. Removes the word from `frequencies[]` in `word-cloud.json` (immediate cleanup)
2. Persists the word to the "User-Dismissed Words" section of `asset/IGNOREDWORDS.md`
3. Sets a `stale: true` flag in `word-cloud.json`

**Stale-flag regeneration**: On the next page load, `loadWordCloudData()` detects `stale: true` and automatically runs a full regeneration — recomputing all 500 frequency slots while excluding dismissed words. This ensures no stale data and no empty slots after dismissals.

`IGNOREDWORDS.md` is the permanent record of user-dismissed words. Both the dismiss route and `npm run generate-word-cloud` read from it to exclude those words from frequency computation.

### Markdown export

Each archive page has an "Export to Markdown" button that downloads a `.md` file of all liked tweets via `/archive/{name}/export`. The "All Archives" combined export downloads `all-archives-likes.md`.
