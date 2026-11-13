alter table public.reservations
  add column if not exists time_slot_id uuid,
  add column if not exists admin_action_token_hash text,
  add column if not exists admin_action_expires_at timestamptz,
  add column if not exists admin_action_used_at timestamptz,
  add column if not exists ticket_token_hash text,
  add column if not exists ticket_expires_at timestamptz,
  add column if not exists ticket_email_retry_token_hash text,
  add column if not exists ticket_email_retry_expires_at timestamptz,
  add column if not exists last_ticket_email_attempt_at timestamptz,
  add column if not exists admin_email_sent_at timestamptz,
  add column if not exists visitor_email_sent_at timestamptz,
  add column if not exists approved_at timestamptz;

alter table public.reservations
  alter column time_slot drop not null,
  alter column status set default 'pending';

alter table public.reservations
  drop constraint if exists reservations_status_check;

alter table public.reservations
  add constraint reservations_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'approved', 'rejected'));

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_farm_slot_fkey'
  ) then
    alter table public.reservations
      add constraint reservations_farm_slot_fkey
      foreign key (time_slot_id, farm_id)
      references public.farm_time_slots(id, farm_id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_admin_action_token_hash_check'
  ) then
    alter table public.reservations
      add constraint reservations_admin_action_token_hash_check
      check (
        admin_action_token_hash is null
        or admin_action_token_hash ~ '^[0-9a-f]{64}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_ticket_token_hash_check'
  ) then
    alter table public.reservations
      add constraint reservations_ticket_token_hash_check
      check (ticket_token_hash is null or ticket_token_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_ticket_email_retry_token_hash_check'
  ) then
    alter table public.reservations
      add constraint reservations_ticket_email_retry_token_hash_check
      check (
        ticket_email_retry_token_hash is null
        or ticket_email_retry_token_hash ~ '^[0-9a-f]{64}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_approval_ticket_state_check'
  ) then
    alter table public.reservations
      add constraint reservations_approval_ticket_state_check
      check (
        (
          status = 'approved'
          and ticket_token_hash is not null
          and ticket_expires_at is not null
          and approved_at is not null
        )
        or
        (
          status <> 'approved'
          and ticket_token_hash is null
          and ticket_expires_at is null
          and approved_at is null
        )
      );
  end if;
end;
$migration$;

create unique index if not exists reservations_admin_action_token_hash_uidx
  on public.reservations (admin_action_token_hash)
  where admin_action_token_hash is not null;
create unique index if not exists reservations_ticket_token_hash_uidx
  on public.reservations (ticket_token_hash)
  where ticket_token_hash is not null;
create unique index if not exists reservations_ticket_email_retry_token_hash_uidx
  on public.reservations (ticket_email_retry_token_hash)
  where ticket_email_retry_token_hash is not null;
create index if not exists reservations_status_created_at_idx
  on public.reservations (status, created_at desc);
create index if not exists reservations_visit_date_idx
  on public.reservations (visit_date);

create table if not exists public.reservation_submission_limits (
  scope text not null check (scope in ('ip', 'email')),
  identifier_hash text not null
    check (identifier_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, identifier_hash)
);

create index if not exists reservation_submission_limits_expires_at_idx
  on public.reservation_submission_limits (expires_at);

alter table public.reservations enable row level security;
alter table public.reservation_submission_limits enable row level security;

drop policy if exists "Allow public read access to reservations"
  on public.reservations;
drop policy if exists "Anyone can create a reservation"
  on public.reservations;
drop policy if exists "visitors can create pending reservations"
  on public.reservations;

revoke all on public.reservations from public, anon, authenticated;
grant all on public.reservations to service_role;

revoke all on public.reservation_submission_limits
  from public, anon, authenticated;
grant all on public.reservation_submission_limits to service_role;

