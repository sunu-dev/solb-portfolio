-- CAS 저장이 클라이언트가 의도한 사용자와 현재 인증 사용자가 같은지 DB에서도 검증한다.
-- 계정 전환 race에서 A의 pending payload가 B의 auth.uid()로 저장되는 것을 이중 차단한다.
-- 구버전 앱의 진행 중 요청을 끊지 않기 위해 기존 함수는 전환 기간 동안 유지한다.
create or replace function public.save_user_portfolio_if_current_v2(
  p_user_id uuid,
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
  v_auth_user_id uuid := auth.uid();
  v_saved_at timestamptz;
begin
  if v_auth_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_auth_user_id <> p_user_id then
    raise exception 'portfolio owner mismatch' using errcode = '42501';
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
      p_user_id,
      coalesce(p_stocks, '{}'::jsonb),
      coalesce(p_daily_snapshots, '[]'::jsonb),
      coalesce(p_portfolio_history, '[]'::jsonb),
      clock_timestamp()
    )
    on conflict (user_id) do nothing
    returning updated_at into v_saved_at;
  else
    update public.user_portfolios
    set
      stocks = coalesce(p_stocks, '{}'::jsonb),
      daily_snapshots = coalesce(p_daily_snapshots, '[]'::jsonb),
      portfolio_history = coalesce(p_portfolio_history, '[]'::jsonb),
      updated_at = clock_timestamp()
    where user_id = p_user_id
      and updated_at = p_expected_updated_at
    returning updated_at into v_saved_at;
  end if;

  if v_saved_at is null then
    return query
      select 'conflict'::text, up.updated_at
      from public.user_portfolios up
      where up.user_id = p_user_id;
    return;
  end if;

  return query select 'ok'::text, v_saved_at;
end;
$$;

revoke all on function public.save_user_portfolio_if_current_v2(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  timestamptz
) from public, anon;
grant execute on function public.save_user_portfolio_if_current_v2(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  timestamptz
) to authenticated;

comment on function public.save_user_portfolio_if_current_v2(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  timestamptz
) is
  '인증 사용자와 명시적 owner가 같고 마지막 updated_at도 같을 때만 포트폴리오 전체를 원자 저장';
