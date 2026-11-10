'use client';
import { useSyncExternalStore } from 'react';
import { isNoticeAcknowledged, subscribeNoticeAcknowledgement } from '@/lib/noticeAcknowledgement';
export function useNoticeAcknowledgement(id?: string) {
  return useSyncExternalStore(subscribeNoticeAcknowledgement, () => isNoticeAcknowledged(id), () => false);
}
