BEGIN;
ALTER TABLE market_cause_private.publication_control
 ADD COLUMN IF NOT EXISTS company_facts boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS narrative_release jsonb;
-- Fixed sixteen heads only, behind a service-only function. No user rows or raw
-- provider errors. A null certificate avoids reading narrative payloads at all.
CREATE OR REPLACE FUNCTION public.read_market_cause_companies()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('enabled',c.company_facts,'release',c.narrative_release,
  'snapshots',CASE WHEN c.company_facts THEN COALESCE((
   SELECT jsonb_agg(jsonb_build_object('symbol',split_part(h.event_key,':',2),
    'kind',split_part(h.event_key,':',1),'snapshot',v.payload->'snapshot'))
   FROM market_cause_private.shadow_heads h JOIN market_cause_private.shadow_versions v ON v.id=h.result_id
   WHERE h.event_key = ANY(ARRAY['facts:INTC','facts:NVDA','facts:AMD','facts:AMZN','facts:GOOGL','facts:MSFT','facts:META','facts:AAPL'])
    OR (c.narrative_release IS NOT NULL AND h.event_key = ANY(ARRAY['sec:INTC','sec:NVDA','sec:AMD','sec:AMZN','sec:GOOGL','sec:MSFT','sec:META','sec:AAPL']))
  ),'[]'::jsonb) ELSE '[]'::jsonb END)
 FROM market_cause_private.publication_control c WHERE c.id=true
$$;
REVOKE ALL ON FUNCTION public.read_market_cause_companies() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_market_cause_companies() TO service_role;
COMMIT;
