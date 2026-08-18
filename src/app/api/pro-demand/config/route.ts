import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { PRO_PLAN } from '@/config/proPlan';


export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = getServiceClient();
  if (!token || !supabase) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const requested = process.env.PRO_DEMAND_TEST_ENABLED === 'true';
  const policyReady = process.env.PRO_DEMAND_POLICY_READY === 'true';
  let storageReady = false;
  if (requested && policyReady) {
    const { error } = await supabase
      .from('pro_demand_events')
      .select('event_id', { head: true })
      .limit(1);
    storageReady = !error;
  }

  return NextResponse.json({
    enabled: requested && policyReady && storageReady,
    cohort: (process.env.PRO_DEMAND_COHORT || 'tools-v1').slice(0, 32),
    monthlyPriceKrw: PRO_PLAN.monthlyPriceKrw,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
