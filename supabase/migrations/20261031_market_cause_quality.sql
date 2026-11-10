BEGIN;
ALTER TABLE market_cause_private.publication_control ADD COLUMN IF NOT EXISTS automation_started_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE TABLE IF NOT EXISTS market_cause_private.quality_runs(
 day date NOT NULL,policy text NOT NULL,checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),report jsonb NOT NULL,
 PRIMARY KEY(day,policy),CHECK(octet_length(report::text)<=32768));
CREATE TABLE IF NOT EXISTS market_cause_private.evaluation_queue(
 event_group text NOT NULL,policy text NOT NULL,source_version uuid NOT NULL REFERENCES market_cause_private.shadow_versions(id),
 evidence_hash text NOT NULL,split text NOT NULL CHECK(split IN('development','holdout')),
 development_exposed boolean NOT NULL DEFAULT false,
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),review_status text NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN('unreviewed','needs_recheck')),
 PRIMARY KEY(event_group,policy));
ALTER TABLE market_cause_private.quality_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_cause_private.evaluation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON market_cause_private.quality_runs,market_cause_private.evaluation_queue FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.read_market_cause_quality_inputs()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',public.market_cause_worker_enabled(),'release',c.narrative_release,
 'heads',COALESCE((SELECT jsonb_agg(jsonb_build_object('event',h.event_key,'version',v.id,'snapshot',v.payload->'snapshot'))
  FROM market_cause_private.shadow_heads h JOIN market_cause_private.shadow_versions v ON v.id=h.result_id
  WHERE h.event_key ~ '^(facts:|sec:|draft:sec:)(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL)$'),'[]'::jsonb))
 FROM market_cause_private.publication_control c WHERE c.id=true
$$;

CREATE OR REPLACE FUNCTION public.record_market_cause_quality(p_policy text,p_report jsonb,p_cases jsonb,p_revoke_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row jsonb;recorded integer:=0;revoked boolean:=false;
BEGIN
 IF NOT public.market_cause_worker_enabled() THEN RETURN jsonb_build_object('status','disabled');END IF;
 IF p_policy !~ '^narrative-shadow-v[0-9]+$' OR octet_length(p_report::text)>32768 OR jsonb_typeof(p_report)<>'object'
  OR jsonb_typeof(p_cases)<>'array' OR jsonb_array_length(p_cases)>8 THEN RAISE EXCEPTION 'invalid quality input';END IF;
 IF p_revoke_hash IS NOT NULL THEN
  UPDATE market_cause_private.publication_control SET narrative_release=null
   WHERE id=true AND narrative_release->>'evidenceHash'=p_revoke_hash;
  revoked:=FOUND;
 END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_cases) LOOP
  IF row->>'eventGroup' !~ '^company:(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL):[0-9]{4}-Q[1-4]$'
   OR row->>'evidenceHash' !~ '^[a-f0-9]{64}$' OR row->>'split' NOT IN('development','holdout') THEN RAISE EXCEPTION 'invalid evaluation case';END IF;
  -- The source must still be the current immutable company result. A concurrent
  -- correction cannot register an older snapshot as the latest evaluation case.
  IF EXISTS(SELECT 1 FROM market_cause_private.shadow_heads h JOIN market_cause_private.shadow_versions v ON v.id=h.result_id
    WHERE v.id=(row->>'version')::uuid AND h.event_key='sec:'||split_part(row->>'eventGroup',':',2)
    AND v.payload->'snapshot'->'narrative'->'run'->'assessment'->>'policyVersion'=p_policy) THEN
   INSERT INTO market_cause_private.evaluation_queue(event_group,policy,source_version,evidence_hash,split,development_exposed)
   VALUES(row->>'eventGroup',p_policy,(row->>'version')::uuid,row->>'evidenceHash',row->>'split',(row->>'developmentExposed')::boolean)
   ON CONFLICT(event_group,policy) DO UPDATE SET source_version=EXCLUDED.source_version,evidence_hash=EXCLUDED.evidence_hash,review_status='needs_recheck',development_exposed=market_cause_private.evaluation_queue.development_exposed OR EXCLUDED.development_exposed
    WHERE market_cause_private.evaluation_queue.evidence_hash<>EXCLUDED.evidence_hash OR EXCLUDED.development_exposed AND NOT market_cause_private.evaluation_queue.development_exposed;
   recorded:=recorded+1;
  END IF;
 END LOOP;
 INSERT INTO market_cause_private.quality_runs(day,policy,report) VALUES((clock_timestamp() AT TIME ZONE 'UTC')::date,p_policy,p_report)
 ON CONFLICT(day,policy) DO UPDATE SET checked_at=clock_timestamp(),report=EXCLUDED.report
  WHERE market_cause_private.quality_runs.report<>EXCLUDED.report;
 RETURN jsonb_build_object('status','recorded','casesChecked',recorded,'releaseRevoked',revoked);
