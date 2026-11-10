-- Optional saved terms and notes, scoped to the authenticated owner. No portfolio or AI question log.
begin;
create table if not exists public.personal_dictionary (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  entry jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint personal_dictionary_entry_shape check (
    jsonb_typeof(entry) = 'object' and octet_length(entry::text) <= 8000
    and entry ?& array['id','title','note','savedAt','familiarity']
    and jsonb_typeof(entry->'id') = 'string' and entry->>'id' = id
    and jsonb_typeof(entry->'title') = 'string' and length(entry->>'title') between 1 and 160
    and jsonb_typeof(entry->'note') = 'string' and length(entry->>'note') <= 900
    and jsonb_typeof(entry->'savedAt') = 'string' and length(entry->>'savedAt') <= 30
    and entry->>'familiarity' in ('new','confused','familiar')
  )
);
alter table public.personal_dictionary enable row level security;
revoke all on public.personal_dictionary from public, anon, authenticated;
grant select, insert, update, delete on public.personal_dictionary to authenticated;
drop policy if exists personal_dictionary_owner on public.personal_dictionary;
create policy personal_dictionary_owner on public.personal_dictionary for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create or replace function public.guard_personal_dictionary() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.user_id is distinct from auth.uid() then raise exception 'dictionary_owner_required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 4121));
  if tg_op = 'INSERT' then
    if (select count(*) from public.personal_dictionary where user_id = new.user_id) >= 300 then
      raise exception 'dictionary_limit' using errcode = '23514';
    end if;
    new.revision := 1;
  else
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id then raise exception 'dictionary_identity_immutable' using errcode = '23514'; end if;
    new.revision := old.revision + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.guard_personal_dictionary() from public, anon, authenticated;
drop trigger if exists personal_dictionary_guard on public.personal_dictionary;
create trigger personal_dictionary_guard before insert or update on public.personal_dictionary for each row execute function public.guard_personal_dictionary();
commit;
