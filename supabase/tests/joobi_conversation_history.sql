-- Run against a disposable database with auth.users/auth.uid and this migration installed.
-- Synthetic users only. Entire fixture rolls back.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
begin
  if has_function_privilege('anon','public.save_joobi_conversation(uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'anon write allowed'; end if;
  if has_table_privilege('authenticated','public.joobi_conversation_history','UPDATE') then raise exception 'direct update allowed'; end if;
  perform public.save_joobi_conversation(auth.uid(), '11111111-1111-4111-8111-111111111111','GENERAL:kr:1d','{"question":"질문","symbol":"GENERAL","currentStatus":"답변","keyAdvice":[],"conclusion":{"desc":""}}');
  perform public.save_joobi_conversation(auth.uid(), '11111111-1111-4111-8111-111111111111','GENERAL:kr:1d','{"question":"덮어쓰기"}');
  if (select answer->>'question' from public.joobi_conversation_history) <> '질문' then raise exception 'immutable row changed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
begin
  if (select count(*) from public.joobi_conversation_history) <> 0 then raise exception 'other account readable'; end if;
  begin
    perform public.delete_joobi_conversations('00000000-0000-4000-8000-000000000001', null);
    raise exception 'stale owner allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_joobi_conversation(auth.uid(), '11111111-1111-4111-8111-111111111111','GENERAL:kr:1d','{}');
    raise exception 'other account writable';
  exception when insufficient_privilege then null; end;
  perform public.delete_joobi_conversations(auth.uid(), '11111111-1111-4111-8111-111111111111');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
begin
  if (select count(*) from public.joobi_conversation_history) <> 1 then raise exception 'other account deleted row'; end if;
  perform public.delete_joobi_conversations(auth.uid(), '11111111-1111-4111-8111-111111111111');
  if public.save_joobi_conversation(auth.uid(), '11111111-1111-4111-8111-111111111111','GENERAL:kr:1d','{}') then raise exception 'deleted row resurrected'; end if;
  if (select count(*) from public.joobi_conversation_history) <> 0 then raise exception 'deleted row visible'; end if;
  begin
    perform public.save_joobi_conversation(auth.uid(), '22222222-2222-4222-8222-222222222222','GENERAL:kr:1d','{}');
    raise exception 'invalid shape accepted';
  exception when check_violation then null; end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.joobi_conversation_history where deleted_at is not null and (answer is not null or context is not null)) then raise exception 'deleted text retained'; end if;
end $$;
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from public.joobi_conversation_history) then raise exception 'account deletion did not cascade'; end if; end $$;
rollback;
