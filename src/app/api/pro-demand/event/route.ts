import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRO_PLAN } from '@/config/proPlan';
import {
  isProDemandPlacement,
  PRO_DEMAND_EVENT_SET,
  type ProDemandEventName,
} from '@/lib/proDemandValidation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;
const MAX_EVENTS_PER_MINUTE = 20;

interface ProDemandEventBody {
  eventId?: unknown;
  event?: unknown;
  placement?: unknown;
  cohort?: unknown;
  priceKrw?: unknown;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: NextRequest) {
  if (process.env.PRO_DEMAND_TEST_ENABLED !== 'true'
    || process.env.PRO_DEMAND_POLICY_READY !== 'true'
    || !supabase) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: ProDemandEventBody;
  try {
    body = await req.json() as ProDemandEventBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const expectedCohort = (process.env.PRO_DEMAND_COHORT || 'tools-v1').slice(0, 32);
  if (!isUuid(body.eventId)
    || typeof body.event !== 'string'
    || !PRO_DEMAND_EVENT_SET.has(body.event)
    || !isProDemandPlacement(body.placement)
    || body.cohort !== expectedCohort
    || body.priceKrw !== PRO_PLAN.monthlyPriceKrw) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await supabase
    .from('pro_demand_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if (countError) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  if ((count || 0) >= MAX_EVENTS_PER_MINUTE) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
  }

  const { error } = await supabase.from('pro_demand_events').insert({
    event_id: body.eventId,
    user_id: user.id,
    event: body.event as ProDemandEventName,
    placement: body.placement,
    cohort: expectedCohort,
    price_krw: PRO_PLAN.monthlyPriceKrw,
  });
  if (error) {
    if (error.code === '23505') return new NextResponse(null, { status: 204 });
    console.error('[pro-demand] insert failed:', error.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
