'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { usePortfolioStore } from '@/store/portfolioStore';
import { clearUserStorage } from '@/lib/userStorage';
import { AGE_GATE_VERSION } from '@/config/legalVersions';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // 정합성 결함 C2-data 수정 — 직전 user.id 추적해 계정 전환 감지
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      prevUserIdRef.current = uid;
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      const prevId = prevUserIdRef.current;
      const newId = newSession?.user?.id ?? null;

      // 계정 전환(A → B) 감지 시 이전 사용자 데이터 즉시 정리.
      // 직접 OAuth 전환·다른 탭 로그인 등 signOut 미경유 케이스 대응.
      // anon → 로그인(prev=null, new=non-null)은 사용자 데이터 이전을 위해 keep.
      if (prevId && newId && prevId !== newId) {
        // eslint-disable-next-line no-console
        console.log('[useAuth] 계정 전환 감지 — 이전 데이터 정리');
        clearUserStorage();
        usePortfolioStore.getState().resetPortfolio();
      }

      // 로그아웃 감지(prev=non-null, new=null) — 다른 탭 로그아웃·토큰 만료·signOut 실패
      // 시점에도 로컬 데이터 잔존 차단. signOut() 호출도 결국 이 listener를 거치므로
      // 어떤 경로든 일관된 정리 보장.
      if (prevId && !newId) {
        // eslint-disable-next-line no-console
        console.log('[useAuth] 로그아웃 감지 — 로컬 데이터 정리');
        clearUserStorage();
        usePortfolioStore.getState().resetPortfolio();
      }

      // 신규 로그인 (anon → authenticated): LoginModal에서 동의한 내용을 user_consents에 INSERT
      // BLOCKER #10 — 동의 시점 DB 로깅 (분쟁 1순위 증거)
      if (!prevId && newId) {
        // 게스트 체험 데모(demo:true)는 계정으로 이전 금지 — 로컬 keep 정책 전에 먼저 제거.
        usePortfolioStore.getState().clearGuestDemo();
        try {
          const pending = sessionStorage.getItem('solb_consent_pending');
          if (pending) {
            const consent = JSON.parse(pending) as {
              age_14_plus: boolean;
              terms: string;
              privacy: string;
              ts: string;
            };
            await supabase.from('user_consents').upsert(
              [
                { user_id: newId, consent_type: 'age_14_plus', version: AGE_GATE_VERSION, agreed_at: consent.ts },
                { user_id: newId, consent_type: 'terms', version: consent.terms, agreed_at: consent.ts },
                { user_id: newId, consent_type: 'privacy', version: consent.privacy, agreed_at: consent.ts },
              ],
              { onConflict: 'user_id,consent_type,version', ignoreDuplicates: true },
            );
            sessionStorage.removeItem('solb_consent_pending');
          }
        } catch (e) {
          // 동의 INSERT 실패해도 로그인은 계속 — 베타 사용자 차단보다 우선. 다음 진입 시 재시도 가능.
          console.warn('[useAuth] consent persist failed', e);
        }
      }

      prevUserIdRef.current = newId;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) console.error('Google login error:', error);
  }, []);

  const signInWithKakao = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.origin,
        scopes: 'profile_nickname profile_image',
      },
    });
    if (error) console.error('Kakao login error:', error);
  }, []);

  const signOut = useCallback(async () => {
    // supabase.auth.signOut()이 실패해도(네트워크·토큰만료 등) 로컬은 반드시 정리.
    // 정리 누락 시 user=null인데 store 잔존하는 race가 발생함.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[useAuth] supabase signOut error — 로컬 정리는 계속 진행:', e);
    }
    clearUserStorage();
    usePortfolioStore.getState().resetPortfolio();
    prevUserIdRef.current = null;
    setUser(null);
    setSession(null);
    // 완전 클린 상태 보장 — 컴포넌트 트리 전부 다시 마운트되어 stale state/effect 제거.
    // 디바운스 중인 usePortfolioSync save effect의 race도 reload로 회피.
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);

  return { user, session, loading, signInWithGoogle, signInWithKakao, signOut };
}
