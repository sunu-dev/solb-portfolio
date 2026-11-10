-- Private bounded work queue. Public requests can never enqueue, generate or approve content.
CREATE SCHEMA IF NOT EXISTS company_business_private;
REVOKE ALL ON SCHEMA company_business_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS company_business_private.control (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), worker_enabled boolean NOT NULL DEFAULT false,
 publication_enabled boolean NOT NULL DEFAULT false, daily_jobs integer NOT NULL DEFAULT 2 CHECK(daily_jobs BETWEEN 1 AND 20),
 model_until timestamptz NOT NULL DEFAULT '2026-11-14 08:00:00+00'
);
INSERT INTO company_business_private.control(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS company_business_private.days (
 day date PRIMARY KEY, jobs integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS company_business_private.jobs (
 symbol text PRIMARY KEY CHECK(symbol ~ '^[A-Z0-9^.=-]{1,32}$'), priority integer NOT NULL DEFAULT 1 CHECK(priority BETWEEN 0 AND 2),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','collecting','review_pending','approval_pending','published','blocked')),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(), fence bigint NOT NULL DEFAULT 0,
 owner uuid, lease_until timestamptz, snapshot jsonb NOT NULL DEFAULT '{"evidence":null,"draft":null,"review":null}',
 evidence_hash text, draft_hash text, approval jsonb, ever_approved boolean NOT NULL DEFAULT false, reason text NOT NULL DEFAULT 'not_collected', updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(octet_length(snapshot::text)<=180000)
);
ALTER TABLE company_business_private.jobs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS company_business_due ON company_business_private.jobs(next_attempt_at,priority,symbol);
CREATE TABLE IF NOT EXISTS company_business_private.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, symbol text NOT NULL, fence bigint NOT NULL,
 action text NOT NULL, evidence_hash text, draft_hash text, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS company_business_audit_age ON company_business_private.audit(recorded_at);
ALTER TABLE company_business_private.control ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_business_private.days ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_business_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_business_private.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA company_business_private FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.seed_company_business(p_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,company_business_private AS $$
DECLARE n integer;
BEGIN
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>500 THEN RAISE EXCEPTION 'invalid inventory batch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r->>'symbol' IS NULL OR r->>'symbol' !~ '^[A-Z0-9^.=-]{1,32}$' OR (r->>'priority')::integer NOT BETWEEN 0 AND 2) THEN RAISE EXCEPTION 'invalid inventory row'; END IF;
 INSERT INTO jobs(symbol,priority) SELECT r->>'symbol',(r->>'priority')::integer FROM jsonb_array_elements(p_rows) r ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

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
  ORDER BY (approval IS NOT NULL) DESC,(snapshot->'draft'<>'null'::jsonb) DESC,priority,next_attempt_at,symbol FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO days(day,jobs) VALUES(today,1) ON CONFLICT(day) DO UPDATE SET jobs=days.jobs+1;
 UPDATE jobs SET owner=p_owner,fence=fence+1,attempts=attempts+1,lease_until=clock_timestamp()+interval '5 minutes',
  next_attempt_at=clock_timestamp()+interval '30 minutes',state='collecting' WHERE symbol=j.symbol RETURNING * INTO j;
 RETURN jsonb_build_object('symbol',j.symbol,'owner',j.owner,'fence',j.fence,'snapshot',j.snapshot);
END $$;

CREATE OR REPLACE FUNCTION public.checkpoint_company_business(p_symbol text,p_owner uuid,p_fence bigint,p_snapshot jsonb,p_state text,p_reason text,p_evidence_hash text,p_draft_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,company_business_private AS $$
DECLARE j jobs%ROWTYPE; keep_approval boolean; finished boolean; next_time timestamptz;
BEGIN
 IF p_state NOT IN ('collecting','review_pending','approval_pending','blocked') OR length(p_reason)>240 OR p_reason !~ '^[a-zA-Z0-9_:,.-]+$'
  OR jsonb_typeof(p_snapshot)<>'object' OR octet_length(p_snapshot::text)>180000
  OR (p_evidence_hash IS NOT NULL AND p_evidence_hash !~ '^[a-f0-9]{64}$') OR (p_draft_hash IS NOT NULL AND p_draft_hash !~ '^[a-f0-9]{64}$')
 THEN RAISE EXCEPTION 'invalid checkpoint'; END IF;
 SELECT * INTO j FROM jobs WHERE symbol=p_symbol FOR UPDATE;
 IF NOT FOUND OR j.owner IS DISTINCT FROM p_owner OR j.fence<>p_fence OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RETURN false; END IF;
 IF p_snapshot->'draft' <> 'null'::jsonb AND (p_snapshot#>>'{draft,symbol}' IS DISTINCT FROM p_symbol OR p_snapshot#>>'{draft,evidenceHash}' IS DISTINCT FROM p_evidence_hash) THEN RAISE EXCEPTION 'draft binding mismatch'; END IF;
 IF p_snapshot->'review' <> 'null'::jsonb AND (p_snapshot#>>'{review,draftHash}' IS DISTINCT FROM p_draft_hash OR p_snapshot#>>'{review,evidenceHash}' IS DISTINCT FROM p_evidence_hash) THEN RAISE EXCEPTION 'review binding mismatch'; END IF;
 keep_approval = j.approval IS NOT NULL AND j.evidence_hash IS NOT DISTINCT FROM p_evidence_hash AND j.draft_hash IS NOT DISTINCT FROM p_draft_hash
   AND p_reason NOT IN ('issuer_mapping_changed','issuer_ambiguous','issuer_not_found','business_evidence_invalid','business_evidence_rejected','business_section_unconfirmed','business_passages_insufficient','dart_document_identity_unconfirmed');
 finished=p_state IN ('approval_pending','blocked');
 next_time=CASE WHEN p_state='approval_pending' THEN clock_timestamp()+interval '7 days' WHEN p_state='blocked' AND p_reason='business_model_blocked_limit_reached' THEN ((date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day 5 minutes') AT TIME ZONE 'UTC') WHEN p_state='blocked' AND j.attempts>=3 THEN clock_timestamp()+interval '30 days' WHEN p_state='blocked' THEN clock_timestamp()+interval '1 day' ELSE j.next_attempt_at END;
 UPDATE jobs SET snapshot=p_snapshot,evidence_hash=p_evidence_hash,draft_hash=p_draft_hash,
  approval=CASE WHEN keep_approval THEN approval ELSE NULL END,
  state=CASE WHEN p_state='approval_pending' AND keep_approval THEN 'published' ELSE p_state END,
  reason=p_reason,next_attempt_at=next_time,updated_at=clock_timestamp(),
  attempts=CASE WHEN p_state='approval_pending' THEN 0 WHEN p_reason='business_model_blocked_limit_reached' THEN greatest(attempts-1,0) WHEN p_evidence_hash IS NOT NULL AND j.evidence_hash IS DISTINCT FROM p_evidence_hash THEN 1 ELSE attempts END,
  owner=CASE WHEN finished THEN NULL ELSE owner END,lease_until=CASE WHEN finished THEN NULL ELSE lease_until END WHERE symbol=p_symbol;
 IF finished THEN
  INSERT INTO audit(symbol,fence,action,evidence_hash,draft_hash) VALUES(p_symbol,p_fence,p_reason,p_evidence_hash,p_draft_hash);
  DELETE FROM audit WHERE id IN(SELECT id FROM audit WHERE recorded_at<clock_timestamp()-interval '90 days' ORDER BY recorded_at LIMIT 100);
 END IF;
 RETURN true;
END $$;

-- Called by an explicit editorial action, never by the collection/generation worker.
CREATE OR REPLACE FUNCTION public.approve_company_business(p_symbol text,p_evidence_hash text,p_draft_hash text,p_review jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,company_business_private AS $$
DECLARE j jobs%ROWTYPE;
BEGIN
 SELECT * INTO j FROM jobs WHERE symbol=p_symbol FOR UPDATE;
 IF NOT FOUND OR j.state<>'approval_pending' OR j.lease_until>clock_timestamp() OR j.evidence_hash IS DISTINCT FROM p_evidence_hash OR j.draft_hash IS DISTINCT FROM p_draft_hash
  OR j.snapshot#>>'{review,draftHash}' IS DISTINCT FROM p_draft_hash OR j.snapshot#>>'{review,evidenceHash}' IS DISTINCT FROM p_evidence_hash
  OR j.snapshot#>>'{review,identityMatches}' IS DISTINCT FROM 'true' OR j.snapshot#>>'{review,noUnsupportedClaims}' IS DISTINCT FROM 'true'
  OR (j.snapshot#>>'{evidence,retrievedAt}')::timestamptz<clock_timestamp()-interval '8 days' THEN RETURN false; END IF;
 IF jsonb_typeof(p_review)<>'object' OR octet_length(p_review::text)>4000 OR p_review->>'kind' IS DISTINCT FROM 'editorial'
  OR p_review->>'identityChecked' IS DISTINCT FROM 'true' OR p_review->>'claimsChecked' IS DISTINCT FROM 'true'
  OR p_review->>'beginnerChecked' IS DISTINCT FROM 'true' OR length(coalesce(p_review->>'note',''))<20 THEN RAISE EXCEPTION 'editorial review required'; END IF;
 UPDATE jobs SET ever_approved=true,approval=p_review||jsonb_build_object('evidenceHash',p_evidence_hash,'draftHash',p_draft_hash,'approvedAt',clock_timestamp()),state='published',reason='editorially_approved' WHERE symbol=p_symbol;
 INSERT INTO audit(symbol,fence,action,evidence_hash,draft_hash) VALUES(p_symbol,j.fence,'editorially_approved',p_evidence_hash,p_draft_hash);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.read_company_business(p_symbol text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,company_business_private AS $$
 SELECT (SELECT CASE WHEN c.publication_enabled AND j.approval IS NOT NULL
 AND j.approval->>'evidenceHash'=j.evidence_hash AND j.approval->>'draftHash'=j.draft_hash
 AND (j.snapshot#>>'{evidence,retrievedAt}')::timestamptz>clock_timestamp()-interval '8 days'
 AND (j.snapshot#>>'{evidence,publishedAt}')::timestamptz>clock_timestamp()-interval '550 days'
 THEN jsonb_build_object('snapshot',j.snapshot,'approval',j.approval)
 WHEN j.ever_approved THEN jsonb_build_object('withheld',true) ELSE NULL END
 FROM jobs j WHERE j.symbol=p_symbol)
 FROM control c WHERE id=true;
$$;

CREATE OR REPLACE FUNCTION public.company_business_status() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,company_business_private AS $$
 SELECT jsonb_build_object('workerEnabled',c.worker_enabled,'publicationEnabled',c.publication_enabled,'dailyJobs',c.daily_jobs,'modelUntil',c.model_until,
 'total',(SELECT count(*) FROM jobs),'states',(SELECT coalesce(jsonb_object_agg(state,n),'{}'::jsonb) FROM(SELECT state,count(*) n FROM jobs GROUP BY state)s),
 'todayJobs',(SELECT coalesce(sum(jobs),0) FROM days WHERE day=(clock_timestamp() AT TIME ZONE 'UTC')::date),
 'coverage',(SELECT jsonb_build_object('sourceCollected',count(*) FILTER(WHERE snapshot->'evidence'<>'null'::jsonb),
  'drafted',count(*) FILTER(WHERE snapshot->'draft'<>'null'::jsonb),'modelReviewed',count(*) FILTER(WHERE snapshot->'review'<>'null'::jsonb),
  'editoriallyApproved',count(*) FILTER(WHERE approval IS NOT NULL),
  'publishedFresh',count(*) FILTER(WHERE c.publication_enabled AND approval IS NOT NULL
    AND approval->>'evidenceHash'=evidence_hash AND approval->>'draftHash'=draft_hash
    AND (snapshot#>>'{evidence,retrievedAt}')::timestamptz>clock_timestamp()-interval '8 days'
    AND (snapshot#>>'{evidence,publishedAt}')::timestamptz>clock_timestamp()-interval '550 days')) FROM jobs),
 'recent',(SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM(SELECT symbol,state,reason,updated_at FROM jobs WHERE fence>0 ORDER BY updated_at DESC LIMIT 12)r)) FROM control c WHERE id=true;
$$;

REVOKE ALL ON FUNCTION public.seed_company_business(jsonb),public.claim_company_business(uuid,text,text),public.checkpoint_company_business(text,uuid,bigint,jsonb,text,text,text,text),public.approve_company_business(text,text,text,jsonb),public.read_company_business(text),public.company_business_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seed_company_business(jsonb),public.claim_company_business(uuid,text,text),public.checkpoint_company_business(text,uuid,bigint,jsonb,text,text,text,text),public.approve_company_business(text,text,text,jsonb),public.read_company_business(text),public.company_business_status() TO service_role;
