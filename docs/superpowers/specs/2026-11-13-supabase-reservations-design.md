# Supabase Reservations Design

## Intent

Connect the Sagana Farm Next.js website to Supabase so visitors can view
available farms and request a visit reservation. The farm administrator reviews
each request from email. Only approved reservations receive an emailed ticket
with a unique QR code.

## Goals

- Read active farm information from Supabase for the reservation flow.
- Save visitor name, email, phone, guest count, requested date, and time slot
  with the selected farm.
- Keep each new reservation pending until the administrator approves or
  rejects it through a secure email action.
- Send a notification to the administrator for each new request.
- On approval, send the visitor a ticket with a unique QR code; on rejection,
  send a status email.
- Keep credentials and reservation writes on the server and protect visitor
  information from public database access.

## Non-goals

- An authenticated administrator dashboard or visitor accounts.
- Automatic slot availability, visit-date capacity, or duplicate-slot
  enforcement. The administrator checks these while reviewing requests.
- Farm check-in management, cancellations, payment collection, or analytics.
- Sending a ticket before approval.

## Constraints and calls

- Keep the existing Next.js App Router structure.
- Supabase is the source of truth for active farms and reservations.
- Farm time-slot choices are configured per farm in Supabase. Dates and times
  use the `Asia/Manila` timezone.
- Use a server-only Supabase client for reservation mutations. The service-role
  key must never be exposed to browser code; public clients must not be able to
  read or change reservation records.
- Enable row-level security. Public farm reads are limited to active farms;
  reservations and approval data are not publicly readable or writable.
- Validate and constrain all submitted fields server-side. Add basic abuse
  protection to the public reservation endpoint.
- Generate high-entropy, opaque approval and ticket tokens. Store only token
  hashes in Supabase, expire and consume approval tokens once, and do not put
  personal information in QR payloads.
- A QR code opens a ticket lookup page that reveals only the minimum arrival
  information (farm, date, time slot, guest count, and reservation status).
- Guest count must be a positive whole number. A farm may optionally configure
  a per-reservation maximum; this does not represent slot capacity or guarantee
  availability.
- Configure credentials through environment variables and provide an
  `.env.example` with names only. Do not commit credentials or request them in
  chat.
- Use Resend for transactional email, configurable with environment variables.
  Delivery failures must be surfaced explicitly; a failed email must not be
  represented as a successful notification.
- Farm records and the administrator email are configured outside the
  visitor-facing application, using Supabase and environment configuration.

## Approaches considered

1. **Secure email action links (selected):** The administrator approves or
   rejects from a short-lived, one-time link in the request notification. This
   fits the current email-based workflow and avoids an admin portal. The
   mailbox is the authorization boundary, so links must be opaque, hashed at
   rest, expiring, and consumed once.
2. **Authenticated admin page:** An administrator signs in and manages
   requests in the website with authenticated authorization and database
   policies. This offers a stronger explicit account boundary and room for
   future management features, but adds auth, role provisioning, and a
   dashboard beyond the requested workflow.

## Proposed flow

1. The visitor selects an active farm and supplies their name, email, phone,
   guest count, visit date, and a time slot.
2. The Next.js server validates the request, saves a pending reservation, and
   sends the administrator an email with separate approve and reject actions.
   The action page must not change state on a GET request; a deliberate
   confirmation submits the action.
3. Approval or rejection is allowed only while the matching action token is
   valid, unused, and unexpired, and the reservation is still pending.
4. On approval, the reservation becomes approved and the visitor receives a
   ticket email containing a QR code with an opaque ticket URL. On rejection,
   the reservation becomes rejected and the visitor receives a status email.
5. Scanning the QR opens a page that resolves the opaque ticket token and
   displays only the arrival information listed above.

## Data and security shape

- `farms`: farm name and visitor-facing details, active flag, optional
  per-reservation guest maximum, and timestamps.
- `farm_time_slots`: active time-slot labels and ordering for each farm.
- `reservations`: farm reference, visitor contact fields, guest count, requested
  date/time slot reference, status, timestamps, and hashes/expiry/consumption
  metadata needed for approval and ticket tokens.
- Use database constraints for required fields, valid guest counts, valid
  statuses, and foreign keys. Do not expose reservation rows through anonymous
  Supabase access.
- Any public route that uses the service-role key must validate input and
  enforce the same authorization/state rules itself.
- Approval and ticket tokens are bearer secrets. Do not log them or include
  them in third-party analytics. The ticket lookup must never return contact
  information.
- Keep raw tokens only long enough to send their links. When retrying a ticket
  email, rotate the ticket token and stored hash before sending; do not persist
  the raw token.

## Configuration and delivery

Provide a migration for the schema and row-level security policies, and
document the required environment variables: Supabase URL and public key,
server-only service-role key, Resend API key, administrator email, verified
sender email, and public application URL. No live Supabase project or provider
credentials were supplied, so deployment remains dependent on configuring
those values and adding farm and time-slot records.

Email sends happen after the reservation state is persisted. If delivery fails,
show an explicit error and preserve the reservation state; do not claim the
email was sent. If the administrator notification fails after saving a
request, tell the visitor it was saved but not delivered, show its reference,
and advise them not to submit again; they can contact the farm. Provide a safe
way for the administrator to retry a failed visitor ticket email without
approving the reservation a second time.
