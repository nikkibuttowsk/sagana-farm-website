# Supabase Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure farm reservation flow backed by Supabase, with email-based administrator approval and QR tickets sent only after approval.

**Architecture:** Keep farm reads and all reservation actions in Next.js server components and Route Handlers. Supabase stores farms, time slots, reservations, and one-time action data under RLS; Resend handles transactional mail; an opaque QR URL resolves only approved, minimal ticket details.

**Tech Stack:** Next.js 16 App Router, JavaScript ES modules, Supabase JS, PostgreSQL migrations/RLS, Resend, `qrcode`, and Node's built-in test runner.

**Spec:** [2026-11-13-supabase-reservations-design.md](../specs/2026-11-13-supabase-reservations-design.md)

## Global Constraints

- Keep the existing Next.js App Router structure.
- Supabase is the source of truth for active farms and reservations.
- Farm time-slot choices are configured per farm in Supabase. Dates and times use the `Asia/Manila` timezone.
- Use a server-only Supabase client for reservation mutations. The service-role key must never be exposed to browser code; public clients must not be able to read or change reservation records.
- Enable row-level security. Public farm reads are limited to active farms; reservations and approval data are not publicly readable or writable.
- Validate and constrain all submitted fields server-side. Add basic abuse protection to the public reservation endpoint.
- Generate high-entropy, opaque approval and ticket tokens. Store only token hashes in Supabase; approval tokens expire after 72 hours and are consumed once; ticket tokens expire at the end of the visit date plus one day in `Asia/Manila`; do not put personal information in QR payloads.
- A QR code opens a ticket lookup page that reveals only the minimum arrival information (farm, date, time slot, guest count, and reservation status).
- Guest count must be a positive whole number. A farm may optionally configure a per-reservation maximum; this does not represent slot capacity or guarantee availability.
- Configure credentials through environment variables and provide an `.env.example` with names only. Do not commit credentials or request them in chat.
- Use Resend for transactional email, configurable with environment variables. Delivery failures must be surfaced explicitly; a failed email must not be represented as a successful notification.
- Farm records and the administrator email are configured outside the visitor-facing application, using Supabase and environment configuration.

## Review Focus

- A forged, expired, used, or replayed administrator token cannot change a reservation; test each rejection and a competing decision.
- A public ticket URL reveals no visitor contact information and does not resolve pending/rejected reservations; test valid and invalid ticket tokens.
- Invalid farm/slot IDs, inactive records, malformed fields, and oversized payloads do not create reservations; test each input class.
- Email-provider errors do not roll back or misreport saved state; test notification failure at submission and after approval.
- Missing environment variables fail clearly on server operations and never make the service-role key available to client modules; test client initialization and lint/build boundaries.

---

### Task 1: Add schema, database policies, and project configuration

**Files:**
- Create: `supabase/migrations/20261113000000_create_farm_reservations.sql`
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces database tables `farms`, `farm_time_slots`, and `reservations`.
- Produces RPC `decide_reservation_action(action_token_hash, decision, ticket_token_hash)` for an atomic one-time decision with an explicit result, and `claim_ticket_email_retry(retry_token_hash, replacement_ticket_token_hash)` for approved-ticket retries.
- Public database access may select active farm and active time-slot rows only. Anonymous and authenticated clients cannot read or mutate reservations or execute the two RPCs; only `service_role` may execute them.
- Adds environment variable names `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FARM_ADMIN_EMAIL`, `RESERVATION_FROM_EMAIL`, and `APP_BASE_URL`.

- [x] **Step 1: Add the Node test script and runtime dependencies**

Add `"test": "node --test"` to `package.json`. Pin `@supabase/supabase-js` to `2.109.0`, the newest checked release compatible with the existing Node 20 runtime; add runtime dependencies `resend` and `qrcode`. Use `.mjs` for pure modules and tests so the built-in Node runner can import them without changing the package module type.

- [x] **Step 2: Write the Supabase migration**

