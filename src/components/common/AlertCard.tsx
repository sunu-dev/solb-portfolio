'use client';

import { useState, useEffect } from 'react';
import { X, HelpCircle, Clock, Share2 } from 'lucide-react';
import { STOCK_KR } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { snoozeAlert, getSnoozeLabel, type SnoozeDuration } from '@/utils/alertSnooze';
import { getAlertExplanation } from '@/utils/alertGlossary';

declare global {
  interface Window {
    Kakao: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

interface Style {
  icon: string;
  label: string;
  bg: string;
  border: string;
  color: string;
}

const ALERT_STYLE: Record<Alert['type'], Style> = {
  urgent:      { icon: '🚨', label: '긴급',     bg: 'rgba(239,68,82,0.04)', border: '1px solid rgba(239,68,82,0.08)', color: '#EF4452' },
  risk:        { icon: '⚠️', label: '리스크',   bg: 'rgba(255,149,0,0.04)', border: '1px solid rgba(255,149,0,0.08)', color: '#FF9500' },
  opportunity: { icon: '💡', label: '주목',     bg: 'rgba(0,198,190,0.04)', border: '1px solid rgba(0,198,190,0.08)', color: '#00C6BE' },
  insight:     { icon: '✨', label: '인사이트', bg: 'rgba(49,130,246,0.04)', border: '1px solid rgba(49,130,246,0.08)', color: '#3182F6' },
  celebrate:   { icon: '🎉', label: '달성',     bg: 'rgba(175,82,222,0.04)', border: '1px solid rgba(175,82,222,0.08)', color: '#AF52DE' },
};

const SNOOZE_OPTIONS: SnoozeDuration[] = ['1h', '3h', '24h', 'market_close'];

function getRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

interface Props {
  alert: Alert;
  onDismiss: (id: string) => void;
  onSnooze?: (id: string) => void;
  onAnalyze?: (symbol: string) => void;
  compact?: boolean; // 그룹핑된 내부 요소용 (심볼 헤더 생략)
}

export default function AlertCard({ alert, onDismiss, onSnooze, onAnalyze, compact = false }: Props) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shared, setShared] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);
  const style = ALERT_STYLE[alert.type];
  const explanation = getAlertExplanation(alert.id);
  const hasAction = alert.symbol && alert.symbol !== 'PORTFOLIO';

  // 카카오 SDK 준비 상태
  useEffect(() => {
    const check = () => {
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (window.Kakao && key) {
        if (!window.Kakao.isInitialized()) window.Kakao.init(key);
        setKakaoReady(true);
      }
    };
    if (window.Kakao) { check(); return; }
    const t = setInterval(() => { if (window.Kakao) { check(); clearInterval(t); } }, 500);
    return () => clearInterval(t);
  }, []);

  const handleShare = async () => {
    const symbol = alert.symbol && alert.symbol !== 'PORTFOLIO' ? alert.symbol : '';
    const kr = symbol ? STOCK_KR[symbol] || symbol : '';
    const appUrl = 'https://solb-portfolio.vercel.app';
    const title = kr ? `${kr} — ${style.icon} ${alert.message}` : `${style.icon} ${alert.message}`;
    const shareText = `${title}\n${alert.detail}\n\n주비 포트폴리오에서 공유`;

    // 카카오 우선
    if (kakaoReady && window.Kakao?.Share) {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description: alert.detail,
          imageUrl: `${appUrl}/icon-512.png`,
          link: { mobileWebUrl: appUrl, webUrl: appUrl },
        },
        buttons: [{ title: '주비에서 보기', link: { mobileWebUrl: appUrl, webUrl: appUrl } }],
      });
      setShared(true);
      setTimeout(() => setShared(false), 2000);
      return;
    }
    // Web Share API fallback
    if (navigator.share) {
      try { await navigator.share({ title: '주비 알림', text: shareText, url: appUrl }); }
      catch { /* cancelled */ }
      return;
    }
    // 클립보드 fallback
    try {
      await navigator.clipboard.writeText(`${shareText}\n${appUrl}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: style.bg,
        border: style.border,
        position: 'relative',
      }}
    >
      {/* 우측 상단 버튼 그룹 */}
      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0 }}>
        {explanation && (
          <button
            onClick={() => setShowHelp(v => !v)}
            className="cursor-pointer"
            aria-label="알림 설명 보기"
            aria-expanded={showHelp}
            style={{ background: 'none', border: 'none', padding: 6, color: 'var(--text-tertiary, #B0B8C1)', minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <HelpCircle size={13} />
          </button>
        )}
        <button
          onClick={handleShare}
          className="cursor-pointer"
          aria-label="카카오톡으로 공유"
          title={shared ? '복사됨' : '공유'}
          style={{
            background: 'none', border: 'none', padding: 6,
            color: shared ? 'var(--color-success, #00C6BE)' : 'var(--text-tertiary, #B0B8C1)',
            minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.2s',
          }}
        >
          <Share2 size={13} />
        </button>
        {onSnooze && (
          <button
            onClick={() => setShowSnooze(v => !v)}
            className="cursor-pointer"
            aria-label="나중에 보기"
            aria-expanded={showSnooze}
            style={{ background: 'none', border: 'none', padding: 6, color: 'var(--text-tertiary, #B0B8C1)', minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Clock size={13} />
          </button>
        )}
        <button
          onClick={() => onDismiss(alert.id)}
          className="cursor-pointer"
          aria-label="알림 닫기"
          style={{ background: 'none', border: 'none', padding: 6, color: 'var(--text-tertiary, #B0B8C1)', minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={13} />
        </button>
      </div>

      {/* 본문 — 우측 여유: help(28)+share(28)+snooze(28)+X(28) = 최대 112 */}
      <div style={{ paddingRight: (explanation ? 28 : 0) + 28 + (onSnooze ? 28 : 0) + 28 + 8 }}>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11 }}>{style.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: style.color }}>{style.label}</span>
            {alert.symbol && alert.symbol !== 'PORTFOLIO' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)' }}>
                {STOCK_KR[alert.symbol] || alert.symbol}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 'auto', marginRight: 36 }}>
              {getRelativeTime(alert.timestamp)}
            </span>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)', lineHeight: 1.4, marginBottom: 4 }}>
          {alert.message}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
          {alert.detail}
        </div>

        {hasAction && onAnalyze && (
          <div
            onClick={() => onAnalyze(alert.symbol)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onAnalyze(alert.symbol); }}
            className="cursor-pointer"
            style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: style.color }}
          >
            분석 보기 ›
          </div>
        )}
      </div>

      {/* 용어 설명 펼침 */}
      {explanation && showHelp && (
        <div
          role="region"
          aria-label="알림 용어 설명"
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border-light, #F2F4F6)',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 3 }}>
            💡 {explanation.term}
          </div>
          <div style={{ color: 'var(--text-secondary, #4E5968)', marginBottom: 4, fontStyle: 'italic' }}>
            {explanation.oneLine}
          </div>
          <div style={{ color: 'var(--text-secondary, #8B95A1)' }}>
            {explanation.detail}
          </div>
        </div>
      )}

      {/* Snooze 옵션 */}
      {showSnooze && onSnooze && (
        <div
          style={{
            marginTop: 10, padding: '8px 10px', borderRadius: 8,
            background: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border-light, #F2F4F6)',
            display: 'flex', flexWrap: 'wrap', gap: 4,
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginRight: 4, alignSelf: 'center' }}>
            나중에 보기:
          </span>
          {SNOOZE_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => {
                snoozeAlert(alert.id, d);
                setShowSnooze(false);
                onSnooze(alert.id);
              }}
              className="cursor-pointer"
              style={{
                padding: '4px 9px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                color: 'var(--color-info, #3182F6)',
                background: 'var(--color-info-bg, rgba(49,130,246,0.08))',
                border: 'none',
              }}
            >
              {getSnoozeLabel(d)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
