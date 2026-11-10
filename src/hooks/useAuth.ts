'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { usePortfolioStore } from '@/store/portfolioStore';
import { clearUserStorage } from '@/lib/userStorage';
import { resolveOAuthRedirect } from '@/lib/oauthRedirect';
import { preserveUnsyncedPortfolio, type LocalPortfolio } from '@/lib/portfolioIdentity';
import type { User, Session } from '@supabase/supabase-js';

function preserveOutgoingEdits(ownerId: string | null) {
  const state = usePortfolioStore.getState();
  const persisted = usePortfolioStore.persist.getOptions().partialize!(state) as LocalPortfolio;
  preserveUnsyncedPortfolio(ownerId, persisted, state.portfolioSyncStatus, localStorage);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // 정합성 결함 C2-data 수정 — 직전 user.id 추적해 계정 전환 감지
  const prevUserIdRef = useRef<string | null>(null);
  const retry = useCallback(() => {
    // A failed SDK initialization can outlive this hook. Re-running getSession
    // on the same client repeats that failure; a reload creates a fresh client.
    // Keep persisted sessions and edits, and never turn a retry into sign-out.
    try { preserveOutgoingEdits(prevUserIdRef.current); }
    catch { setError(true); setLoading(false); return; }
    window.location.reload();
  }, []);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    const fail = () => {
      if (!active || receivedAuthEvent) return;
      // Keep the identity boundary closed; never treat a failed lookup as logout.
      // A timeout only changes the waiting screen. The same lookup may still
      // recover; only a newer auth event may supersede its eventual result.
      setError(true);
      setLoading(false);
    };
    const timer = setTimeout(fail, 6000);
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) { fail(); return; }
      if (!active || receivedAuthEvent) return;
      clearTimeout(timer);
      const uid = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      prevUserIdRef.current = uid;
      setError(false);
      setLoading(false);
    }).catch(fail);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      // The SDK also emits INITIAL_SESSION(null) when its initial read fails.
      // getSession carries the error, so let that result distinguish a guest
      // from an unavailable account. A real SIGNED_OUT still closes access.
      if (_event === 'INITIAL_SESSION' && !newSession) return;
      receivedAuthEvent = true;
      clearTimeout(timer);
      setError(false);
      const prevId = prevUserIdRef.current;
      const newId = newSession?.user?.id ?? null;

      if (prevId && prevId !== newId) {
        try { preserveOutgoingEdits(prevId); }
        catch {
          // Close the reader boundary before exposing the new identity. Keep the original edits intact.
          setError(true);
          setLoading(false);
          return;
        }
      }

      // 계정 전환(A → B) 감지 시 이전 사용자 데이터 즉시 정리.
      // 직접 OAuth 전환·다른 탭 로그인 등 signOut 미경유 케이스 대응.
      // anon → 로그인(prev=null, new=non-null)은 사용자 데이터 이전을 위해 keep.
      if (prevId && newId && prevId !== newId) {
        console.log('[useAuth] 계정 전환 감지 — 이전 데이터 정리');
        clearUserStorage();
        usePortfolioStore.getState().resetPortfolio();
      }

      // 로그아웃 감지(prev=non-null, new=null) — 다른 탭 로그아웃·토큰 만료·signOut 실패
      // 시점에도 로컬 데이터 잔존 차단. signOut() 호출도 결국 이 listener를 거치므로
      // 어떤 경로든 일관된 정리 보장.
      if (prevId && !newId) {
        console.log('[useAuth] 로그아웃 감지 — 로컬 데이터 정리');
        clearUserStorage();
        usePortfolioStore.getState().resetPortfolio();
      }

      // 동의 저장은 AgeEligibilityGate가 조회보다 먼저 수행한다.
      // 인증 콜백과 초기 getSession 경로에서 저장/조회가 경합하지 않게 한다.
      if (!prevId && newId) {
        // 게스트 체험 데모(demo:true)는 계정으로 이전 금지 — 로컬 keep 정책 전에 먼저 제거.
        usePortfolioStore.getState().clearGuestDemo();
      }

      prevUserIdRef.current = newId;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath = '/') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: resolveOAuthRedirect(window.location.origin, redirectPath) },
    });
    if (error) console.error('Google login error:', error);
  }, []);

  const signInWithKakao = useCallback(async (redirectPath = '/') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: resolveOAuthRedirect(window.location.origin, redirectPath),
          scopes: 'profile_nickname profile_image',
        },
      });
      if (error) {
        console.error('Kakao login error:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Kakao login error:', error);
      return false;
    }
  }, []);

  const clearSession = useCallback(async (redirect: '/' | '/?login=1') => {
    try { preserveOutgoingEdits(prevUserIdRef.current); }
    catch {
      setError(true);
      setLoading(false);
      return;
    }
    // 원격 로그아웃 응답을 기다리는 동안에도 이전 계정의 조회/저장을 중단한다.
    clearUserStorage();
    usePortfolioStore.getState().resetPortfolio();
    // supabase.auth.signOut()이 실패해도(네트워크·토큰만료 등) 로컬은 반드시 정리.
    // 정리 누락 시 user=null인데 store 잔존하는 race가 발생함.
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('[useAuth] signOut returned an error');
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
      window.location.href = redirect;
    }
  }, []);

  const signOut = useCallback(() => clearSession('/'), [clearSession]);
  const switchAccount = useCallback(() => clearSession('/?login=1'), [clearSession]);

  return { user, session, loading, error, retry, signInWithGoogle, signInWithKakao, signOut, switchAccount };
}
