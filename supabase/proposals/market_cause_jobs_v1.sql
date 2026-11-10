-- PROPOSAL ONLY. Shadow evidence jobs; never consumed by public market-watch reads.
-- Apply after market_cause_budget_v1.sql. Both controls are disabled by default.
BEGIN;
CREATE TABLE IF NOT EXISTS market_cause_private.worker_control(id boolean PRIMARY KEY CHECK(id),enabled boolean NOT NULL DEFAULT false);
INSERT INTO market_cause_private.worker_control VALUES(true,false) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS market_cause_private.jobs(
 job_key text PRIMARY KEY CHECK(length(job_key) BETWEEN 1 AND 200),event_key text NOT NULL CHECK(length(event_key) BETWEEN 1 AND 160),
 input_hash text NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','finished','failed')),
 fence bigint NOT NULL DEFAULT 0,owner uuid,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
 result_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS market_cause_private.shadow_versions(
 id uuid PRIMARY KEY,event_key text NOT NULL,revision bigint NOT NULL,input_hash text NOT NULL,payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(event_key,revision)
);
CREATE TABLE IF NOT EXISTS market_cause_private.shadow_heads(event_key text PRIMARY KEY,revision bigint NOT NULL DEFAULT 0,result_id uuid);
ALTER TABLE market_cause_private.worker_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_cause_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_cause_private.shadow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_cause_private.shadow_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA market_cause_private FROM PUBLIC,anon,authenticated,service_role;

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
 IF j.status='running' AND j.lease_until>t THEN RETURN jsonb_build_object('status','busy');END IF;
 IF j.attempts>=2 THEN RETURN jsonb_build_object('status','attempts_exhausted');END IF;
 UPDATE market_cause_private.jobs SET status='running',owner=p_owner,fence=fence+1,lease_until=t+interval '300 seconds',attempts=attempts+1
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
 UPDATE market_cause_private.jobs SET status='finished',result_id=r,owner=null,lease_until=null WHERE job_key=p_key;
 RETURN jsonb_build_object('status','stored','resultId',r,'revision',h.revision+1);
END $$;
CREATE OR REPLACE FUNCTION public.read_market_cause_shadow(p_event text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('revision',h.revision,'resultId',h.result_id,'payload',v.payload)
 FROM market_cause_private.shadow_heads h LEFT JOIN market_cause_private.shadow_versions v ON v.id=h.result_id WHERE h.event_key=p_event
$$;
CREATE OR REPLACE FUNCTION public.market_cause_worker_enabled()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT enabled FROM market_cause_private.worker_control WHERE id=true),false)
 AND COALESCE((SELECT enabled FROM market_cause_private.budget_control WHERE id=true),false)
$$;
REVOKE ALL ON FUNCTION public.market_cause_worker_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.market_cause_worker_enabled() TO service_role;
REVOKE ALL ON FUNCTION public.claim_market_cause_job(text,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.publish_market_cause_shadow(text,text,uuid,bigint,bigint,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.read_market_cause_shadow(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_market_cause_job(text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_market_cause_shadow(text,text,uuid,bigint,bigint,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_market_cause_shadow(text) TO service_role;
COMMIT;
