import { NextResponse } from 'next/server';

/** Old clients must not interpret withdrawn metrics as a successful empty dataset. */
export async function GET() {
  return NextResponse.json({ data: null, error: 'financial_metrics_retired' }, {
    status: 410, headers: { 'Cache-Control': 'no-store' },
  });
}
