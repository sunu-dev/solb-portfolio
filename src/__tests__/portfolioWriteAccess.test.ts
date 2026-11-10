import { describe, expect, it, vi, afterEach } from 'vitest';
import { portfolioWriteBlockReason, requirePortfolioWriteAccess } from '@/lib/portfolioWriteAccess';
import { usePortfolioStore } from '@/store/portfolioStore';
const ready = { portfolioOwnerId:'qa-user', portfolioCloudLoadStatus:'ready' as const, portfolioSyncStatus:'synced' as const };
afterEach(()=>{vi.unstubAllGlobals();});
describe('개인 기록 변경 진입 경계',()=>{
 it('게스트 또는 소유자 없는 기록의 변경을 로그인으로 안내한다',()=>{
  expect(portfolioWriteBlockReason({...ready, portfolioOwnerId:null})).toBe('login');
  expect(portfolioWriteBlockReason({...ready, portfolioCloudLoadStatus:'guest'})).toBe('login');
 });
 it.each(['loading','error'] as const)('클라우드 %s 중 변경을 막는다',status=>{
  expect(portfolioWriteBlockReason({...ready,portfolioCloudLoadStatus:status})).not.toBeNull();
 });
 it.each(['conflict','storage-error'] as const)('%s 상태의 변경을 막는다',status=>{
  expect(portfolioWriteBlockReason({...ready,portfolioSyncStatus:status})).not.toBeNull();
 });
 it('준비된 본인 기록의 연속 수정은 허용한다',()=>{
  expect(portfolioWriteBlockReason(ready)).toBeNull();
  expect(portfolioWriteBlockReason({...ready,portfolioSyncStatus:'saving'})).toBeNull();
 });
 it('화면을 연 뒤 로그아웃한 경우에도 최신 상태로 승인하지 않는다',()=>{
  const previous=usePortfolioStore.getState();
  const dispatchEvent=vi.fn(), alert=vi.fn();vi.stubGlobal('window',{dispatchEvent,alert});
  try {
   usePortfolioStore.setState(ready);
   expect(requirePortfolioWriteAccess()).toBe(true);
   usePortfolioStore.setState({portfolioOwnerId:null,portfolioCloudLoadStatus:'guest'});
   expect(requirePortfolioWriteAccess()).toBe(false);
   expect(dispatchEvent.mock.calls[0][0].type).toBe('open-login');
   expect(alert).not.toHaveBeenCalled();
  } finally { usePortfolioStore.setState(previous); }
 });
});
