import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { readMarketWatch } from '@/lib/marketWatchStore';
import { readOfficialPolicies } from '@/lib/marketCause/officialPublication';
import { readCompanyExplanations } from '@/lib/marketCause/companyPublication';
import { attachCompanyExplanations } from '@/lib/marketCause/explanationEngine';

export const GET = defineRoute({ name: '/api/market-watch', auth: 'public', handler: async () => {
  try {
    const [feed, officialPolicies, companies] = await Promise.all([readMarketWatch(), readOfficialPolicies(), readCompanyExplanations()]);
    return NextResponse.json({ ...feed, briefs: attachCompanyExplanations(feed.briefs ?? [], companies.cards), officialPolicies }, { headers: { 'Cache-Control': feed.runs.length
      ? 'public, s-maxage=30, stale-while-revalidate=60' : 'no-store' } });
  } catch {
    return NextResponse.json({ error: '시장 브리핑을 불러오지 못했어요.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
} });