Create `farms` with public farm details, active flag, optional positive `max_party_size`, and timestamps; `farm_time_slots` with farm reference, label, active flag, ordering, and timestamps; and `reservations` with farm and slot references, visitor contact fields, positive guest count, visit date, pending/approved/rejected status, approval/ticket/retry token hashes and expiry/consumption timestamps, and email delivery timestamps.

Use database constraints for required values, positive guest counts, optional max party size, status, and foreign keys. Add a composite foreign key so a reservation's selected time slot belongs to its selected farm. Add RLS policies for active farm/slot reads only. Add `decide_reservation_action` as a transaction that validates token hash, expiry, unused state, and pending status before changing status and consuming the token; add `claim_ticket_email_retry` to authorize a throttled retry only for an approved reservation. Fix the function `search_path`, revoke default public execution, and grant execution to `service_role` only.

- [x] **Step 3: Add environment and setup documentation**

Add the seven variable names above to `.env.example` with empty values. Since `.env*` is already ignored, add an exception for `.env.example` to `.gitignore`. Update `README.md` with Supabase project setup, migration application, farm/time-slot entry, Resend sender verification, environment setup, Asia/Manila handling, and the fact that farm capacity is reviewed manually.

- [x] **Step 4: Review the migration security boundary**

Check that RLS is enabled on all three tables, there is no anonymous reservation policy, both RPCs reject non-service callers, and function execution cannot be reached through `anon` or `authenticated`. No live project credentials are available, so applying the migration and checking effective policies in the hosted Supabase project remains a deployment step.

---

### Task 2: Implement server-only Supabase access and reservation primitives

**Files:**
- Create: `src/lib/config/env.mjs`
- Create: `src/lib/supabase/clients.mjs`
- Create: `src/lib/reservations/validation.mjs`
- Create: `src/lib/reservations/tokens.mjs`
- Create: `src/lib/reservations/repository.mjs`
- Create: `tests/reservations/validation.test.mjs`
- Create: `tests/reservations/tokens.test.mjs`
- Create: `tests/reservations/repository.test.mjs`

**Interfaces:**
- `createPublicSupabaseClient() -> SupabaseClient`: uses only the public URL/key for active farm and slot reads.
- `createAdminSupabaseClient() -> SupabaseClient`: imports `server-only` and uses the service-role key; throws a named configuration error when required variables are absent.
- `requireServerEnv(names, env) -> Record<string, string>`: returns configured non-empty values or throws an error naming only missing variable names.
- `validateReservation(input, { maxPartySize = null, now = new Date() }) -> { ok: true, value } | { ok: false, errors }`: validates visitor name/email/phone, farm/slot UUIDs, positive integer guest count, `YYYY-MM-DD` visit date, and a supplied configured farm maximum.
- `createOpaqueToken() -> { token: string, hash: string }` and `hashToken(token: string) -> string`: use cryptographically secure random bytes and SHA-256.
- `getActiveFarms(client) -> Promise<Farm[]>` and `getActiveTimeSlots(client, farmId) -> Promise<TimeSlot[]>`.
- `createPendingReservation(input, actionTokenHash, retryTokenHash, client) -> Promise<Reservation>`: verifies active farm/slot and guest limit before inserting pending data.
- `decideReservation(actionToken, decision, ticketTokenHash, client) -> Promise<{ ok: true, reservation: Reservation } | { ok: false, reason: 'invalid' | 'expired' | 'used' | 'not_pending' }>`: invokes the atomic RPC and returns an explicit failure reason rather than treating it as success.
- `getApprovedTicket(ticketToken, client) -> Promise<Ticket | null>`: selects only farm name, visit date, slot label, guest count, and status for an approved reservation.
- `claimTicketEmailRetry(retryToken, replacementTicketTokenHash, client) -> Promise<Reservation | null>`: invokes the retry RPC and returns only approved reservation email/ticket data.

- [x] **Step 1: Write validation and environment tests**

