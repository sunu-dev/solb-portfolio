import { NextResponse } from 'next/server';
import { getStockCatalog } from '@/lib/stockCatalog';

export async function GET() {
  const catalog = await getStockCatalog();
  return NextResponse.json(catalog, { headers: {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  } });
}
