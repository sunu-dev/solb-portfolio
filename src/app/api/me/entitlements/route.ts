import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, getServiceClient } from '@/lib/supabaseServer';
import { PRO_PLAN } from '@/config/proPlan';
import { resolveProEntitlements } from '@/lib/proEntitlements';
import { getTierLimits, getUserTier } from '@/lib/userTier';


export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = getServiceClient() ?? getAuthClient();
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
