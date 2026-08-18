import { NextResponse } from 'next/server';
import { PRO_PLAN } from '@/config/proPlan';
import { buildProReadiness } from '@/lib/proReadiness';
import { TIER_LIMITS } from '@/lib/userTier';
import { defineRoute } from '@/lib/apiRoute';

export const GET = defineRoute({
  name: '/api/admin/pro-readiness',
  auth: 'admin',
  handler: async () => NextResponse.json({
    plan: PRO_PLAN,
    readiness: buildProReadiness(process.env),
    aiLimits: TIER_LIMITS,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  }),
});
