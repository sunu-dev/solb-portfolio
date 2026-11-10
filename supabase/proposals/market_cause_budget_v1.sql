-- PROPOSAL ONLY. Not installed in production. Off until evaluated and configured.
-- Fixed feature, integer USD micro-units. No portfolio data or model content.
BEGIN;
CREATE SCHEMA IF NOT EXISTS market_cause_private;
REVOKE ALL ON SCHEMA market_cause_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS market_cause_private.budget_control (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 daily_limit bigint NOT NULL DEFAULT 0 CHECK(daily_limit>=0),
 monthly_limit bigint NOT NULL DEFAULT 0 CHECK(monthly_limit>=0),
 daily_calls integer NOT NULL DEFAULT 160 CHECK(daily_calls BETWEEN 1 AND 10000),
 stopped_reason text
);
INSERT INTO market_cause_private.budget_control(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS market_cause_private.budget_periods (
 period_kind text NOT NULL CHECK(period_kind IN ('day','month')), period_start date NOT NULL,
 reserved bigint NOT NULL DEFAULT 0 CHECK(reserved>=0), spent bigint NOT NULL DEFAULT 0 CHECK(spent>=0),
 calls integer NOT NULL DEFAULT 0 CHECK(calls>=0), PRIMARY KEY(period_kind,period_start)
);
CREATE TABLE IF NOT EXISTS market_cause_private.budget_reservations (
 request_key text PRIMARY KEY CHECK(length(request_key) BETWEEN 1 AND 200), token uuid NOT NULL UNIQUE,
 max_cost bigint NOT NULL CHECK(max_cost BETWEEN 1 AND 1000000000), actual_cost bigint CHECK(actual_cost BETWEEN 0 AND 1000000000),
 state text NOT NULL CHECK(state IN ('reserved','settled')),
 day_start date NOT NULL, month_start date NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), settled_at timestamptz
);
ALTER TABLE market_cause_private.budget_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_cause_private.budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_cause_private.budget_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA market_cause_private FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.reserve_market_cause_budget(p_request_key text,p_max_cost bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c market_cause_private.budget_control%ROWTYPE;
 t timestamptz := clock_timestamp();
 d date := (t AT TIME ZONE 'UTC')::date;
 m date := date_trunc('month',t AT TIME ZONE 'UTC')::date;
 day_row market_cause_private.budget_periods%ROWTYPE;
 month_row market_cause_private.budget_periods%ROWTYPE;
 reservation_token uuid;
BEGIN
 IF p_request_key IS NULL OR p_request_key !~ '^[a-zA-Z0-9:_./-]{1,200}$'
 OR p_max_cost IS NULL OR p_max_cost NOT BETWEEN 1 AND 1000000000 THEN RAISE EXCEPTION 'invalid budget reservation' USING ERRCODE='22023'; END IF;
 -- One fixed control row serializes reserve/settle, including the UTC day boundary.
 SELECT * INTO c FROM market_cause_private.budget_control WHERE id=true FOR UPDATE;
 IF NOT FOUND OR NOT c.enabled OR c.daily_limit=0 OR c.monthly_limit=0 THEN RETURN jsonb_build_object('status','disabled'); END IF;
 IF EXISTS(SELECT 1 FROM market_cause_private.budget_reservations WHERE request_key=p_request_key) THEN
  -- Never authorize a second network call by returning the original token.
  RETURN jsonb_build_object('status','already_reserved');
 END IF;
 INSERT INTO market_cause_private.budget_periods(period_kind,period_start) VALUES('day',d),('month',m) ON CONFLICT DO NOTHING;
 SELECT * INTO day_row FROM market_cause_private.budget_periods WHERE period_kind='day' AND period_start=d;
 SELECT * INTO month_row FROM market_cause_private.budget_periods WHERE period_kind='month' AND period_start=m;
 IF day_row.calls>=c.daily_calls OR day_row.reserved+day_row.spent+p_max_cost>c.daily_limit
 OR month_row.reserved+month_row.spent+p_max_cost>c.monthly_limit THEN RETURN jsonb_build_object('status','limit_reached'); END IF;
 reservation_token := gen_random_uuid();
 INSERT INTO market_cause_private.budget_reservations(request_key,token,max_cost,state,day_start,month_start)
 VALUES(p_request_key,reservation_token,p_max_cost,'reserved',d,m);
 UPDATE market_cause_private.budget_periods SET reserved=reserved+p_max_cost,calls=calls+1
 WHERE (period_kind='day' AND period_start=d) OR (period_kind='month' AND period_start=m);
 RETURN jsonb_build_object('status','reserved','token',reservation_token,'maxCost',p_max_cost);
END $$;

CREATE OR REPLACE FUNCTION public.settle_market_cause_budget(p_request_key text,p_token uuid,p_actual_cost bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r market_cause_private.budget_reservations%ROWTYPE;
BEGIN
 IF p_actual_cost IS NULL OR p_actual_cost NOT BETWEEN 0 AND 1000000000 THEN RAISE EXCEPTION 'invalid actual cost' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM market_cause_private.budget_control WHERE id=true FOR UPDATE;
 SELECT * INTO r FROM market_cause_private.budget_reservations WHERE request_key=p_request_key AND token=p_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF r.state='settled' THEN RETURN r.actual_cost=p_actual_cost; END IF;
 UPDATE market_cause_private.budget_periods SET reserved=reserved-r.max_cost,spent=spent+p_actual_cost
 WHERE (period_kind='day' AND period_start=r.day_start) OR (period_kind='month' AND period_start=r.month_start);
 UPDATE market_cause_private.budget_reservations SET state='settled',actual_cost=p_actual_cost,settled_at=clock_timestamp() WHERE request_key=p_request_key;
 -- Preserve observed spend even if an upstream estimate was wrong; stop new calls.
 IF p_actual_cost>r.max_cost THEN UPDATE market_cause_private.budget_control SET enabled=false,stopped_reason='reservation_exceeded' WHERE id=true; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_market_cause_budget(text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.settle_market_cause_budget(text,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_market_cause_budget(text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_market_cause_budget(text,uuid,bigint) TO service_role;
COMMIT;
