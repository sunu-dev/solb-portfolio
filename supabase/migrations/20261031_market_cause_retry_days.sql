-- Preserve fences and cost reservations. Retry ceilings apply per UTC day so
-- yesterday's two transient failures do not suppress unchanged evidence for a week.
BEGIN;
ALTER TABLE market_cause_private.jobs ADD COLUMN IF NOT EXISTS attempt_day date NOT NULL DEFAULT ((clock_timestamp() AT TIME ZONE 'UTC')::date);
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
 IF j.attempts>=2 AND j.attempt_day>=(t AT TIME ZONE 'UTC')::date THEN RETURN jsonb_build_object('status','attempts_exhausted');END IF;
 UPDATE market_cause_private.jobs SET status='running',owner=p_owner,fence=fence+1,lease_until=t+interval '300 seconds',next_attempt_at=null,attempt_day=(t AT TIME ZONE 'UTC')::date,attempts=CASE WHEN j.attempt_day<(t AT TIME ZONE 'UTC')::date THEN 1 ELSE attempts+1 END
 WHERE job_key=p_key RETURNING * INTO j;
 RETURN jsonb_build_object('status','claimed','fence',j.fence,'leaseUntil',j.lease_until);
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
