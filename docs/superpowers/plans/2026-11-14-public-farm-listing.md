# Public Farm Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display active Supabase farms in Popular, Wet Season, and Dry Season sections and provide working `/farms/[id]` detail links.

**Architecture:** Extend the existing public active-farm repository query and pure homepage helpers, then update the existing `/farm` App Router page and add a minimal active-farm detail page. Reuse the current public Supabase client and safe image URL helper; do not change reservation behavior.

**Tech Stack:** Next.js App Router, React, Supabase JS, CSS Modules, Node.js built-in test runner.

**Spec:** [docs/superpowers/specs/2026-11-14-public-farm-listing-design.md](../specs/2026-11-14-public-farm-listing-design.md)

## Global Constraints

- Keep the listing at `/farm` and preserve its search behavior.
- Display each farm's image, name, location, province, and season.
- Link each farm to `/farms/[id]` and make that route resolve for active farms.
- Do not modify reservation tables, API routes, or email logic.
- Do not add a database migration; assume the existing Supabase `farms.season` column is available.

## Review Focus

- A trending farm without a “popular” category still belongs in Popular — pin this with `getPopularFarms` tests.
- A “popular” category remains eligible when `is_trending` is false — pin this with `getPopularFarms` tests.
- Wet/dry labels may be stored in either `season` or `category`, with mixed casing — pin this with helper tests.
- A farm may match more than one section and must not be made exclusive — pin this with category helper tests.
- Missing/inactive farm IDs must not expose a detail page — pin the repository lookup to `is_active = true` and verify its null result.

---

### Task 1: Query and classify active farms

**Files:**
- Modify: `src/lib/reservations/repository.mjs`
- Modify: `src/lib/homepage.mjs`
- Test: `tests/reservations/repository.test.mjs`
- Test: `tests/app/homepage.test.mjs`

**Interfaces:**
- Produces `getActiveFarmById(client, farmId)`, which resolves to the active farm row or `null` and propagates Supabase errors.
- Produces `getWetSeasonFarms(farms)` and `getDrySeasonFarms(farms)`, returning the matching farms without changing the input order.
- Updates `getPopularFarms(farms)` to return only farms with `is_trending === true` or a case-insensitive `category` match for “popular”; no fallback farms.
- `getActiveFarms(client)` selects `season` in addition to its existing fields.

- [x] **Step 1: Add failing helper tests**

Add focused tests proving trending farms and category-matched farms are included in Popular, unrelated farms are excluded with no fallback, and wet/dry matches are case-insensitive across `season` and `category`. Assert a farm matching both a season and Popular appears in both returned lists.

- [x] **Step 2: Add failing repository tests**

Assert `getActiveFarms` selects `season`. Assert `getActiveFarmById(client, farmId)` filters by both `id` and `is_active = true`, returns the active row or `null`, and surfaces Supabase errors.

- [x] **Step 3: Run both focused test files and verify the expected failures**

Run: `node --test tests/app/homepage.test.mjs tests/reservations/repository.test.mjs`
Expected: FAIL because Popular ignores `is_trending`, season helpers and `getActiveFarmById` are missing, and `season` is absent from the query.

- [x] **Step 4: Implement category helpers and active farm lookup**

Implement `getWetSeasonFarms(farms)` and `getDrySeasonFarms(farms)` in `src/lib/homepage.mjs`, matching season keywords case-insensitively in `season` or `category`. Update `getPopularFarms(farms)` to use the approved rule and return no unrelated fallback farms. Add `getActiveFarmById(client, farmId)` in `src/lib/reservations/repository.mjs` using `maybeSingle()` and ID/active filters; add `season` to the existing active-list selection.

- [x] **Step 5: Run both focused test files**

Run: `node --test tests/app/homepage.test.mjs tests/reservations/repository.test.mjs`
Expected: PASS.

---

### Task 2: Render the farm listing and detail route

**Files:**
- Modify: `src/app/farm/page.js`
- Create: `src/app/farms/[id]/page.js`
- Create: `src/app/components/FarmThumbnail.js`
- Create: `src/app/farm/farm-listing.module.css`

**Interfaces:**
- Consumes: `getActiveFarms(client)`, `getActiveFarmById(client, farmId)`, `getPopularFarms(farms)`, `getWetSeasonFarms(farms)`, `getDrySeasonFarms(farms)`, and existing `getFarmImageUrl(farm)`.
- `FarmThumbnail({ farm, sizes, className })` renders the safe image URL returned by `getFarmImageUrl(farm)` using Next Image with `unoptimized`.

- [x] **Step 1: Add the reusable farm thumbnail**

Create `FarmThumbnail({ farm, sizes, className })` in `src/app/components/FarmThumbnail.js`. Render the URL returned by `getFarmImageUrl(farm)` with `next/image`, `fill`, and `unoptimized`; use the farm name for image alt text.

- [x] **Step 2: Update `/farm` to group the already-filtered active farms**

Preserve the current search form. Apply its query filter before grouping the results. Render Popular, Wet Season, and Dry Season sections; each card shows the farm thumbnail, name, location, province, and season, and links to `/farms/${encodeURIComponent(String(farm.id))}`. Render an empty state for categories with no matches.

- [x] **Step 3: Add `/farms/[id]`**

Await the App Router `params`, load the requested active farm with the public Supabase client, call `notFound()` when the ID is missing or inactive, and render the image, name, location, province, and season with a link back to `/farm`. Preserve the existing setup notice behavior for missing Supabase configuration and allow other query errors to propagate.

- [x] **Step 4: Add responsive listing/detail styles**

Create a CSS module for category headings, farm cards, responsive image containers, and detail layout. Keep the existing visual language: white cards, green headings, and readable spacing on narrow screens.

- [x] **Step 5: Run the complete test suite**

Run: `npm test`
Expected: all non-integration tests pass; credential-dependent integration tests may be skipped.

- [x] **Step 6: Run lint and production build**

Run: `npm run lint && npm run build`
Expected: both commands complete successfully, confirming App Router and image component compatibility.
