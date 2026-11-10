import { NextResponse } from 'next/server';
import { defineRoute, POLICIES } from '@/lib/apiRoute';
import { getEconomicFeed } from '@/lib/economicFeed';
import { getEarningsEvents } from '@/lib/earningsEvents';
import { withDeadline } from '@/lib/withDeadline';
export const maxDuration = 30;
export const GET = defineRoute({ name: '/api/economic-events', auth: 'public', rateLimit: POLICIES.general, deferLog: true, handler: async ({ req }) => {
  const symbols = [...new Set((req.nextUrl.searchParams.get('symbols') || '').split(',').filter(Boolean))];
  if (symbols.length > 30 || symbols.some(s => !/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(s))) return NextResponse.json({ error: '종목 목록을 확인해주세요.' }, { status: 400 });
  const from = new Date(Date.now()-45*86400000).toISOString().slice(0,10), to = new Date(Date.now()+100*86400000).toISOString().slice(0,10);
  const usSymbols = symbols.filter(s => !/\.K[SQ]$|^\d{6}$/.test(s));
  const [baseFeed, earnings] = await Promise.all([getEconomicFeed(), Promise.allSettled(usSymbols.map(s => withDeadline(getEarningsEvents(s,from,to), 5500)))]);
  const feed = { ...baseFeed, events: [...baseFeed.events], warnings: [...baseFeed.warnings] };
  earnings.forEach((r,i) => { if (r.status === 'fulfilled') feed.events.push(...r.value); else feed.warnings.push(`${usSymbols[i]} 실적 일정을 확인하지 못했어요.`); });
  if (symbols.length > usSymbols.length) feed.warnings.push('국내 종목 실적 일정은 아직 연결되지 않았어요. 회사 공시를 확인해주세요.');
  return NextResponse.json(feed, { headers: { 'Cache-Control': symbols.length || feed.warnings.length ? 'private, no-store' : 's-maxage=300, stale-while-revalidate=300' } });
} });
