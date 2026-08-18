import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRO_PLAN } from '@/config/proPlan';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
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
