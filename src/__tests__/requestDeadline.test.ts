import {afterEach,expect,it,vi} from 'vitest';
import {withDeadline} from '@/lib/withDeadline';
import {resolveInviteAccess} from '@/lib/inviteAccess';
import type {SupabaseClient} from '@supabase/supabase-js';
afterEach(()=>vi.useRealTimers());
it('cleans the deadline when the prerequisite completes',async()=>{vi.useFakeTimers();await expect(withDeadline(Promise.resolve('ready'))).resolves.toBe('ready');expect(vi.getTimerCount()).toBe(0)});
it('returns an invite error rather than opening the workspace on a stalled session',async()=>{
 vi.useFakeTimers();const client={auth:{getSession:()=>new Promise(()=>{})}} as unknown as SupabaseClient;
 const result=resolveInviteAccess(client,'A');await vi.advanceTimersByTimeAsync(18000);expect(await result).toBe('error');expect(vi.getTimerCount()).toBe(0);
});
