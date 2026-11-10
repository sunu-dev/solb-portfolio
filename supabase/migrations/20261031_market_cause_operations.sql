-- Narrow extension of the installed private market-cause pilot. No user tables.
BEGIN;
ALTER TABLE market_cause_private.jobs ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
CREATE TABLE IF NOT EXISTS market_cause_private.publication_control(id boolean PRIMARY KEY CHECK(id),official_facts boolean NOT NULL DEFAULT false);
INSERT INTO market_cause_private.publication_control VALUES(true,false) ON CONFLICT DO NOTHING;
ALTER TABLE market_cause_private.publication_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON market_cause_private.publication_control FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.claim_market_cause_job(p_key text,p_event text,p_hash text,p_owner uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j market_cause_private.jobs%ROWTYPE;t timestamptz:=clock_timestamp();
BEGIN
 IF p_owner IS NULL OR p_key IS NULL OR p_event IS NULL OR p_hash IS NULL OR p_key !~ '^[a-zA-Z0-9:_./-]{1,200}$'
 OR p_event !~ '^[a-zA-Z0-9:_./-]{1,160}$' OR p_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid job' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM market_cause_private.worker_control WHERE id=true AND enabled FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','disabled');END IF;
 INSERT INTO market_cause_private.jobs(job_key,event_key,input_hash) VALUES(p_key,p_event,p_hash) ON CONFLICT DO NOTHING;
 SELECT * INTO j FROM market_cause_private.jobs WHERE job_key=p_key FOR UPDATE;
 IF j.input_hash<>p_hash OR j.event_key<>p_event THEN RETURN jsonb_build_object('status','input_mismatch');END IF;
 IF j.status='finished' THEN RETURN jsonb_build_object('status','finished','resultId',j.result_id);END IF;
 IF j.next_attempt_at>t THEN RETURN jsonb_build_object('status','busy');END IF;
 IF j.status='running' AND j.lease_until>t THEN RETURN jsonb_build_object('status','busy');END IF;
 IF j.attempts>=2 THEN RETURN jsonb_build_object('status','attempts_exhausted');END IF;
 UPDATE market_cause_private.jobs SET status='running',owner=p_owner,fence=fence+1,lease_until=t+interval '300 seconds',next_attempt_at=null,attempts=attempts+1
 WHERE job_key=p_key RETURNING * INTO j;
 RETURN jsonb_build_object('status','claimed','fence',j.fence,'leaseUntil',j.lease_until);
END $$;
CREATE OR REPLACE FUNCTION public.publish_market_cause_shadow(p_key text,p_hash text,p_owner uuid,p_fence bigint,p_expected_revision bigint,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j market_cause_private.jobs%ROWTYPE;h market_cause_private.shadow_heads%ROWTYPE;r uuid:=gen_random_uuid();
BEGIN
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>262144
 OR COALESCE(p_payload->>'disposition','') NOT IN ('facts_only','explained','conflicting','withdrawn')
 OR COALESCE(jsonb_typeof(p_payload->'claims'),'')<>'array' OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
 RAISE EXCEPTION 'invalid shadow payload' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM market_cause_private.worker_control WHERE id=true AND enabled FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','disabled');END IF;
 SELECT * INTO j FROM market_cause_private.jobs WHERE job_key=p_key FOR UPDATE;
 IF NOT FOUND OR j.input_hash IS DISTINCT FROM p_hash OR j.owner IS DISTINCT FROM p_owner OR j.fence IS DISTINCT FROM p_fence
 OR j.status<>'running' OR j.lease_until<=clock_timestamp() THEN RETURN jsonb_build_object('status','stale_worker');END IF;
 INSERT INTO market_cause_private.shadow_heads(event_key) VALUES(j.event_key) ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM market_cause_private.shadow_heads WHERE event_key=j.event_key FOR UPDATE;
 IF h.revision<>p_expected_revision THEN
 UPDATE market_cause_private.jobs SET status='failed',owner=null,lease_until=null WHERE job_key=p_key;
 RETURN jsonb_build_object('status','revision_conflict');END IF;
 INSERT INTO market_cause_private.shadow_versions(id,event_key,revision,input_hash,payload) VALUES(r,j.event_key,h.revision+1,p_hash,p_payload);
 UPDATE market_cause_private.shadow_heads SET revision=revision+1,result_id=r WHERE event_key=j.event_key;
 -- Retry state is fenced and committed with the diagnostic version. A cooldown
 -- and the existing two-attempt ceiling apply even if the endpoint is replayed.
 IF p_payload->>'retryable'='true' AND (j.event_key ~ '^collection:(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL):[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR j.event_key IN ('official:fed','official:bok')) THEN
 UPDATE market_cause_private.jobs SET status='failed',result_id=r,owner=null,lease_until=null,next_attempt_at=clock_timestamp()+interval '15 minutes' WHERE job_key=p_key;
 ELSE
 UPDATE market_cause_private.jobs SET status='finished',result_id=r,owner=null,lease_until=null,next_attempt_at=null WHERE job_key=p_key;
 END IF;
 RETURN jsonb_build_object('status','stored','resultId',r,'revision',h.revision+1);
END $$;

CREATE OR REPLACE FUNCTION public.read_market_cause_official()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',c.official_facts,'snapshots',CASE WHEN c.official_facts THEN COALESCE((
 SELECT jsonb_agg(v.payload->'snapshot'->'official' ORDER BY h.event_key)
 FROM market_cause_private.shadow_heads h JOIN market_cause_private.shadow_versions v ON v.id=h.result_id
 WHERE h.event_key IN ('official:fed','official:bok') AND v.payload->'snapshot'->'official' IS NOT NULL),'[]'::jsonb) ELSE '[]'::jsonb END)
 FROM market_cause_private.publication_control c WHERE c.id=true
