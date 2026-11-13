# Sagana Farm

Sagana Farm is a Next.js website with a Supabase-backed farm visit reservation
flow. Visitors choose an active farm and time slot, submit their contact details
and guest count, and wait for administrator review. The administrator receives
an email with expiring approval/rejection links. Approved reservations receive
a QR ticket by email; rejected requests receive a status email.

Farm availability and capacity are reviewed manually by the administrator.
Time-slot labels are configured per farm in Supabase and use the
`Asia/Manila` timezone.

## Requirements

- Node.js 20 or newer
- A Supabase project
- A Brevo account, API key, and verified sender address

## Local setup

Install dependencies and start the development server:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

In Supabase, apply every SQL file in `supabase/migrations/` in filename order
using the SQL Editor or your normal migration workflow. Add farm rows to
`farms`, then add each farm's visitor-facing time-slot labels to
`farm_time_slots`. Mark records `is_active = true` when they should appear on
the site. Optional `max_party_size` limits one reservation request; it is not
a slot-capacity setting.

Fill in `.env.local` with values from Supabase Project Settings and Brevo:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key; server-only |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `FARM_ADMIN_EMAIL` | Address that receives reservation requests |
| `RESERVATION_FROM_EMAIL` | Verified sender address in Brevo |
| `APP_BASE_URL` | Public site origin, e.g. `http://localhost:3000` locally |
| `RATE_LIMIT_SECRET` | Random server-only secret of at least 32 bytes; generate with `openssl rand -hex 32` |

Never commit `.env.local`, expose the service-role key to browser code, or put
real credentials in documentation or chat.

## Security and reservation behavior

- Supabase row-level security allows public reads of active farms and slots
  only. Reservation rows and approval functions are restricted to the
  server-side service role.
- The server validates submitted fields and enforces the configured per-farm
  guest maximum. A reservation is saved as `pending` before the administrator
  notification is sent.
- The reservation endpoint allows up to five requests per client IP in 15
  minutes and three per normalized email address per day. Only keyed hashes
  are stored, and expired limiter entries are removed during subsequent
  submissions. Configure the hosting proxy to overwrite `X-Forwarded-For`
  with one trusted client IP; requests without a single valid IP are rejected.
- Administrator action links expire after 72 hours and can decide a pending
  reservation only once. The ticket link exposes only farm, date, time slot,
  guest count, and status; it contains no contact details.
- Ticket tokens expire at the end of the visit date plus one day. A
  retry-email link can issue a replacement QR token for an approved
  reservation for up to seven days, no more than once per minute.
- Ticket URLs are bearer links: anyone who has the URL can view the limited
  arrival details. Visitors should keep ticket links private.
- If an administrator notification fails after the request is saved, the site
  reports the saved reservation reference and asks the visitor not to submit
  again. Email delivery failures never imply that the reservation was rolled
  back.

## Checks

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

The database integration tests are skipped unless Supabase test credentials are
provided. To run them against a local Supabase project, initialize and start the
Supabase CLI in the repository, save `supabase status -o env` output to a
temporary file, then run:

```bash
SUPABASE_TEST_STATUS_FILE=/tmp/sagana-supabase-status.env npm run test:integration
```

Stop the local project with `supabase stop` after testing, and do not commit the
status file.

## Deploying

Configure all required environment variables in the hosting provider, use the
production site origin for `APP_BASE_URL`, apply the migration, add active
farms/time slots, and verify the Brevo sender before accepting real
reservations.
