import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
export const GET = defineRoute({ name: '/api/admin/company-business', auth: 'admin', handler: async () => {
  const { data, error } = await requireServiceClient().rpc('company_business_status');
  if (error) return NextResponse.json({ error: 'status_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ data, domesticSourceConfigured: !!(process.env.DART_API_KEY || process.env.OPENDART_API_KEY) }, { headers: { 'Cache-Control': 'no-store' } });
} });
