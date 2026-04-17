'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User;
  onVerified: () => void;
}

export default function InviteGate({ user, onVerified }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const res = await fetch('/api/codes/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: code.trim(), userId: user.id, context: 'signup' }),
      });
      const data = await res.json();

      if (data.valid) {
        setSuccess(data.message);
        setTimeout(() => onVerified(), 1200);
      } else {
        setError(data.error || '유효하지 않은 코드예요.');
      }
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F2F4F6',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#fff',
        borderRadius: 24,
        padding: '40px 32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        textAlign: 'center',
      }}>
        {/* 로고 */}
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌊</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>
          주비 베타
        </h1>
        <p style={{ fontSize: 14, color: '#8B95A1', lineHeight: 1.6, marginBottom: 32 }}>
          현재 베타 테스터만 이용 가능해요.<br />
          초대 코드를 입력해주세요.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            value={code}
            onChange={e => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="SOLB-XXXXXXXX"
            maxLength={20}
            disabled={loading || !!success}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 2,
              textAlign: 'center',
              border: `2px solid ${error ? '#EF4452' : success ? '#20C997' : '#E5E8EB'}`,
              borderRadius: 12,
              outline: 'none',
              background: '#F8F9FA',
              color: '#191F28',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            autoComplete="off"
            autoCapitalize="characters"
          />

          {error && (
            <p style={{ fontSize: 13, color: '#EF4452', marginTop: 8, textAlign: 'center' }}>
              {error}
            </p>
          )}
          {success && (
            <p style={{ fontSize: 13, color: '#20C997', marginTop: 8, textAlign: 'center', fontWeight: 600 }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim() || !!success}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: 16,
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              background: loading || !code.trim() || !!success ? '#B0B8C1' : '#3182F6',
              border: 'none',
              borderRadius: 12,
              cursor: loading || !code.trim() || !!success ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? '확인 중...' : success ? '입장 중...' : '입장하기'}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #F2F4F6' }}>
          <p style={{ fontSize: 12, color: '#B0B8C1', marginBottom: 8 }}>
            초대 코드가 없으신가요?
          </p>
          <a
            href="https://open.kakao.com/o/주비오픈채팅"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#3182F6', fontWeight: 600, textDecoration: 'none' }}
          >
            카카오 오픈채팅에서 받기 →
          </a>
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            marginTop: 16,
            fontSize: 12,
            color: '#B0B8C1',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
}
