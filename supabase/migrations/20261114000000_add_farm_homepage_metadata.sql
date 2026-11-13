alter table public.farms
  add column if not exists province text not null default '',
  add column if not exists category text not null default '',
  add column if not exists crops text[] not null default '{}',
  add column if not exists headline text,
  add column if not exists news_summary text,
  add column if not exists is_trending boolean not null default false,
  add column if not exists images text[] not null default '{}',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
