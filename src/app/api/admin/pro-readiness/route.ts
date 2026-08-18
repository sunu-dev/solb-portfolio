import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRO_PLAN } from '@/config/proPlan';
import { buildProReadiness } from '@/lib/proReadiness';
import { TIER_LIMITS } from '@/lib/userTier';

const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || !supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!ADMIN_EMAILS.includes(user.email || '') && !ADMIN_IDS.includes(user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    plan: PRO_PLAN,
    readiness: buildProReadiness(process.env),
    aiLimits: TIER_LIMITS,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
