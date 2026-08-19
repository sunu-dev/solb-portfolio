'use client';

import { PRO_PLAN } from '@/config/proPlan';
import { supabase } from '@/lib/supabase';
import type { ProDemandEventName, ProDemandPlacement } from '@/lib/proDemandValidation';

export interface ProDemandRuntimeConfig {
  enabled: boolean;
  cohort: string;
  monthlyPriceKrw: number;
}

export async function loadProDemandRuntimeConfig(): Promise<ProDemandRuntimeConfig | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const response = await fetch('/api/pro-demand/config', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return response.json() as Promise<ProDemandRuntimeConfig>;
}

export async function trackProDemandEvent(
  event: ProDemandEventName,
  placement: ProDemandPlacement,
  cohort: string,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch('/api/pro-demand/event', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        event,
        placement,
        cohort,
        priceKrw: PRO_PLAN.monthlyPriceKrw,
      }),
      keepalive: true,
    });
  } catch { /* 수요 측정 실패는 제품 사용을 막지 않음 */ }
}