$$;
CREATE OR REPLACE FUNCTION public.market_cause_recovery_due()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (
 SELECT DISTINCT ON (j.event_key) j.event_key FROM market_cause_private.jobs j
 WHERE public.market_cause_worker_enabled() AND j.status='failed' AND j.attempts<2
 AND j.next_attempt_at<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM market_cause_private.jobs newer WHERE newer.event_key=j.event_key AND newer.created_at>j.created_at)
 AND (j.event_key NOT LIKE 'official:%' OR (j.created_at AT TIME ZONE 'UTC')::date=(clock_timestamp() AT TIME ZONE 'UTC')::date)
 AND j.created_at>clock_timestamp()-interval '48 hours'
 AND (j.event_key ~ '^collection:(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL):[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR j.event_key IN ('official:fed','official:bok'))
 ORDER BY j.event_key LIMIT 2) x
$$;
REVOKE ALL ON FUNCTION public.read_market_cause_official() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.market_cause_recovery_due() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_market_cause_official() TO service_role;
GRANT EXECUTE ON FUNCTION public.market_cause_recovery_due() TO service_role;
-- Repair only collection diagnostics falsely finalized by the previous pilot.
UPDATE market_cause_private.jobs j SET status='failed',next_attempt_at=clock_timestamp()
FROM market_cause_private.shadow_versions v
WHERE j.result_id=v.id AND j.status='finished' AND j.attempts<2
AND j.created_at>clock_timestamp()-interval '48 hours'
AND j.event_key ~ '^collection:(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL):[0-9]{4}-[0-9]{2}-[0-9]{2}$'
AND (v.payload->'snapshot'->'decision'->'reasonCodes' ?| ARRAY['collection_source_unavailable','collection_analysis_failed']);
CREATE TABLE IF NOT EXISTS market_cause_private.daily_observations(
 day date PRIMARY KEY,observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),report jsonb NOT NULL
);
ALTER TABLE market_cause_private.daily_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON market_cause_private.daily_observations FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.observe_market_cause_day()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE report jsonb;today date:=(clock_timestamp() AT TIME ZONE 'UTC')::date;
BEGIN
 IF NOT public.market_cause_worker_enabled() THEN RETURN jsonb_build_object('status','disabled');END IF;
 -- Immutable first observation per UTC day. Repeated cron delivery adds no row.
 SELECT d.report INTO report FROM market_cause_private.daily_observations d WHERE d.day=today;
 IF FOUND THEN RETURN jsonb_build_object('status','existing','day',today);END IF;
 SELECT jsonb_build_object('observedAt',clock_timestamp(),
 'collections',COALESCE((SELECT jsonb_agg(x) FROM (
 SELECT h.event_key,v.created_at,v.payload->'snapshot'->'decision'->'reasonCodes' AS reasons,
 v.payload->'snapshot'->'attempts' AS attempts
 FROM market_cause_private.shadow_heads h JOIN market_cause_private.shadow_versions v ON v.id=h.result_id
 WHERE h.event_key LIKE 'collection:%' AND v.created_at>clock_timestamp()-interval '36 hours' ORDER BY h.event_key) x),'[]'::jsonb),
 'budget',COALESCE((SELECT jsonb_agg(x) FROM (SELECT period_kind,period_start,calls,spent,reserved FROM market_cause_private.budget_periods WHERE period_start>=today-1) x),'[]'::jsonb),
 'jobs',COALESCE((SELECT jsonb_agg(x) FROM (SELECT status,count(*) FROM market_cause_private.jobs WHERE created_at>clock_timestamp()-interval '36 hours' GROUP BY status) x),'[]'::jsonb),
 'databaseCounters',(SELECT jsonb_build_object('statsReset',stats_reset,'blocksRead',blks_read,'blocksHit',blks_hit,'rowsInserted',tup_inserted,'rowsUpdated',tup_updated,'rowsDeleted',tup_deleted) FROM pg_catalog.pg_stat_database WHERE datname=current_database()),
 'privateStorageBytes',(SELECT sum(pg_total_relation_size(c.oid)) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='market_cause_private' AND c.relkind='r')
 ) INTO report;
 INSERT INTO market_cause_private.daily_observations(day,report) VALUES(today,report) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('status','recorded','day',today);
END $$;
REVOKE ALL ON FUNCTION public.observe_market_cause_day() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.observe_market_cause_day() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