Add tests named `rejectsMissingContactFields`, `rejectsMalformedEmailAndPhone`, `rejectsInvalidDateOrGuestCount`, `rejectsInvalidFarmAndSlotIdentifiers`, `acceptsValidRequest`, `enforcesOptionalFarmGuestLimit`, and `reportsMissingServerEnvironmentValues`. Assert structured field errors for invalid data and a normalized valid value for a valid request.

- [x] **Step 2: Run the tests and verify they fail**

Run: `npm test`
Expected: validation tests fail because `validateReservation` is not implemented.

- [x] **Step 3: Implement `validateReservation`**

Implement the signature above in `src/lib/reservations/validation.mjs`. Normalize whitespace and email casing; require valid `YYYY-MM-DD` dates in `Asia/Manila` that are not in the past; accept only positive integer guest counts and honor a non-null farm max. The repository fetches the active farm and slot first and supplies `farm.max_party_size`.

- [x] **Step 4: Write token tests**

Test `createsUniqueOpaqueTokenAndHash`, `hashesSameTokenDeterministically`, and `rejectsEmptyToken`.

- [x] **Step 5: Run token tests and verify they fail**

Run: `npm test -- tests/reservations/tokens.test.mjs`
Expected: token tests fail because token helpers are not implemented.

- [x] **Step 6: Implement token helpers**

Implement `createOpaqueToken` and `hashToken` in `src/lib/reservations/tokens.mjs`; raw tokens must not be logged or persisted.

- [x] **Step 7: Write repository security and state tests**

Test that reservation creation rejects inactive/unknown farm or slot and over-limit guests; decisions reject expired, consumed, and wrong tokens and cannot decide a non-pending request; concurrent approval/rejection attempts result in exactly one transition; ticket lookup returns the five permitted fields only and only for approved, unexpired tickets; retry claims are denied unless approved. Use injected Supabase fakes to assert exact `.select()` fields and mutation/RPC arguments.

- [x] **Step 8: Implement server clients and repository functions**

Implement the exact signatures in the Interfaces block. Use the public client only for active farm/time-slot reads and the `server-only` client for writes, decisions, ticket lookup, and retries. Return Supabase errors explicitly; never convert query failures into empty farm lists or successful reservation results.

- [x] **Step 9: Run focused tests and lint**

Run: `npm test -- tests/reservations && npm run lint`
Expected: all validation, token, repository tests pass; ESLint reports no new errors.

---

### Task 3: Add reservation, approval, ticket, and email endpoints

**Files:**
- Create: `src/lib/email/client.mjs`
- Create: `src/lib/email/templates.mjs`
- Create: `src/lib/reservations/workflow.mjs`
- Create: `src/lib/reservations/http.mjs`
- Create: `src/app/api/reservations/route.js`
- Create: `src/app/api/reservation-action/route.js`
- Create: `src/app/api/ticket-email-retry/route.js`
- Create: `tests/reservations/workflow.test.mjs`
- Create: `tests/api/reservations.test.mjs`
- Create: `tests/api/reservation-action.test.mjs`
- Create: `tests/api/ticket-email-retry.test.mjs`

**Interfaces:**
- `createEmailClient() -> Resend`: server-only and validates the three Resend/admin sender configuration values.
- `sendAdminReservationEmail(reservation, { actionUrl, retryUrl }, emailClient) -> Promise<void>`.
- `sendVisitorStatusEmail(reservation, status, { ticketUrl, qrDataUrl }, emailClient) -> Promise<void>`.
- `submitReservation(input, deps) -> Promise<{ reference, notificationSent }>`: dependencies are injected repository, email client, token generator, and clock.
- `handleReservationDecision({ token, decision }, deps) -> Promise<{ status, visitorEmailSent }>`: approve creates a ticket token and sends a QR ticket; reject sends a status email.
- `retryVisitorTicketEmail({ token }, deps) -> Promise<void>`: retries only an approved ticket and rotates its QR token before sending, so raw ticket tokens never need to be persisted.
- `postReservation(request, deps) -> Promise<Response>`, `postReservationAction(request, deps) -> Promise<Response>`, and `postTicketEmailRetry(request, deps) -> Promise<Response>`: framework-independent HTTP handlers used by the thin Next.js Route Handler files and directly testable with Node.
- `POST /api/reservations` accepts JSON and returns 201 on successful persistence and admin notification; if persistence succeeds but the admin email fails, return a non-success status with `saved: true` and a non-PII reservation reference.
- `POST /api/reservation-action` accepts form data with `token` and `decision` (`approve` or `reject`); it redirects to a result page and never mutates on GET.
- `POST /api/ticket-email-retry` accepts form data with the opaque retry token and redirects with explicit success/failure status.
- Ticket-email retry tokens expire after 7 days and may claim a retry no more often than once per minute. A retry rotates the stored ticket-token hash and generates a new QR URL before each delivery attempt.

