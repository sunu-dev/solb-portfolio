-- 코드 소비·초대 기록·보상을 하나의 트랜잭션으로 처리한다.
-- 서버에서 검증한 사용자만 전달 가능. 브라우저 역할에는 실행 권한이 없다.
create or replace function public.apply_signup_code(p_code text, p_user_id uuid)
returns jsonb
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_code public.codes%rowtype;
  v_use public.code_uses%rowtype;
  v_invited text;
  v_amount integer;
begin
  if p_user_id is null then raise exception 'authentication required'; end if;
  -- 다른 코드로 같은 계정에 동시에 가입 보상을 주는 경우도 직렬화한다.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_code from public.codes
    where code = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('valid', false, 'error', '유효하지 않은 코드예요.'); end if;
  if v_code.type not in ('invite', 'referral') then
    return jsonb_build_object('valid', false, 'error', '가입용 초대 코드가 아니에요.');
  end if;
  select * into v_use from public.code_uses
    where code = v_code.code and used_by = p_user_id limit 1;
  select invited_by_code into v_invited from public.user_portfolios where user_id = p_user_id;
  -- 응답 유실 뒤 재시도는 성공한 기록만 멱등 성공. 구버전 부분 실패는 성공으로 위장하지 않는다.
  if v_use.id is not null then
    if v_use.reward_granted and v_invited = v_code.code then
      return jsonb_build_object('valid', true, 'applied', true, 'type', v_code.type);
    end if;
    return jsonb_build_object('valid', false, 'error', '이전 코드 처리 상태를 확인해야 해요. 운영자에게 문의해주세요.');
  end if;
  if v_invited is not null or exists (
    select 1 from public.code_uses where used_by = p_user_id and context = 'signup'
  ) then return jsonb_build_object('valid', false, 'error', '이미 가입 코드가 등록된 계정이에요.'); end if;
  if v_code.created_by = p_user_id then
    return jsonb_build_object('valid', false, 'error', '본인의 코드는 사용할 수 없어요.');
  end if;
  if not coalesce(v_code.is_active, false) or v_code.expires_at <= now() then
    return jsonb_build_object('valid', false, 'error', '사용할 수 없거나 만료된 코드예요.');
  end if;
  if v_code.max_uses is not null and coalesce(v_code.use_count, 0) >= v_code.max_uses then
    return jsonb_build_object('valid', false, 'error', '이미 모두 사용된 코드예요.');
  end if;
  insert into public.code_uses(code_id, code, used_by, context, reward_granted, reward_data)
    values(v_code.id, v_code.code, p_user_id, 'signup', false, coalesce(v_code.rewards, '{}'::jsonb));
  update public.codes set use_count = coalesce(use_count, 0) + 1 where id = v_code.id;
  -- 첫 가입의 행이 아직 없어도 생성. 기존 포트폴리오 자산/스냅샷은 절대 덮어쓰지 않는다.
  insert into public.user_portfolios(user_id, stocks, invited_by_code)
    values(p_user_id, '{"investing":[],"watching":[],"sold":[]}'::jsonb, v_code.code)
    on conflict(user_id) do update set invited_by_code = excluded.invited_by_code;
  if v_code.type = 'referral' then
    if v_code.rewards #>> '{referee,type}' = 'ai_credits' then
      v_amount := (v_code.rewards #>> '{referee,amount}')::integer;
      if v_amount is null or v_amount < 0 then raise exception 'invalid referee reward'; end if;
      if v_amount > 0 then
        insert into public.user_credits(user_id, amount, source, source_ref)
          values(p_user_id, v_amount, 'referral', v_code.id);
      end if;
    end if;
    if v_code.created_by is not null and v_code.rewards #>> '{referrer,type}' = 'ai_credits' then
      v_amount := (v_code.rewards #>> '{referrer,amount}')::integer;
      if v_amount is null or v_amount < 0 then raise exception 'invalid referrer reward'; end if;
      if v_amount > 0 then
        insert into public.user_credits(user_id, amount, source, source_ref)
          values(v_code.created_by, v_amount, 'referral', v_code.id);
      end if;
    end if;
  end if;
  update public.code_uses set reward_granted = true where code = v_code.code and used_by = p_user_id;
  return jsonb_build_object('valid', true, 'applied', true, 'type', v_code.type);
end;
$$;
revoke all on function public.apply_signup_code(text, uuid) from public, anon, authenticated;
grant execute on function public.apply_signup_code(text, uuid) to service_role;
-- 사용 기록은 원자 함수가 있는 서버 경로로만 생성한다.
drop policy if exists code_uses_insert on public.code_uses;
notify pgrst, 'reload schema';
