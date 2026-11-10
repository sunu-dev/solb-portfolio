-- A quality finding requests existing, bounded work; it never authorizes prose or spending.
CREATE OR REPLACE FUNCTION public.request_company_business_repairs(p_request_id text,p_symbols jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,company_business_private AS $$
DECLARE s text; j jobs%ROWTYPE; result jsonb='[]'::jsonb; action_name text;
BEGIN
 IF p_request_id IS NULL OR p_request_id !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_symbols) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_symbols)>30 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_symbols) x WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' !~ '^[A-Z0-9^.=-]{1,32}$')
  OR (SELECT count(*) FROM jsonb_array_elements(p_symbols))<>(SELECT count(DISTINCT x) FROM jsonb_array_elements(p_symbols) x)
 THEN RAISE EXCEPTION 'invalid quality request'; END IF;
 PERFORM 1 FROM control WHERE id=true FOR UPDATE;
 action_name='quality_request:'||p_request_id;
 FOR s IN SELECT jsonb_array_elements_text(p_symbols) LOOP
  SELECT * INTO j FROM jobs WHERE symbol=s FOR UPDATE;
  IF NOT FOUND THEN result=result||jsonb_build_array(jsonb_build_object('symbol',s,'status','not-covered')); CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM audit WHERE symbol=s AND action=action_name) THEN
   result=result||jsonb_build_array(jsonb_build_object('symbol',s,'status','already-requested')); CONTINUE;
  END IF;
  -- Do not reset model/attempt budgets, leases, backoff, a draft or an approval.
  UPDATE jobs SET priority=0,reason=CASE WHEN state='queued' THEN 'quality_repair_requested' ELSE reason END WHERE symbol=s;
  INSERT INTO audit(symbol,fence,action,evidence_hash,draft_hash) VALUES(s,j.fence,action_name,j.evidence_hash,j.draft_hash);
  result=result||jsonb_build_array(jsonb_build_object('symbol',s,'status','queued'));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.request_company_business_repairs(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_company_business_repairs(text,jsonb) TO service_role;
CREATE INDEX IF NOT EXISTS company_business_quality_requests ON company_business_private.audit(symbol,action) WHERE action LIKE 'quality_request:%';

CREATE OR REPLACE FUNCTION public.claim_company_business(p_owner uuid,p_market text,p_symbol text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,company_business_private AS $$
DECLARE c control%ROWTYPE; j jobs%ROWTYPE; used integer; today date=(clock_timestamp() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_owner IS NULL OR p_market NOT IN ('US','KR','all') THEN RAISE EXCEPTION 'invalid worker'; END IF;
 SELECT * INTO c FROM control WHERE id=true FOR UPDATE;
 IF NOT c.worker_enabled OR clock_timestamp()>=c.model_until THEN RETURN NULL; END IF;
 -- Serialize active collectors as well as reservations; retries cannot fan out SEC/DART requests.
 IF EXISTS(SELECT 1 FROM jobs WHERE lease_until>clock_timestamp()) THEN RETURN NULL; END IF;
 SELECT d.jobs INTO used FROM days d WHERE day=today;
 IF coalesce(used,0)>=c.daily_jobs THEN RETURN NULL; END IF;
 SELECT * INTO j FROM jobs WHERE next_attempt_at<=clock_timestamp()
  AND (p_symbol IS NULL OR symbol=p_symbol)
  AND (p_market='all' OR (p_market='KR')=(symbol ~ '^([A-Z0-9]{6}[.](KS|KQ)|[0-9][A-Z0-9]{5})$'))
  ORDER BY (approval IS NOT NULL) DESC,(reason='quality_repair_requested') DESC,(snapshot->'draft'<>'null'::jsonb) DESC,priority,next_attempt_at,symbol FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO days(day,jobs) VALUES(today,1) ON CONFLICT(day) DO UPDATE SET jobs=days.jobs+1;
 UPDATE jobs SET owner=p_owner,fence=fence+1,attempts=attempts+1,lease_until=clock_timestamp()+interval '5 minutes',
  next_attempt_at=clock_timestamp()+interval '30 minutes',state='collecting' WHERE symbol=j.symbol RETURNING * INTO j;
 RETURN jsonb_build_object('symbol',j.symbol,'owner',j.owner,'fence',j.fence,'snapshot',j.snapshot);
END $$;
