-- STAGED ONLY. Not in migrations: do not apply to production yet.
-- Requires the existing portfolio history / owner-CAS migrations.
-- Enrollment is denied unless an operator explicitly adds a reviewed test/user
-- to the private rollout table. Recovery UX, local storage, notification queues
-- and legacy backup retention must be ready BEFORE production enrollment.
begin;

create schema if not exists joobi_vault_private;
revoke all on schema joobi_vault_private from public, anon;
grant usage on schema joobi_vault_private to authenticated, service_role;

create table joobi_vault_private.rollout (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
revoke all on joobi_vault_private.rollout from public, anon, authenticated, service_role;

create function joobi_vault_private.valid_bytes(v text, lo integer, hi integer)
returns boolean language plpgsql immutable set search_path = '' as $$
declare b bytea;
begin
  if v is null or length(v) > ceil(hi * 4.0 / 3) or v !~ '^[A-Za-z0-9_-]+$' or length(v) % 4 = 1 then return false; end if;
  b := decode(translate(v, '-_', '+/') || repeat('=', (4 - length(v) % 4) % 4), 'base64');
  return octet_length(b) between lo and hi
    and translate(rtrim(replace(encode(b, 'base64'), E'\n', ''), '='), '+/', '-_') = v;
exception when others then return false;
end;
$$;

create function joobi_vault_private.valid_record(v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'object' then return false; end if;
  return (select count(*) = 4 from jsonb_object_keys(v))
    and not exists (select 1 from jsonb_each(v) where jsonb_typeof(value) <> 'string')
    and v->>'format' = 'joobi-portfolio-a256gcm-v1'
    and joobi_vault_private.valid_bytes(v->>'keyId', 16, 16)
    and joobi_vault_private.valid_bytes(v->>'iv', 12, 12)
    and joobi_vault_private.valid_bytes(v->>'ciphertext', 16, 2097168);
end;
$$;

create function joobi_vault_private.valid_key(v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'object' then return false; end if;
  return (select count(*) = 4 from jsonb_object_keys(v))
    and not exists (select 1 from jsonb_each(v) where jsonb_typeof(value) <> 'string')
    and v->>'format' = 'joobi-portfolio-hkdf-a256kw-v1'
    and joobi_vault_private.valid_bytes(v->>'keyId', 16, 16)
    and joobi_vault_private.valid_bytes(v->>'salt', 32, 32)
    and joobi_vault_private.valid_bytes(v->>'wrappedKey', 40, 40);
end;
$$;

create function joobi_vault_private.valid_unlock(v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'object' then return false; end if;
  return (select count(*) = 3 from jsonb_object_keys(v))
    and not exists (select 1 from jsonb_each(v) where jsonb_typeof(value) <> 'string')
    and v->>'format' = 'joobi-webauthn-prf-v1'
    and joobi_vault_private.valid_bytes(v->>'credentialId', 1, 1023)
    and joobi_vault_private.valid_bytes(v->>'input', 32, 32);
end;
$$;

revoke all on all functions in schema joobi_vault_private from public, anon, authenticated, service_role;
grant execute on function joobi_vault_private.valid_bytes(text, integer, integer),
  joobi_vault_private.valid_record(jsonb), joobi_vault_private.valid_key(jsonb),
  joobi_vault_private.valid_unlock(jsonb) to authenticated, service_role;

-- The live schema has a legacy settings JSON column; older test/bootstrap
-- schemas did not. Nonempty settings require a separate lossless review.
alter table public.user_portfolios add column if not exists settings jsonb default '{}'::jsonb;
alter table public.user_portfolios
  add column storage_format text not null default 'plain-v1',
  add column vault_record jsonb,
  add column vault_key jsonb,
  add column vault_unlock jsonb,
  add column vault_revision bigint;

alter table public.user_portfolios add constraint portfolio_vault_shape check (
  (storage_format = 'plain-v1' and vault_record is null and vault_key is null and vault_unlock is null and vault_revision is null)
  or (storage_format = 'vault-v1'
    and stocks = '{"investing":[],"watching":[],"sold":[]}'::jsonb
    and daily_snapshots = '[]'::jsonb and portfolio_history = '[]'::jsonb
    and (settings is null or settings in ('{}'::jsonb, 'null'::jsonb))
    and vault_revision is not null and vault_revision between 1 and 9007199254740991
    and joobi_vault_private.valid_record(vault_record) is true
    and joobi_vault_private.valid_key(vault_key) is true
    and joobi_vault_private.valid_unlock(vault_unlock) is true
    and vault_record->>'keyId' = vault_key->>'keyId')
);

-- Existing plaintext clients keep their column access. They cannot set the mode,
-- reset an encrypted account, or delete/recreate a row to bypass the guard.
revoke insert, update, delete on public.user_portfolios from public, anon, authenticated;
grant insert(user_id, stocks, daily_snapshots, portfolio_history, created_at, updated_at),
  update(stocks, daily_snapshots, portfolio_history, updated_at) on public.user_portfolios to authenticated;

create function joobi_vault_private.guard_portfolio_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.storage_format = 'vault-v1' or (tg_op = 'UPDATE' and old.storage_format = 'vault-v1'))
    and current_user <> (select pg_get_userbyid(relowner) from pg_class where oid = tg_relid) then
    raise exception 'vault_write_requires_rpc' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.storage_format = 'vault-v1' and new.storage_format <> 'vault-v1' then
    raise exception 'vault_downgrade_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function joobi_vault_private.guard_portfolio_write() from public, anon, authenticated, service_role;
create trigger portfolio_vault_write_guard before insert or update on public.user_portfolios
  for each row execute function joobi_vault_private.guard_portfolio_write();

create function public.read_portfolio_vault_v1(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.user_portfolios%rowtype;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'vault_owner_mismatch' using errcode = '42501';
  end if;
  select * into r from public.user_portfolios where user_id = p_user_id;
  if not found then return jsonb_build_object('status', 'empty'); end if;
  if r.storage_format = 'plain-v1' then return jsonb_build_object('status', 'legacy'); end if;
  return jsonb_build_object('status', 'sealed', 'revision', r.vault_revision,
    'record', r.vault_record, 'protectedKey', r.vault_key, 'descriptor', r.vault_unlock);
end;
$$;

create function public.initialize_portfolio_vault_v1(
  p_user_id uuid, p_expected_updated_at timestamptz, p_record jsonb, p_protected_key jsonb, p_descriptor jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare changed boolean;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'vault_owner_mismatch' using errcode = '42501';
  end if;
  if not exists (select 1 from joobi_vault_private.rollout where user_id = p_user_id and enabled) then
    return jsonb_build_object('status', 'disabled');
  end if;
  if joobi_vault_private.valid_record(p_record) is not true
    or joobi_vault_private.valid_key(p_protected_key) is not true
    or joobi_vault_private.valid_unlock(p_descriptor) is not true
    or p_record->>'keyId' is distinct from p_protected_key->>'keyId' then
    raise exception 'invalid_vault_envelope' using errcode = '22023';
  end if;
  if p_expected_updated_at is null then
    insert into public.user_portfolios(user_id, stocks, daily_snapshots, portfolio_history, settings,
      storage_format, vault_record, vault_key, vault_unlock, vault_revision, updated_at)
    values (p_user_id, '{"investing":[],"watching":[],"sold":[]}', '[]', '[]', '{}',
      'vault-v1', p_record, p_protected_key, p_descriptor, 1, clock_timestamp())
    on conflict (user_id) do nothing;
    changed := found;
  else
    -- The existing row lock serializes initialization and old CAS/upsert writes.
    -- Only the EXACT previously read legacy snapshot may be replaced.
    update public.user_portfolios set stocks = '{"investing":[],"watching":[],"sold":[]}',
      daily_snapshots = '[]', portfolio_history = '[]', storage_format = 'vault-v1',
      vault_record = p_record, vault_key = p_protected_key, vault_unlock = p_descriptor,
      vault_revision = 1, updated_at = clock_timestamp()
    where user_id = p_user_id and storage_format = 'plain-v1' and updated_at = p_expected_updated_at
      and (settings is null or settings in ('{}'::jsonb, 'null'::jsonb));
    changed := found;
  end if;
  if not changed then return jsonb_build_object('status', 'conflict'); end if;
  return jsonb_build_object('status', 'ok', 'revision', 1);
end;
$$;

create function public.save_portfolio_vault_v1(p_user_id uuid, p_expected_revision bigint, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved bigint;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'vault_owner_mismatch' using errcode = '42501';
  end if;
  if not exists (select 1 from joobi_vault_private.rollout where user_id = p_user_id and enabled) then
    return jsonb_build_object('status', 'disabled');
  end if;
  if p_expected_revision is null or p_expected_revision not between 1 and 9007199254740990
    or joobi_vault_private.valid_record(p_record) is not true then
    raise exception 'invalid_vault_envelope' using errcode = '22023';
  end if;
  update public.user_portfolios set vault_record = p_record, vault_revision = vault_revision + 1, updated_at = clock_timestamp()
  where user_id = p_user_id and storage_format = 'vault-v1' and vault_revision = p_expected_revision
    and vault_key->>'keyId' = p_record->>'keyId'
  returning vault_revision into saved;
  if saved is null then return jsonb_build_object('status', 'conflict'); end if;
  return jsonb_build_object('status', 'ok', 'revision', saved);
end;
$$;

revoke all on function public.read_portfolio_vault_v1(uuid),
  public.initialize_portfolio_vault_v1(uuid, timestamptz, jsonb, jsonb, jsonb),
  public.save_portfolio_vault_v1(uuid, bigint, jsonb) from public, anon, service_role;
grant execute on function public.read_portfolio_vault_v1(uuid),
  public.initialize_portfolio_vault_v1(uuid, timestamptz, jsonb, jsonb, jsonb),
  public.save_portfolio_vault_v1(uuid, bigint, jsonb) to authenticated;

commit;
