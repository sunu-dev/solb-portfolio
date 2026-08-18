import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRO_PLAN } from '@/config/proPlan';
import { resolveProEntitlements } from '@/lib/proEntitlements';
import { getTierLimits, getUserTier } from '@/lib/userTier';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || '';
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

  const tier = await getUserTier(user.id);
  return NextResponse.json({
    tier,
    planId: tier === 'pro' ? PRO_PLAN.id : null,
    entitlements: resolveProEntitlements(tier),
    investmentAccess: getTierLimits(tier),
    salesEnabled: process.env.PRO_TOOLS_SALES_ENABLED === 'true',
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
