# Farm Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/farms/[id]` into a media-rich farm detail page with a sticky information/reservation sidebar and local-only chat.

**Architecture:** Extend the existing server-side active-farm lookup to fetch all detail columns, then render the page as a Server Component with native video/photo visuals and a responsive sticky sidebar. Isolate chat input and message state in a small Client Component.

**Tech Stack:** Next.js App Router, React, Supabase JS, CSS Modules, Node.js built-in test runner, integrated browser/Playwright validation.

**Spec:** [docs/superpowers/specs/2026-11-14-farm-detail-page-design.md](../specs/2026-11-14-farm-detail-page-design.md)

## Global Constraints

- Support direct media URLs for the walkthrough video (MP4/WebM), not provider embeds.
- Do not add a database migration or modify reservation tables, API routes, or email logic.
- Assume the listed farm detail columns already exist in Supabase; the checked-in migrations do not define every requested detail column.
- Keep farm data server-rendered; chat messages remain local and are not sent to a backend.
- Keep the requested sidebar sticky on desktop and non-sticky on mobile.

## Review Focus

- No `video_url` means no broken or empty video player — test the media helper and verify the page without a video.
- Unsafe video/image schemes must not become media sources — test the media helpers with `javascript:`, `data:`, and protocol-relative URLs.
- Missing, scalar, and array `images` values should produce a safe gallery without changing image order — test `getFarmImageUrls`.
- Structured fields may be strings, arrays, objects, or empty — test `formatFarmDetailValue` for each and verify empty values show “Not provided”.
- Chat submission must trim and append non-empty input, ignore whitespace-only input, clear the field, and make no network request — test append behavior and verify the browser flow.

---

### Task 1: Load all requested farm detail fields

**Files:**
- Modify: `src/lib/reservations/repository.mjs`
- Test: `tests/reservations/repository.test.mjs`

**Interfaces:**
- Updates `getActiveFarmById(client, farmId)` to select `id,name,description,location,province,category,is_trending,images,season,bearing_season,video_url,crops,hours,entrance_fee,activities`.
- Preserves the existing `id` and `is_active = true` filters, `maybeSingle()` behavior, and error propagation.

- [ ] **Step 1: Add a failing query-shape test**

Assert the active-farm detail lookup selects every field listed above and applies both the farm ID and active-status filters.

- [ ] **Step 2: Run the repository tests and verify the expected failure**

Run: `node --test tests/reservations/repository.test.mjs`
Expected: FAIL because the detail selection omits `bearing_season`, `video_url`, `hours`, `entrance_fee`, and `activities`.

- [ ] **Step 3: Extend the active-farm detail selection**

Update only the `getActiveFarmById` select list in `src/lib/reservations/repository.mjs`; do not modify migrations, reservation tables, API routes, or email code.

- [ ] **Step 4: Run the repository tests**

Run: `node --test tests/reservations/repository.test.mjs`
Expected: PASS.

---

### Task 2: Add safe media, detail-value, and local-chat helpers

**Files:**
- Modify: `src/lib/homepage.mjs`
- Test: `tests/app/homepage.test.mjs`

**Interfaces:**
- Produces `getFarmImageUrls(farm)`, which returns all safe image URLs from `images` in input order without placeholder entries.
- Produces `getFarmVideoUrl(value)`, which returns a safe HTTPS or root-relative media URL, or `null` for missing/unsafe values.
- Produces `formatFarmDetailValue(value)`, which trims strings, stringifies numbers, joins arrays with `, `, formats object entries as `key: value` separated by `; `, and returns an empty string for empty values.
- Produces `appendFarmChatMessage(messages, text, id)`, which appends `{ id, text: trimmedText }` for non-empty text and returns the original messages for empty input.

- [ ] **Step 1: Add failing helper tests**

Test valid and invalid gallery URLs and order; missing/unsafe video URLs; readable formatting of strings, arrays, objects, and empty values; and trimmed versus whitespace-only local chat messages.

- [ ] **Step 2: Run the helper tests and verify the expected failures**

Run: `node --test tests/app/homepage.test.mjs`
Expected: FAIL because the new helpers are not implemented.

- [ ] **Step 3: Implement the helpers**

In `src/lib/homepage.mjs`, reuse existing URL safety rules for image and video sources. Preserve `getFarmImageUrl` fallback behavior for existing callers while making the gallery helper omit invalid entries. Keep the chat helper pure; it must not perform network calls.

- [ ] **Step 4: Run the helper tests**

Run: `node --test tests/app/homepage.test.mjs`
Expected: PASS.

---

### Task 3: Build the two-column detail page and local chat

**Files:**
- Modify: `src/app/farms/[id]/page.js`
- Modify: `src/app/farm/farm-listing.module.css`
- Create: `src/app/components/FarmChatBox.js`

**Interfaces:**
- Consumes: `getActiveFarmById(client, farmId)`, `getFarmImageUrls(farm)`, `getFarmVideoUrl(value)`, `formatFarmDetailValue(value)`, and `appendFarmChatMessage(messages, text, id)`.
- Renders `FarmChatBox({ farm })` as a Client Component with local message state only.

- [ ] **Step 1: Update the detail page layout and visuals**

Keep the existing server query, setup notice, and not-found behavior. Render a native `<video controls>` with no autoplay only when `video_url` is safe; render every safe gallery image from `images`; display an empty gallery state if none are valid.

- [ ] **Step 2: Add the structured sticky sidebar**

Show `location`, `province`, `season`, `bearing_season`, `crops`, `hours`, `entrance_fee`, `activities`, and `description`, using “Not provided” for empty values. Add a reservation link to `/reservation?farmId=${encodeURIComponent(String(farm.id))}` and place `FarmChatBox farm={farm}` last in the sidebar.

- [ ] **Step 3: Add the client chat component**

Create a labeled message list and input form. On submit, append the trimmed input using `appendFarmChatMessage`, clear the input, do not add an assistant reply, and state that messages stay local and are not sent.

- [ ] **Step 4: Add responsive two-column and sticky-sidebar styles**

Use the existing green/white style language. Keep the sidebar sticky with bounded internal scrolling on desktop; remove stickiness and the height limit on narrow screens.

- [ ] **Step 5: Validate the detail and chat flow in the browser**

Run the app locally, open `/farm`, follow a farm card, verify the media/detail/sidebar layout, then submit a non-empty chat message and a whitespace-only message. Confirm the sent local message appears, the input clears, whitespace is ignored, and chat submission makes no network request.

- [ ] **Step 6: Run the full tests, lint, and build**

Run: `npm test && npm run lint && npm run build`
Expected: tests pass (credential-dependent integration tests may be skipped), lint passes, and the production build includes `/farms/[id]`.
