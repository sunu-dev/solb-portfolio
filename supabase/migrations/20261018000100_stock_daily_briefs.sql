begin;
create table if not exists public.stock_daily_briefs (symbol text primary key, payload jsonb not null, updated_at timestamptz not null default now());
alter table public.stock_daily_briefs enable row level security;
revoke all on public.stock_daily_briefs from anon, authenticated;
grant select,insert,update,delete on public.stock_daily_briefs to service_role;
create table if not exists public.stock_daily_brief_lock (id boolean primary key default true check(id), owner uuid, expires_at timestamptz not null default now());
alter table public.stock_daily_brief_lock enable row level security;
revoke all on public.stock_daily_brief_lock from anon, authenticated;
insert into public.stock_daily_brief_lock(id) values(true) on conflict do nothing;
create or replace function public.claim_stock_daily_brief(p_owner uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update stock_daily_brief_lock set owner=p_owner,expires_at=now()+interval '5 minutes' where id=true and expires_at<=now();
 return found;
end; $$;
create or replace function public.publish_stock_daily_brief(p_owner uuid,p_briefs jsonb) returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform 1 from stock_daily_brief_lock where id=true and owner=p_owner and expires_at>now() for update;
 if not found then return false; end if;
 insert into stock_daily_briefs(symbol,payload,updated_at) select item->>'symbol',item,now() from jsonb_array_elements(p_briefs) item
 on conflict(symbol) do update set payload=excluded.payload,updated_at=excluded.updated_at
 where (excluded.payload->'quote'->>'at')::timestamptz >= (stock_daily_briefs.payload->'quote'->>'at')::timestamptz;
 update stock_daily_brief_lock set expires_at=now() where id=true and owner=p_owner;
 return true;
end; $$;
revoke all on function public.claim_stock_daily_brief(uuid) from public,anon,authenticated;
revoke all on function public.publish_stock_daily_brief(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_stock_daily_brief(uuid) to service_role;
grant execute on function public.publish_stock_daily_brief(uuid,jsonb) to service_role;
commit;
