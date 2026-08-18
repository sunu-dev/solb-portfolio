-- 여러 탭·기기에서 오래된 포트폴리오가 최신 기록을 조용히 덮지 않도록
-- 마지막으로 읽은 updated_at이 아직 같을 때만 원자적으로 저장한다.
create or replace function public.save_user_portfolio_if_current(
  p_stocks jsonb,
  p_daily_snapshots jsonb,
  p_portfolio_history jsonb,
  p_expected_updated_at timestamptz
)
returns table(save_status text, saved_updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_expected_updated_at is null then
    insert into public.user_portfolios (
      user_id,
      stocks,
      daily_snapshots,
      portfolio_history,
      updated_at
    )
    values (
      v_user_id,
      coalesce(p_stocks, '[]'::jsonb),
      coalesce(p_daily_snapshots, '[]'::jsonb),
      coalesce(p_portfolio_history, '[]'::jsonb),
      clock_timestamp()
    )
    on conflict (user_id) do nothing
    returning updated_at into v_saved_at;
  else
    update public.user_portfolios
    set
      stocks = coalesce(p_stocks, '[]'::jsonb),
      daily_snapshots = coalesce(p_daily_snapshots, '[]'::jsonb),
      portfolio_history = coalesce(p_portfolio_history, '[]'::jsonb),
      updated_at = clock_timestamp()
    where user_id = v_user_id
      and updated_at = p_expected_updated_at
    returning updated_at into v_saved_at;
  end if;

  if v_saved_at is null then
    return query
      select 'conflict'::text, up.updated_at
      from public.user_portfolios up
      where up.user_id = v_user_id;
    return;
  end if;

  return query select 'ok'::text, v_saved_at;
end;
$$;

revoke all on function public.save_user_portfolio_if_current(jsonb, jsonb, jsonb, timestamptz)
  from public, anon;
grant execute on function public.save_user_portfolio_if_current(jsonb, jsonb, jsonb, timestamptz)
  to authenticated;

comment on function public.save_user_portfolio_if_current(jsonb, jsonb, jsonb, timestamptz) is
  '마지막으로 읽은 updated_at과 같을 때만 포트폴리오·스냅샷·복구 이력을 함께 저장';
