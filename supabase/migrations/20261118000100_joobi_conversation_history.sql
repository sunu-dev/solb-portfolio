-- Personal conversation archive; separate from optional operator quality-review cases.
begin;
create table public.joobi_conversation_history (
  id uuid primary key,
  seq bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  context text,
  answer jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint joobi_history_shape check (coalesce((
    (deleted_at is not null and answer is null and context is null)
    or (deleted_at is null and context is not null and length(context) between 1 and 100
      and answer is not null and jsonb_typeof(answer) = 'object' and octet_length(answer::text) <= 32000
      and answer ?& array['question','symbol','currentStatus','keyAdvice','conclusion']
      and jsonb_typeof(answer->'question') = 'string' and length(answer->>'question') <= 600
      and jsonb_typeof(answer->'symbol') = 'string' and length(answer->>'symbol') <= 40
      and jsonb_typeof(answer->'currentStatus') = 'string' and length(answer->>'currentStatus') <= 12000
      and jsonb_typeof(answer->'keyAdvice') = 'array'
      and jsonb_typeof(answer->'conclusion'->'desc') = 'string')
  ), false))
);
create index joobi_history_owner_seq on public.joobi_conversation_history(user_id, seq desc) where deleted_at is null;
create index joobi_history_owner_context on public.joobi_conversation_history(user_id, context, seq desc) where deleted_at is null;
alter table public.joobi_conversation_history enable row level security;
revoke all on public.joobi_conversation_history from public, anon, authenticated;
grant select on public.joobi_conversation_history to authenticated;
create policy joobi_history_owner_read on public.joobi_conversation_history for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
-- Writes are immutable and idempotent. Deleted UUIDs stay as content-free tombstones
-- until account deletion, so a delayed retry cannot resurrect erased text.
create function public.save_joobi_conversation(p_owner uuid, p_id uuid, p_context text, p_answer jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); existing_owner uuid; removed timestamptz;
begin
  if owner_id is null or p_owner is null or p_owner <> owner_id then raise exception 'authentication_required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 1811));
  select user_id, deleted_at into existing_owner, removed from public.joobi_conversation_history where id = p_id;
  if found then
    if existing_owner <> owner_id then raise exception 'owner_required' using errcode = '42501'; end if;
    return removed is null;
  end if;
  if (select count(*) from public.joobi_conversation_history where user_id = owner_id and deleted_at is null) >= 1000 then
    raise exception 'history_limit' using errcode = '23514';
  end if;
  insert into public.joobi_conversation_history(id,user_id,context,answer) values(p_id,owner_id,p_context,p_answer);
  return true;
end;
$$;
create function public.delete_joobi_conversations(p_owner uuid, p_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null or p_owner is null or p_owner <> owner_id then raise exception 'authentication_required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 1811));
  update public.joobi_conversation_history set answer = null, context = null, deleted_at = pg_catalog.clock_timestamp()
    where user_id = owner_id and deleted_at is null and (p_id is null or id = p_id);
end;
$$;
revoke all on function public.save_joobi_conversation(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.delete_joobi_conversations(uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_joobi_conversation(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.delete_joobi_conversations(uuid,uuid) to authenticated;
commit;