create or replace function public.decide_reservation_action(
  p_action_token_hash text,
  p_decision text,
  p_ticket_token_hash text
)
returns table (
  ok boolean,
  reason text,
  reservation_id uuid,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  farm_name text,
  time_slot_label text,
  guest_count integer,
  visit_date date,
  status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reservation public.reservations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;

  if p_decision = 'approve'
    and (p_ticket_token_hash is null or p_ticket_token_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid ticket token hash' using errcode = '22023';
  end if;

  select r.*
    into v_reservation
  from public.reservations as r
  where r.admin_action_token_hash = p_action_token_hash
  for update;

  if not found then
    return query select false, 'invalid'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::integer, null::date, null::text;
    return;
  end if;

  if v_reservation.admin_action_expires_at <= now() then
    return query select false, 'expired'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::integer, null::date, null::text;
    return;
  end if;

  if v_reservation.admin_action_used_at is not null then
    return query select false, 'used'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::integer, null::date, null::text;
    return;
  end if;

  if v_reservation.status <> 'pending' then
    return query select false, 'not_pending'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::integer, null::date, null::text;
    return;
  end if;

  if p_decision = 'approve'
    and ((v_reservation.visit_date + 2)::timestamp at time zone 'Asia/Manila') <= now() then
    return query select false, 'ticket_expired'::text, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::integer, null::date, null::text;
    return;
  end if;

  update public.reservations as r
  set status = case p_decision
        when 'approve' then 'approved'
        else 'rejected'
      end,
      admin_action_used_at = now(),
      ticket_token_hash = case
        when p_decision = 'approve' then p_ticket_token_hash
        else null
      end,
      ticket_expires_at = case
        when p_decision = 'approve'
          then ((v_reservation.visit_date + 2)::timestamp at time zone 'Asia/Manila')
        else null
      end,
      approved_at = case
        when p_decision = 'approve' then now()
        else null
      end
  where r.id = v_reservation.id;

  return query
    select true, null::text, r.id, r.visitor_name, r.visitor_email, r.visitor_phone,
      f.name, s.label, r.guest_count, r.visit_date, r.status
    from public.reservations as r
    join public.farms as f on f.id = r.farm_id
    join public.farm_time_slots as s on s.id = r.time_slot_id
    where r.id = v_reservation.id;
end;
$function$;

create or replace function public.claim_ticket_email_retry(
  p_retry_token_hash text,
  p_replacement_ticket_token_hash text
)
returns table (
  reservation_id uuid,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  farm_name text,
  time_slot_label text,
  guest_count integer,
  visit_date date,
  status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reservation_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_replacement_ticket_token_hash is null
    or p_replacement_ticket_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ticket token hash' using errcode = '22023';
  end if;

  update public.reservations as r
  set ticket_token_hash = p_replacement_ticket_token_hash,
      ticket_expires_at = ((r.visit_date + 2)::timestamp at time zone 'Asia/Manila'),
      last_ticket_email_attempt_at = now()
  where r.ticket_email_retry_token_hash = p_retry_token_hash
    and r.ticket_email_retry_expires_at > now()
    and r.status = 'approved'
    and r.ticket_expires_at > now()
    and (
      r.last_ticket_email_attempt_at is null
      or r.last_ticket_email_attempt_at <= now() - interval '1 minute'
    )
  returning r.id into v_reservation_id;

  if not found then
    return;
  end if;

  return query
    select r.id, r.visitor_name, r.visitor_email, r.visitor_phone, f.name, s.label,
      r.guest_count, r.visit_date, r.status
    from public.reservations as r
    join public.farms as f on f.id = r.farm_id
    join public.farm_time_slots as s on s.id = r.time_slot_id
    where r.id = v_reservation_id;
end;
$function$;

create or replace function public.claim_reservation_submission_rate_limit(
  p_ip_hash text,
  p_email_hash text
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ip_count integer;
  v_ip_expires_at timestamptz;
  v_email_count integer;
  v_email_expires_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit identifier' using errcode = '22023';
  end if;

  delete from public.reservation_submission_limits
  where expires_at <= now();

  insert into public.reservation_submission_limits as limits (
    scope,
    identifier_hash,
    window_started_at,
    request_count,
    expires_at
  )
  values ('ip', p_ip_hash, now(), 1, now() + interval '15 minutes')
  on conflict (scope, identifier_hash) do update
  set window_started_at = case
        when limits.window_started_at <= now() - interval '15 minutes'
          then now()
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= now() - interval '15 minutes'
          then 1
        else limits.request_count + 1
      end,
      expires_at = case
        when limits.window_started_at <= now() - interval '15 minutes'
          then now() + interval '15 minutes'
        else limits.expires_at
      end
  returning request_count, expires_at
  into v_ip_count, v_ip_expires_at;

  if v_ip_count > 5 then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_ip_expires_at - now())))::integer);
    return;
  end if;

  insert into public.reservation_submission_limits as limits (
    scope,
    identifier_hash,
    window_started_at,
    request_count,
    expires_at
  )
  values ('email', p_email_hash, now(), 1, now() + interval '1 day')
  on conflict (scope, identifier_hash) do update
  set window_started_at = case
        when limits.window_started_at <= now() - interval '1 day'
          then now()
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= now() - interval '1 day'
          then 1
        else limits.request_count + 1
      end,
      expires_at = case
        when limits.window_started_at <= now() - interval '1 day'
          then now() + interval '1 day'
        else limits.expires_at
      end
  returning request_count, expires_at
  into v_email_count, v_email_expires_at;

  if v_email_count > 3 then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_email_expires_at - now())))::integer);
    return;
  end if;

  return query select true, null::integer;
end;
$function$;

revoke all on function public.decide_reservation_action(text, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_ticket_email_retry(text, text)
  from public, anon, authenticated;
revoke all on function public.claim_reservation_submission_rate_limit(text, text)
  from public, anon, authenticated;

grant execute on function public.decide_reservation_action(text, text, text)
  to service_role;
grant execute on function public.claim_ticket_email_retry(text, text)
  to service_role;
grant execute on function public.claim_reservation_submission_rate_limit(text, text)
  to service_role;

notify pgrst, 'reload schema';
