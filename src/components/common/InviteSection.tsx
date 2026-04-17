'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Copy, Check, Share2, Users } from 'lucide-react';

interface InviteData {
  code: string;
  use_count: number;
  max_uses: number | null;
  is_founder: boolean;
  uses: { used_by: string; used_at: string }[];
}

export default function InviteSection() {
  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setLoggedIn(true);

      const res = await fetch('/api/codes/my-invite', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  }, []);

  const shareUrl = data ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?code=${data.code}` : '';

  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!data) return;
    if (navigator.share) {
      await navigator.share({
        title: '주비 — AI 주식 비서',
        text: `주비 베타에 초대합니다! 초대 코드: ${data.code}`,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(`주비 베타 초대 코드: ${data.code}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!loggedIn) {
    return (
      <div style={{ padding: '14px 16px', background: '#F2F4F6', borderRadius: 12, fontSize: 13, color: '#8B95A1', textAlign: 'center' }}>
        로그인 후 초대 코드를 발급받을 수 있어요
      </div>
    );
  }

  if (loading) {
    return <div className="skeleton-shimmer" style={{ height: 120, borderRadius: 12 }} />;
  }

  if (!data) return null;

  const remaining = data.max_uses === null ? null : data.max_uses - data.use_count;
  const pct = data.max_uses ? Math.min(100, Math.round((data.use_count / data.max_uses) * 100)) : 0;

  return (
    <div>
      {/* 코드 카드 */}
      <div style={{
        background: 'linear-gradient(135deg, #3182F6 0%, #1A56DB 100%)',
        borderRadius: 16, padding: '20px 20px 16px', marginBottom: 12, color: '#fff',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, marginBottom: 6, letterSpacing: 0.5 }}>
          {data.is_founder ? '🌊 파운더 초대 코드' : '내 초대 코드'}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, marginBottom: 14, fontVariantNumeric: 'tabular-nums' }}>
          {data.code}
        </div>

        {/* 사용 현황 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: data.max_uses ? 10 : 0 }}>
          <Users style={{ width: 14, height: 14, opacity: 0.8 }} />
          <span style={{ fontSize: 13, opacity: 0.9 }}>
            {data.use_count}명 초대됨
            {data.max_uses === null ? ' · 무제한' : ` · ${remaining}명 남음`}
          </span>
        </div>

        {/* 진행 바 (제한 있는 경우만) */}
        {data.max_uses !== null && (
          <div style={{ height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 2, transition: 'width 0.4s' }} />
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '11px 0', borderRadius: 10, border: '1px solid #E5E8EB',
            background: copied ? 'rgba(32,201,151,0.08)' : 'var(--surface, #fff)',
            color: copied ? '#20C997' : 'var(--text-primary, #191F28)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
          {copied ? '복사됨!' : '코드 복사'}
        </button>
        <button
          onClick={handleShare}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '11px 0', borderRadius: 10, border: 'none',
            background: '#3182F6', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Share2 style={{ width: 14, height: 14 }} />
          공유하기
        </button>
      </div>

      {/* 사용 이력 */}
      {data.uses.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>초대한 친구</div>
          {data.uses.slice(0, 5).map((u, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0', borderBottom: i < data.uses.length - 1 ? '1px solid #F2F4F6' : 'none',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#F2F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#4E5968',
              }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 12, color: '#8B95A1' }}>
                {new Date(u.used_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 가입
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
