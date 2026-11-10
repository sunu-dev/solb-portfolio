import { NextRequest, NextResponse } from 'next/server';
import { storedIndustryFields } from '@/lib/storedIndustry';
import { readPublishedBusiness } from '@/lib/companyBusiness/store';
import { deliveredCompanyBusiness } from '@/lib/companyBusiness/delivery';
import { getStockCurrency } from '@/utils/stockCurrency';

/** Sourced business coverage and classification. No financial metrics or per-view provider calls. */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9^.=-]{1,32}$/.test(symbol)) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }
  const profile = storedIndustryFields(symbol);
  const published = await readPublishedBusiness(symbol);
  const business = deliveredCompanyBusiness(symbol, profile.classification, published);
  return NextResponse.json({ data: {
    ...profile,
    business,
    currency: getStockCurrency(profile.classification.symbol),
    resolvedSymbol: profile.classification.symbol,
  } }, published.status === 'unavailable'
    ? { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } }
    : { headers: { 'Cache-Control': 'public, s-maxage=60' } });
}
