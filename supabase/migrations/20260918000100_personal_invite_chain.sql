-- 초대코드 가입이 완료되면 신규 사용자에게 1회용 개인 JOOBI 코드를 원자적으로 발급한다.
-- beta_max_users도 같은 트랜잭션에서 잠금 후 확인해 동시 가입으로 상한을 넘지 않게 한다.

begin;

create or replace function public.ensure_personal_invite_code(p_user_id uuid)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_attempt integer;
begin
  if p_user_id is null then raise exception 'authentication required'; end if;

  perform pg_advisory_xact_lock(hashtextextended('personal_invite:' || p_user_id::text, 0));
  select code into v_code
    from public.codes
    where created_by = p_user_id and type = 'invite'
    order by created_at desc
    limit 1;
  if v_code is not null then return v_code; end if;

  for v_attempt in 1..10 loop
    v_code := 'JOOBI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.codes(code, type, created_by, max_uses, rewards, description, metadata)
      values(
        v_code,
        'invite',
        p_user_id,
        1,
        '{}'::jsonb,
        '가입 자동 발급 개인 초대 코드',
        jsonb_build_object('source', 'signup_auto', 'invite_limit', 1)
      );
      return v_code;
    exception when unique_violation then
      -- 코드 충돌이면 새 후보로 재시도한다.
    end;
  end loop;

  raise exception 'personal invite code generation failed';
end;
$$;

revoke all on function public.ensure_personal_invite_code(uuid) from public, anon, authenticated;
grant execute on function public.ensure_personal_invite_code(uuid) to service_role;

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
  v_max_users integer;
  v_current_users integer;
  v_personal_code text;
begin
  if p_user_id is null then raise exception 'authentication required'; end if;
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
  if v_use.id is not null then
    if v_use.reward_granted and v_invited = v_code.code then
      v_personal_code := public.ensure_personal_invite_code(p_user_id);
      return jsonb_build_object(
        'valid', true, 'applied', true, 'type', v_code.type, 'personal_code', v_personal_code
      );
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

  select case when value ~ '^[0-9]+$' then value::integer else 0 end into v_max_users
    from public.app_config where key = 'beta_max_users';
  if coalesce(v_max_users, 0) > 0 then
    perform pg_advisory_xact_lock(hashtextextended('beta_signup_capacity', 0));
    select count(distinct used_by)::integer into v_current_users
      from public.code_uses where context = 'signup' and used_by is not null;
    if coalesce(v_current_users, 0) >= v_max_users then
      return jsonb_build_object('valid', false, 'error', '현재 베타 참여 인원이 모두 찼어요.');
    end if;
  end if;

  insert into public.code_uses(code_id, code, used_by, context, reward_granted, reward_data)
    values(v_code.id, v_code.code, p_user_id, 'signup', false, coalesce(v_code.rewards, '{}'::jsonb));
  update public.codes set use_count = coalesce(use_count, 0) + 1 where id = v_code.id;
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

  v_personal_code := public.ensure_personal_invite_code(p_user_id);
  update public.code_uses set reward_granted = true where code = v_code.code and used_by = p_user_id;
  return jsonb_build_object(
    'valid', true, 'applied', true, 'type', v_code.type, 'personal_code', v_personal_code
  );
end;
$$;

revoke all on function public.apply_signup_code(text, uuid) from public, anon, authenticated;
grant execute on function public.apply_signup_code(text, uuid) to service_role;
notify pgrst, 'reload schema';

commit;
