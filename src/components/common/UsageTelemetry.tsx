'use client';
import { useUsageTelemetry } from '@/hooks/useUsageTelemetry';

export default function UsageTelemetry(props: Parameters<typeof useUsageTelemetry>[0]) {
  useUsageTelemetry(props);
  return null;
}
