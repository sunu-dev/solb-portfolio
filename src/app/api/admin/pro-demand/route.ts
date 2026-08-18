import { NextResponse } from 'next/server';
import { evaluateFakeDoorExperiment } from '@/lib/proDemandValidation';
import { defineRoute } from '@/lib/apiRoute';
import { getServiceClient } from '@/lib/supabaseServer';

interface DemandEventRow {
  user_id: string;
  event: string;
}

export const GET = defineRoute({
  name: '/api/admin/pro-demand',
  auth: 'admin',
  handler: async () => {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: 'storage unavailable' }, { status: 503 });

  const cohort = (process.env.PRO_DEMAND_COHORT || 'tools-v1').slice(0, 32);
  const requested = process.env.PRO_DEMAND_TEST_ENABLED === 'true';
  const policyReady = process.env.PRO_DEMAND_POLICY_READY === 'true';
  const { data, error } = await supabase
    .from('pro_demand_events')
    .select('user_id, event')
    .eq('cohort', cohort)
    .limit(5000);

  if (error) {
    return NextResponse.json({
      available: false,
      requested,
      policyReady,
      enabled: false,
      cohort,
      reason: 'migration_not_applied_or_query_failed',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const byEvent = new Map<string, Set<string>>();
  for (const row of (data || []) as DemandEventRow[]) {
    if (!byEvent.has(row.event)) byEvent.set(row.event, new Set());
    byEvent.get(row.event)!.add(row.user_id);
  }
  const count = (event: string) => byEvent.get(event)?.size || 0;
  const eligibleExposures = count('pro_offer_exposed');
  const startClicks = count('pro_start_clicked');
  const waitlistSubmissions = count('pro_waitlist_submitted');

  return NextResponse.json({
    available: true,
    requested,
    policyReady,
    enabled: requested && policyReady,
    cohort,
    counts: {
      eligibleExposures,
      offerOpened: count('pro_offer_opened'),
      offerDismissed: count('pro_offer_dismissed'),
      startClicks,
      waitlistSubmissions,
    },
    rates: {
      start: eligibleExposures ? startClicks / eligibleExposures : 0,
      waitlist: eligibleExposures ? waitlistSubmissions / eligibleExposures : 0,
    },
    verdict: evaluateFakeDoorExperiment({ eligibleExposures, startClicks, waitlistSubmissions }),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
},
});
