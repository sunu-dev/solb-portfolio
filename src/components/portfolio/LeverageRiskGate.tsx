'use client';

import { useState, useEffect, useCallback } from 'react';

// ==========================================
// LEVERAGE RISK GATE — 단일종목 레버리지 보유 등록 게이트
// ==========================================
//
// '중간 옵션'(2026-05-29 변호사 의견): 단일종목 레버리지는 신규 추천은 안 하되,
// 이용자가 직접 보유 등록하는 건 허용한다. 단 약관 v4 제5조·제7조가 요구하는
// 성인 확인 + 위험 고지 동의를 이 게이트에서 받는다.
//
// 게이트 통과 조건: ① 만 19세 이상 자가확인 ② 위험 이해·직접 등록 동의.
// 적합성 자가점검을 '맞춤 추천 입력'으로 쓰면 §6 개별성을 자기강화하므로(의견서 §4),
// 여기서는 차단/경고 게이트 용도로만 쓴다 — 입력값을 추천에 반영하지 않는다.

interface LeverageRiskGateProps {
  isOpen: boolean;
  symbol: string;
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LeverageRiskGate({ isOpen, symbol, name, onConfirm, onCancel }: LeverageRiskGateProps) {
  const [isAdult, setIsAdult] = useState(false);
  const [understood, setUnderstood] = useState(false);

  // 모달 열릴 때마다 체크박스 초기화 (직전 동의 잔존 방지)
  useEffect(() => {
    if (isOpen) {
      setIsAdult(false);
      setUnderstood(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    if (isAdult && understood) onConfirm();
  }, [isAdult, understood, onConfirm]);

  if (!isOpen) return null;

  const ready = isAdult && understood;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--surface, #fff)', borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)', boxSizing: 'border-box',
        }}
      >
        {/* 헤더 — Amber 경고 */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.14)', color: '#B45309', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            ⚠ 고위험 상품 — 보유 등록 확인
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            {name || symbol}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8B95A1)', marginTop: 2, fontFamily: '"SF Mono", Menlo, monospace' }}>
            {symbol}
          </div>
        </div>

        {/* 위험 고지 */}
        <div style={{ padding: '14px 20px 0', fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 10px' }}>
            단일종목 레버리지·인버스 상품은 다음 위험이 있어요.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>일일 수익률의 N배(예: 2배·-2배)를 추종하는 단기 트레이딩 도구</li>
            <li>음의 복리 — 횡보장에서도 원금이 잠식될 수 있어요</li>
            <li>ETN은 발행사 신용 위험(채무불이행 시 원금 손실)</li>
            <li>금융감독원은 손실 감내·위험 이해가 낮은 투자자에게 부적합하다고 안내해요</li>
          </ul>
          <p style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-subtle, #F2F4F6)', fontSize: 12.5, color: 'var(--text-secondary, #4E5968)' }}>
            주비는 이 상품을 <strong>신규로 추천하지 않아요.</strong> 보유 등록 시 제공되는 정보는
            보유 중인 위험을 함께 보기 위한 해설이며, <strong>매수·매도 권유가 아니에요.</strong>
          </p>
        </div>

        {/* 동의 체크박스 */}
        <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary, #4E5968)', cursor: 'pointer', lineHeight: 1.5 }}>
            <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--brand-primary, #0E7C7B)' }} />
            <span><strong style={{ color: 'var(--text-primary, #191F28)' }}>(필수)</strong> 만 19세 이상입니다.</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary, #4E5968)', cursor: 'pointer', lineHeight: 1.5 }}>
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--brand-primary, #0E7C7B)' }} />
            <span><strong style={{ color: 'var(--text-primary, #191F28)' }}>(필수)</strong> 위 위험을 이해했고, 추천이 아닌 내 판단으로 직접 보유 등록합니다.</span>
          </label>
        </div>

        {/* 버튼 */}
        <div style={{ padding: 20, display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600,
              border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 10,
              background: 'var(--surface, #fff)', color: 'var(--text-secondary, #4E5968)', cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!ready}
            style={{
              flex: 1.4, padding: '12px 0', fontSize: 14, fontWeight: 700,
              border: 'none', borderRadius: 10,
              background: ready ? 'var(--brand-primary, #0E7C7B)' : 'var(--bg-subtle, #E5E8EB)',
              color: ready ? '#fff' : 'var(--text-tertiary, #B0B8C1)',
              cursor: ready ? 'pointer' : 'not-allowed',
            }}
          >
            보유 등록
          </button>
        </div>
      </div>
    </div>
  );
}
