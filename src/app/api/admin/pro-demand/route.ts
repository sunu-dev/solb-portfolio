import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateFakeDoorExperiment } from '@/lib/proDemandValidation';

const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

interface DemandEventRow {
  user_id: string;
  event: string;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || !supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes(user.email || '') && !ADMIN_IDS.includes(user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

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
}
