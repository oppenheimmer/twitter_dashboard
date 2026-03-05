# Twitter Archive Explorer — Instructions

## Project Structure

```
twitter-archive-explore/
├── zip/                        # Twitter data archives (read-only, do not modify)
│   ├── twitter-2022-02/
│   ├── twitter-2022-03/
│   ├── twitter-2022-05/
│   ├── twitter-2022-06/
│   ├── twitter-2022-10/
│   ├── twitter-2022-11/
│   ├── twitter-2023-05/
│   ├── twitter-2023-12/
│   ├── twitter-2024-11/
│   └── twitter-2026-02/
├── dashboard/                  # Next.js 16 web dashboard
├── asset/                      # Generated/data files (gitignored contents)
│   ├── url-cache.json          # t.co URL expansion cache
│   ├── word-cloud.json         # Precomputed top-500 word frequencies
│   ├── IGNOREDWORDS.md         # Built-in stop words + user-dismissed words
│   └── CONSOLIDATED.md         # Stateful record of all liked tweets (append-only)
├── images/                     # Screenshots for README
├── scripts/                    # Git hooks
│   └── pre-commit              # Auto-unstage junk, warn on lock drift, block large files
└── INSTRUCTIONS.md             # This file
```

---

## Prerequisites

- **Node.js v18 or later** — check with `node --version`
- **npm v8 or later** — check with `npm --version`
- The `zip/` directory must be present with the archive folders listed above

---

## Step 1 — Clone / open the project

All commands below assume you are in the project root:

```bash
cd /path/to/twitter-archive-explore
```

---

## Step 2 — Install dependencies

This only needs to be done once, or after `package.json` changes.

```bash
cd dashboard
npm install
```

Expected output: a `node_modules/` directory created inside `dashboard/`.

---

## Step 3 — (Recommended) Build the URL expansion cache

Twitter shortens all links to `t.co/…` URLs. This step expands them to their real destinations and saves the results locally. Without it, tweet text shows raw `t.co/…` links.

```bash
cd dashboard
npm run expand-urls
```

What it does:

- Scans every `like.js` file across all 10 archives for `t.co` URLs
- Fetches each unique URL (5 at a time, 200 ms delay between requests, follows redirects, 10 s timeout)
- Retries failed requests up to 3 times with exponential backoff (1 s, 2 s, 4 s); respects HTTP 429 `Retry-After` headers
- Saves results to `asset/url-cache.json`
- Prints progress: `[n/total] https://t.co/… → https://real-url.com`
- After expanding new URLs, rechecks all previously dead links (`null` entries) and recovers any that now resolve
- Dead or broken links are stored as `null` and shown as `[Dead link]` in the UI

This is **resumable** — if interrupted, re-running skips already-cached URLs. Run it again any time to pick up new likes from a freshly added archive or to recover previously dead links.

---

## Step 4 — Start the dashboard

```bash
cd dashboard
npm run dev
```

Then open **http://localhost:3000** in your browser.

A **preflight check** runs automatically before the dev server starts. It validates that dependencies are installed and up to date, checks for Next.js version mismatches, and verifies build-cache integrity. If issues are found, it auto-fixes them (runs `npm install` or deletes a stale `.next/` directory). You can also run preflight manually: `npm run preflight`.

Archives are detected automatically from `zip/` — no database or environment variable setup required.

To stop the server: press `Ctrl+C` in the terminal.

---

## Step 5 — (Optional) Generate CONSOLIDATED.md

This produces a single flat Markdown file of all unique liked tweets, sorted newest-first, with read-state and bookmark fields for tracking.

```bash
cd dashboard
npm run generate-consolidated
```

Output file: `asset/CONSOLIDATED.md`.

Each entry looks like:

```markdown
## 1. [Tweet 1856551798573597051](https://twitter.com/i/web/status/1856551798573597051)

- **Date**: 2024-11-13
- **Read**: Unread
- **Bookmark**: No
- **URL**: https://example.com/article
- **Tweet**: Full text of the liked tweet...
```

Read states cycle through: **Unread → Read → In-Progress → Ignore**. You can edit these manually in the file or use the dashboard UI.

**Safe to re-run:** `generate-consolidated` is append-only. It only adds entries for new tweetIds not already in the file. All existing entries — including your manual edits — are preserved verbatim.

---

## Step 6 — (Optional) Generate word cloud data

Precomputes the top 500 most frequent words across all liked tweets for the Insights tab word cloud.

```bash
cd dashboard
npm run generate-word-cloud
```

Output files:

- `asset/word-cloud.json` — word frequencies used by the dashboard
- `asset/IGNOREDWORDS.md` — lists built-in stop words and any user-dismissed words

