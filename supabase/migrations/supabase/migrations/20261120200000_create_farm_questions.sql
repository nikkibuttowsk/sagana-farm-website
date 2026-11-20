create table if not exists public.farm_questions (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms(id) on delete cascade,
    question text not null check (char_length(question) between 5 and 300),
    visitor_email text check (visitor_email is null or char_length(visitor_email) <= 254),
    status text not null default 'pending' check (status in ('pending', 'answered')),
    admin_answer text,
    created_at timestamptz not null default now()
);

create index if not exists farm_questions_farm_id_idx
    on public.farm_questions (farm_id, created_at desc);

alter table public.farm_questions enable row level security;