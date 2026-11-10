import { usePortfolioStore } from '@/store/portfolioStore';

type WriteState = Pick<ReturnType<typeof usePortfolioStore.getState>,
  'portfolioOwnerId' | 'portfolioCloudLoadStatus' | 'portfolioSyncStatus'>;

export function portfolioWriteBlockReason(state: WriteState): string | null {
  if (!state.portfolioOwnerId || state.portfolioCloudLoadStatus === 'guest') return 'login';
  if (state.portfolioCloudLoadStatus === 'loading') return '기존 기록을 불러온 뒤 변경할 수 있어요. 잠시만 기다려주세요.';
  if (state.portfolioCloudLoadStatus === 'error') return '기존 기록을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.';
  if (state.portfolioSyncStatus === 'conflict') return '다른 기기의 기록과 충돌했어요. 기록·가져오기·복구에서 사용할 기록을 먼저 선택해주세요.';
  if (state.portfolioSyncStatus === 'storage-error') return '이 기기에 기록을 안전하게 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해주세요.';
  return null;
}

/** 사용자 조작 시 최신 계정·동기화 상태를 다시 검사한다. 샘플 체험에는 사용하지 않는다. */
export function requirePortfolioWriteAccess(): boolean {
  const reason = portfolioWriteBlockReason(usePortfolioStore.getState());
  if (!reason) return true;
  if (reason === 'login') window.dispatchEvent(new CustomEvent('open-login'));
  else window.alert(reason);
  return false;
}