END $$;

-- Retry both diagnosed failures and genuinely missed schedule slots. Missing
-- slots are calculated, not inserted by a polling writer. Wait until the Hobby
-- scheduling hour plus the worker duration has elapsed. Never invent pre-install runs.
CREATE OR REPLACE FUNCTION public.market_cause_recovery_queue(p_group text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 WITH t AS (SELECT clock_timestamp() AS now), recent AS (
 SELECT DISTINCT ON(j.event_key) j.* FROM market_cause_private.jobs j,t
 WHERE j.created_at>t.now-interval '48 hours' AND
 (j.event_key ~ '^collection:(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL):[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR j.event_key IN('official:fed','official:bok'))
 ORDER BY j.event_key,j.created_at DESC,j.job_key DESC), failures AS (
 SELECT event_key,0 AS priority,created_at AS due FROM recent,t
 WHERE (status='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=t.now) OR status='running' AND lease_until<=t.now)
 AND (attempts<2 OR attempt_day<(t.now AT TIME ZONE 'UTC')::date)
 AND (event_key LIKE 'official:%' OR split_part(event_key,':',3)>=to_char((t.now AT TIME ZONE 'UTC')::date-1,'YYYY-MM-DD'))
 AND (event_key NOT LIKE 'official:%' OR created_at>date_trunc('day',t.now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')),
 slots AS (
 SELECT 'collection:'||s.symbol||':'||to_char(d.day,'YYYY-MM-DD') AS event_key,
 (d.day+s.hour*interval '1 hour') AT TIME ZONE 'UTC' AS scheduled
 FROM t CROSS JOIN generate_series(((t.now AT TIME ZONE 'UTC')::date-1)::timestamp,((t.now AT TIME ZONE 'UTC')::date)::timestamp,interval '1 day') AS d(day)
 CROSS JOIN (VALUES('INTC',22),('NVDA',23),('AMD',0),('AMZN',1),('GOOGL',2),('MSFT',3),('META',4),('AAPL',5)) AS s(symbol,hour)
 WHERE CASE WHEN s.hour>=22 THEN extract(isodow FROM d.day) BETWEEN 1 AND 5 ELSE extract(isodow FROM d.day) BETWEEN 2 AND 6 END),
 missing AS (
 SELECT s.event_key,1 AS priority,s.scheduled AS due FROM slots s,t,market_cause_private.publication_control c
 WHERE c.id=true AND s.scheduled>=c.automation_started_at AND s.scheduled+interval '65 minutes'<=t.now
 AND NOT EXISTS(SELECT 1 FROM recent r WHERE r.event_key=s.event_key)),
 due AS (SELECT * FROM failures UNION ALL SELECT * FROM missing)
 SELECT COALESCE(jsonb_agg(jsonb_build_object('event_key',x.event_key)),'[]'::jsonb)
 FROM (SELECT event_key FROM due WHERE public.market_cause_worker_enabled() AND (p_group IS NULL OR split_part(event_key,':',2)=ANY(CASE p_group WHEN 'chips' THEN ARRAY['INTC','NVDA'] WHEN 'compute' THEN ARRAY['AMD','MSFT'] WHEN 'platforms' THEN ARRAY['GOOGL','META'] WHEN 'consumer' THEN ARRAY['AMZN','AAPL'] ELSE ARRAY[]::text[] END)) GROUP BY event_key ORDER BY min(priority),min(due),event_key LIMIT 2) x
$$;
CREATE OR REPLACE FUNCTION public.market_cause_recovery_due() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.market_cause_recovery_queue(NULL) $$;
REVOKE ALL ON FUNCTION public.read_market_cause_quality_inputs(),public.record_market_cause_quality(text,jsonb,jsonb,text),public.market_cause_recovery_due(),public.market_cause_recovery_queue(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_market_cause_quality_inputs(),public.record_market_cause_quality(text,jsonb,jsonb,text),public.market_cause_recovery_due(),public.market_cause_recovery_queue(text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
