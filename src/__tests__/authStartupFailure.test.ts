import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({effects:[] as Array<()=>void|(()=>void)>,values:[] as unknown[],index:0,getSession:vi.fn(),listen:vi.fn(),reset:vi.fn(),clear:vi.fn(),demo:vi.fn(),preserve:vi.fn()}));
vi.mock('react',()=>({useState:(value:unknown)=>{const i=m.index++;m.values[i]=value;return [value,(next:unknown)=>{m.values[i]=typeof next==='function'?(next as (p:unknown)=>unknown)(m.values[i]):next}]},useRef:(current:unknown)=>({current}),useCallback:(fn:unknown)=>fn,useEffect:(fn:()=>void|(()=>void))=>m.effects.push(fn)}));
vi.mock('@/lib/supabase',()=>({supabase:{auth:{getSession:m.getSession,onAuthStateChange:m.listen}}}));
vi.mock('@/lib/userStorage',()=>({clearUserStorage:m.clear}));
vi.mock('@/lib/portfolioIdentity',()=>({preserveUnsyncedPortfolio:m.preserve}));
vi.mock('@/store/portfolioStore',()=>({usePortfolioStore:{getState:()=>({resetPortfolio:m.reset,clearGuestDemo:m.demo,portfolioSyncStatus:'error'}),persist:{getOptions:()=>({partialize:()=>({portfolioOwnerId:'A',stocks:{investing:[{symbol:'AAPL',shares:2}]}})})}}}));
import {useAuth as invokeAuthHarness} from '@/hooks/useAuth';
let cleanup:(()=>void)|undefined;
let event:((type:string,session:unknown)=>void)|undefined;
beforeEach(()=>{vi.clearAllMocks();m.preserve.mockReset();vi.useFakeTimers();vi.stubGlobal('localStorage',{});vi.stubGlobal('window',{location:{reload:vi.fn()}});m.index=0;m.effects=[];m.values=[];m.listen.mockImplementation((listener)=>{event=listener;return {data:{subscription:{unsubscribe:vi.fn()}}}})});
afterEach(()=>{cleanup?.();vi.useRealTimers();vi.unstubAllGlobals()});
// React hooks are replaced by the deterministic harness above.
function mount(){const auth=invokeAuthHarness();cleanup=m.effects[0]()||undefined;return auth}
describe('authentication startup boundary',()=>{
 it('recovers from a rejected lookup without clearing or adopting a portfolio',async()=>{
  m.getSession.mockRejectedValue(Error('offline'));const auth=mount();await vi.advanceTimersByTimeAsync(0);
  expect(m.values[2]).toBe(false);expect(m.values[3]).toBe(true);expect(m.clear).not.toHaveBeenCalled();expect(m.reset).not.toHaveBeenCalled();
  auth.retry();expect(window.location.reload).toHaveBeenCalledOnce();expect(m.getSession).toHaveBeenCalledOnce();expect(m.clear).not.toHaveBeenCalled();expect(m.reset).not.toHaveBeenCalled();
 });
 it('shows a retryable error while waiting but recovers when the same lookup succeeds late',async()=>{
  let finish!:(value:unknown)=>void;m.getSession.mockReturnValue(new Promise(resolve=>{finish=resolve}));mount();
  await vi.advanceTimersByTimeAsync(6000);expect(m.values[3]).toBe(true);
  finish({data:{session:{user:{id:'old'}}}});await vi.advanceTimersByTimeAsync(0);expect(m.values[0]).toEqual({id:'old'});expect(m.values[3]).toBe(false);expect(m.reset).not.toHaveBeenCalled();
 });
 it('does not turn an initial null event during a network failure into a guest',async()=>{
  m.getSession.mockRejectedValue(Error('offline'));mount();event?.('INITIAL_SESSION',null);await vi.advanceTimersByTimeAsync(0);
  expect(m.values[3]).toBe(true);expect(m.clear).not.toHaveBeenCalled();expect(m.reset).not.toHaveBeenCalled();
 });
 it('still opens a genuine guest after a successful empty session lookup',async()=>{
  m.getSession.mockResolvedValue({data:{session:null},error:null});mount();event?.('INITIAL_SESSION',null);await vi.advanceTimersByTimeAsync(0);
  expect(m.values[2]).toBe(false);expect(m.values[3]).toBe(false);
 });
 it('does not resurrect a timed-out lookup after a newer sign-out event',async()=>{
  let finish!:(value:unknown)=>void;m.getSession.mockReturnValue(new Promise(resolve=>{finish=resolve}));mount();
  await vi.advanceTimersByTimeAsync(6000);event?.('SIGNED_OUT',null);finish({data:{session:{user:{id:'old'}}},error:null});await vi.advanceTimersByTimeAsync(0);
  expect(m.values[0]).toBeNull();expect(m.values[3]).toBe(false);
 });
 it('keeps a newer auth event when the initial lookup resolves late',async()=>{
  let finish!:(value:unknown)=>void;m.getSession.mockReturnValue(new Promise(resolve=>{finish=resolve}));mount();
  event?.('SIGNED_IN',{user:{id:'new'}});finish({data:{session:{user:{id:'old'}}}});await vi.advanceTimersByTimeAsync(12000);
  expect(m.values[0]).toEqual({id:'new'});expect(m.values[3]).toBe(false);
 });
 it('treats session lookup errors as failure even if a payload exists',async()=>{
  m.getSession.mockResolvedValue({data:{session:null},error:Error('locked')});mount();await vi.advanceTimersByTimeAsync(0);expect(m.values[3]).toBe(true);
 });
 it('quarantines data on actual account switch and signout events',async()=>{
  m.getSession.mockResolvedValue({data:{session:{user:{id:'A'}}},error:null});mount();await vi.advanceTimersByTimeAsync(0);
  event?.('SIGNED_IN',{user:{id:'B'}});expect(m.reset).toHaveBeenCalledTimes(1);event?.('SIGNED_OUT',null);expect(m.reset).toHaveBeenCalledTimes(2);
 });
 it('preserves pending edits before clearing the outgoing account',async()=>{
  const order:string[]=[];m.preserve.mockImplementation(()=>order.push('preserve'));m.clear.mockImplementation(()=>order.push('clear'));
  m.getSession.mockResolvedValue({data:{session:{user:{id:'A'}}},error:null});mount();await vi.advanceTimersByTimeAsync(0);
  event?.('SIGNED_OUT',null);
  expect(order).toEqual(['preserve','clear']);expect(m.preserve).toHaveBeenCalledWith('A',expect.any(Object),'error',expect.any(Object));
 });
 it('closes the identity boundary without deleting pending edits when their recovery copy cannot be saved',async()=>{
  m.preserve.mockImplementation(()=>{throw Error('quota')});
  m.getSession.mockResolvedValue({data:{session:{user:{id:'A'}}},error:null});const auth=mount();await vi.advanceTimersByTimeAsync(0);
  event?.('SIGNED_IN',{user:{id:'B'}});
  expect(m.values[3]).toBe(true);expect(m.values[0]).toEqual({id:'A'});expect(m.clear).not.toHaveBeenCalled();expect(m.reset).not.toHaveBeenCalled();
  await auth.signOut();expect(m.clear).not.toHaveBeenCalled();expect(m.reset).not.toHaveBeenCalled();
  auth.retry();expect(window.location.reload).not.toHaveBeenCalled();
 });
});