- [x] **Step 1: Write workflow tests with injected dependencies**

Add tests `savesPendingRequestBeforeNotifyingAdmin`, `surfacesAdminEmailFailureWithSavedReference`, `approvesOnceThenSendsTicket`, `rejectsOnceThenSendsVisitorStatus`, `preservesApprovalWhenVisitorEmailFails`, and `retriesTicketWithoutChangingApproval`. Assert send order, reservation state, opaque token use, and that failures are returned rather than swallowed.

- [x] **Step 2: Run workflow tests and verify they fail**

Run: `npm test -- tests/reservations/workflow.test.mjs`
Expected: tests fail because the workflow functions are not implemented.

- [x] **Step 3: Implement Resend messages and QR creation**

Implement the mailer and templates in `src/lib/email/`. Generate the ticket QR as a PNG data URL with `qrcode` for `APP_BASE_URL/ticket/<opaque-token>`; include no contact details in the QR target. Include distinct approve/reject action forms and a separate retry form in the administrator email. Keep email text useful if an HTML part or image is unavailable.

- [x] **Step 4: Implement `submitReservation`, `handleReservationDecision`, and `retryVisitorTicketEmail`**

Implement the workflow interfaces above. Persist pending state before sending mail. Approval and rejection use only the atomic RPC; create/store the ticket token hash during approval. A visitor-mail failure leaves the approved/rejected state intact and returns an explicit failure. Ticket retry is allowed only by the scoped retry token and approved status; rotate the ticket-token hash before sending so raw tokens are never persisted, without changing reservation status.

- [x] **Step 5: Write API tests and verify they fail**

Test the functions in `src/lib/reservations/http.mjs` for malformed JSON, invalid form values, honeypot/origin abuse checks, oversized payloads, success, and persisted-but-email-failed response; test approval handler rejects GET mutations and invalid/replayed tokens; test retry handler rejects pending reservations and invalid tokens. Mock Supabase and Resend; assert no raw token or visitor contact fields appear in error responses.

Run: `npm test -- tests/api`
Expected: endpoint tests fail because the HTTP handlers are not implemented.

- [x] **Step 6: Implement the three Route Handlers**

Use the Next.js 16 App Router `route.js` Web Request/Response APIs as thin wrappers around `src/lib/reservations/http.mjs`. Apply a 32 KB request-body limit, same-origin validation, honeypot rejection, and server-side field validation before service-role operations. Return actionable status codes without including secrets or Supabase internals. GET requests must never change reservation status.

- [x] **Step 7: Run endpoint and workflow tests**

Run: `npm test -- tests/reservations/workflow.test.mjs tests/api`
Expected: all endpoint and workflow tests pass.

---

### Task 4: Build visitor and administrator pages, then verify the full app

**Files:**
- Create: `src/app/reservation/page.js`
- Create: `src/app/reservation/ReservationForm.js`
- Create: `src/app/reservation/reservation.module.css`
- Create: `src/app/reservation/action/page.js`
- Create: `src/app/reservation/action/result/page.js`
- Create: `src/app/reservation/ticket-email/page.js`
- Create: `src/app/ticket/[token]/page.js`
- Create: `src/lib/reservations/views.mjs`
- Create: `tests/app/reservation-view.test.mjs`
- Modify: `src/app/farm/page.js`
- Modify: `src/app/page.js`
- Modify: `src/app/layout.js`
- Modify: `README.md`

