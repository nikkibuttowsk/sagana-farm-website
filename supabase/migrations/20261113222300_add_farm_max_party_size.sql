alter table public.farms
  add column if not exists max_party_size integer;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.farms'::regclass
      and conname = 'farms_max_party_size_check'
  ) then
    alter table public.farms
      add constraint farms_max_party_size_check
      check (max_party_size is null or max_party_size > 0);
  end if;
end;
$migration$;
