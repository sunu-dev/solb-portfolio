'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { usePortfolioStore } from '@/store/portfolioStore';
import { clearUserStorage } from '@/lib/userStorage';
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

      // 신규 로그인 (anon → authenticated): LoginModal에서 동의한 내용을 user_consents에 INSERT
      // BLOCKER #10 — 동의 시점 DB 로깅 (분쟁 1순위 증거)
      if (!prevId && newId) {
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
                { user_id: newId, consent_type: 'age_14_plus', version: 'v1', agreed_at: consent.ts },
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
    await supabase.auth.signOut();
    clearUserStorage();
    usePortfolioStore.getState().resetPortfolio();
    prevUserIdRef.current = null;
    setUser(null);
    setSession(null);
  }, []);

  return { user, session, loading, signInWithGoogle, signInWithKakao, signOut };
}