When you dismiss a word from the cloud in the UI (click the X), it is removed from `word-cloud.json` and persisted to `IGNOREDWORDS.md`. A `stale` flag is set so the next page refresh triggers an automatic full regeneration, backfilling all 500 frequency slots with the next most-frequent words.

**Safe to re-run:** `generate-word-cloud` reads user-dismissed words from `IGNOREDWORDS.md` and preserves them across regenerations.

---

## Dashboard routes

### Pages

| URL                           | What it shows                                 |
| ----------------------------- | --------------------------------------------- |
| `http://localhost:3000`       | Redirects to `/archive/all`                   |
| `/archive/all`                | All 10 archives merged, globally deduplicated |
| `/archive/all?tab=statistics` | Statistics view (read/unread bar graphs)      |
| `/archive/all?tab=insights`   | Word cloud and click-to-filter                |
| `/archive/all?tab=bookmarks`  | Bookmarked tweets only                        |
| `/archive/all/export`         | Download `all-archives-likes.md`              |
| `/archive/{name}`             | Single archive view (same tabs available)     |
| `/archive/{name}/export`      | Download that archive's `.md` file            |

### API endpoints

| Endpoint          | Method | Description                                                                    |
| ----------------- | ------ | ------------------------------------------------------------------------------ |
| `/api/read-state` | POST   | Patch read states in CONSOLIDATED.md (`{ changes: { tweetId: ReadState } }`)   |
| `/api/bookmark`   | POST   | Patch bookmark states in CONSOLIDATED.md (`{ changes: { tweetId: boolean } }`) |
| `/api/word-cloud` | GET    | Fetch word cloud data (auto-regenerates if stale)                              |
| `/api/word-cloud` | POST   | Dismiss a word from the cloud (`{ word: string }`)                             |

Replace `{name}` with any archive name listed in the project structure above.

---

## Dashboard features

- **Archive switcher** — dropdown in the header to switch between "All Archives" and individual archives
- **Search** — full-text search across tweet bodies, filters results in real time
- **Pagination** — 50 tweets per page with Prev / Next controls
- **Export to Markdown** — button on each page downloads a `.md` file of all tweets in the current view
- **Year dividers** — bold dark-red headings appear at each year boundary in the tweet list
- **Year navigation** — on wide screens (>= 1280px), a sticky side panel lists all years; clicking a year jumps to the correct page and scrolls to that heading
- **Sort toggle** — "↑ From Oldest" / "↓ From Newest" button with directional arrows
- **4-state read tracking** — click the dot on any tweet to cycle through Unread (gray) → Read (green) → In-Progress (blue) → Ignore (black); pending changes are batched and saved with the "Save changes (N)" button
- **Bookmarks** — click the star icon on any tweet to bookmark it (filled yellow star); bookmark changes are batched alongside read-state changes and saved via the same "Save changes (N)" button
- **Bookmarks tab** — dedicated tab (`?tab=bookmarks`) showing only bookmarked tweets with search, sort, pagination, and year navigation
- **Statistics tab** — read/unread bar graphs: overall progress and per-year breakdown
- **Insights tab** — word cloud of most frequent words; click a word to see matching tweets; dismiss words with the X button (persisted, auto-regenerated on next page load)

---

## Adding a new archive

1. Place the new archive folder (e.g. `twitter-2025-06/`) inside `zip/`
2. Ensure it contains `data/like.js`
3. Restart `npm run dev` — the new archive appears in the dropdown automatically
4. Run `npm run expand-urls` to cache any new `t.co` URLs
5. Run `npm run generate-consolidated` to append new likes to `CONSOLIDATED.md`
6. Run `npm run generate-word-cloud` to refresh word cloud frequencies

---

## Production build (optional)

Produces a fully static build with all archive pages pre-rendered:

```bash
cd dashboard
npm run build   # compile and pre-render
npm run start   # serve the built output on http://localhost:3000
```

---

## Quick reference

All commands run from inside `dashboard/`:

| Command                         | What it does                                    |
| ------------------------------- | ----------------------------------------------- |
| `npm install`                   | Install dependencies (first time only)          |
| `npm run dev`                   | Start dev server (runs preflight automatically) |
| `npm run preflight`             | Run dependency & build-cache checks manually    |
| `npm run expand-urls`           | Build / update the t.co URL expansion cache     |
| `npm run generate-consolidated` | Create or append to `asset/CONSOLIDATED.md`     |
| `npm run generate-word-cloud`   | Generate or refresh word cloud frequencies      |
| `npm test`                      | Run unit tests (Vitest)                         |
| `npm run test:watch`            | Run tests in watch mode                         |
| `npm run build`                 | Production build                                |
| `npm run start`                 | Serve production build                          |
