import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { processDigestQueue } from '@/lib/digestDelivery';
import { sendCronAlert } from '@/lib/cronAlert';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const GET = defineRoute({
  name: '/api/cron/digest-retry', auth: 'cron', rateLimit: false,
  handler: async () => {
    try { return NextResponse.json({ ok: true, ...await processDigestQueue() }); }
    catch {
      await sendCronAlert({ jobName: 'digest-retry', stage: 'worker', error: 'Digest worker could not complete; inspect queue leases and pending failures' });
      return NextResponse.json({ ok: false, error: 'digest_worker_failed' }, { status: 500 });
    }
  },
});