**Interfaces:**
- `/farm` server-renders active farms from `getActiveFarms` and links each farm to `/reservation?farmId=<uuid>`.
- `/reservation` server-loads active farms and their active time slots; `ReservationForm` receives serializable farm/slot data and submits JSON to `/api/reservations`.
- `/reservation/action?token=...&decision=...` renders a confirmation form only; the form POSTs to `/api/reservation-action`.
- `/reservation/action/result` distinguishes approved/rejected, saved-but-mail-failed, and invalid/expired outcomes without displaying tokens.
- `/reservation/ticket-email?token=...` renders the retry form only; the form POSTs to `/api/ticket-email-retry`.
- `/ticket/[token]` resolves the opaque ticket server-side and displays farm, date, slot, guest count, and approved status only; invalid, pending, or rejected tickets show a generic unavailable message.
- `buildReservationOutcomeView(result) -> ReservationOutcomeView` and `buildTicketView(ticket) -> TicketView | null` in `src/lib/reservations/views.mjs` keep the tested page view data separate from Next.js rendering.

- [x] **Step 1: Write page-level tests for response states**

Add tests for `buildReservationOutcomeView` mapping reservation success and saved-but-not-notified state; test `buildTicketView` maps only the allowed farm/date/slot/guest-count/status fields and returns `null` for unavailable tickets. Test the farm/slot loading view model for active records and an empty catalog. Do not add a browser-test framework solely for static markup.

- [x] **Step 2: Run the tests and verify the new page states fail**

Run: `npm test -- tests/app`
Expected: page-view tests fail because the page data/view modules do not exist yet.

- [x] **Step 3: Implement the form, farm listing, approval, retry, and ticket pages**

Use server components for Supabase reads and keep the interactive reservation form isolated in `ReservationForm.js`. Call `connection()` before database reads in build-prerenderable pages so a production build does not require live credentials. Render an explicit setup notice only for missing configuration; let actual Supabase failures surface. Include field-level errors, pending submission state, a clear saved-but-not-notified message with the reservation reference, and no success-shaped fallback for failed reads or writes. Render all visitor-facing dates/times in `Asia/Manila`.

- [x] **Step 4: Update navigation and metadata**

Change the existing reservation navigation link in `src/app/page.js` to `/reservation`; keep the Farms link at `/farm`. Update the root metadata in `src/app/layout.js` to Sagana Farm and use descriptive page metadata for reservation and ticket routes.

- [x] **Step 5: Run all tests, lint, and production build**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass, ESLint passes, and Next.js completes a production build. With no Supabase or Resend credentials, a build must still succeed; runtime pages and actions must show explicit configuration errors rather than fabricated data.

- [x] **Step 6: Finish README deployment instructions**

Document migration application, adding active farms and time slots in Supabase, setting each environment variable, verifying the Resend sender, and deploying before sending real reservations. State that availability/capacity is manually reviewed and that public ticket URLs are bearer links.

### Final review fix-pass (2026-11-13)

- Added an atomic approval guard for visits whose ticket-validity window has
  already expired and surfaced that result to the visitor.
- Added hashed IP and normalized-email rate limits at the user-selected
  thresholds, plus `RATE_LIMIT_SECRET` and trusted-proxy requirements.
- A disposable Supabase CLI stack applied the full migration. Integration tests
  verified RLS, token outcomes, ticket expiry, concurrent approval/rejection,
  concurrent rate limits, and service-role-only RPC access. These tests failed
  against a temporary migration missing the expiration guard and limiter table.
- Node 20.13.1 runtime testing showed the pinned Supabase SDK also requires an
  explicit WebSocket transport in Node 20. Added `ws` through a shared client
  factory and a focused runtime test.
- Final checks: `npm test` (49 passed, 5 database integration tests skipped
  without local credentials), `npm run test:integration` (5 passed against local
  Supabase), `npm run lint`, and `npm run build`.
- The local stack was stopped. Hosted Supabase migration and Resend delivery
  were not tested because no hosted credentials were supplied.
