'use client';

// 해외주식 양도세 계산기 (v1 합산기) — docs/TAX_PIVOT_MVP_SPEC.md
// ⚠️ '계산·정리 도구'(세무대리/상담 아님). 증권사 제공 실현손익을 합산만 — 우리가 재계산 안 함.
//    모든 결과는 '(추정)'. 신고는 사용자가 홈택스 셀프. '세무 비서'/신고대행/절세상담 카피 금지(§20③).

import { useState } from 'react';
import { useTaxStore } from '@/store/taxStore';
import { computeTaxEstimate } from '@/utils/tax';
import { ANNUAL_BASIC_DEDUCTION_KRW } from '@/config/taxRates';
import { BROKER_LABELS, BROKER_ORDER, type Broker } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';

interface Props {
  onClose: () => void;
}

const GAIN = '#EF4452';                 // 이익 = 빨강 (한국 컨벤션)
const LOSS = 'var(--color-loss, #3182F6)'; // 손실 = 파랑

export default function TaxEstimateModal({ onClose }: Props) {
  const { taxYear, entries, addEntry, updateEntry, removeEntry } = useTaxStore();
  const est = computeTaxEstimate(entries);
  const deductionPct = Math.min(100, (est.deductionUsed / ANNUAL_BASIC_DEDUCTION_KRW) * 100);
  const [pendingBroker, setPendingBroker] = useState<Broker>('toss');

  return (
    <div
      role="dialog"
      aria-label="해외주식 양도세 계산기"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text, #191F28)' }}>해외주식 양도세 <span style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1' }}>(추정)</span></div>
            <div style={{ fontSize: 12.5, color: '#8B95A1', marginTop: 4, lineHeight: 1.5 }}>흩어진 증권사 실현손익을 합쳐 {taxYear}년 예상 세금을 봐요</div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: 20, color: '#B0B8C1', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 24px' }}>
          {/* 입력 행 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((row) => (
              <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={row.broker}
                  onChange={(e) => updateEntry(row.id, { broker: e.target.value })}
                  aria-label="증권사"
                  style={{ flex: '0 0 116px', padding: '10px 8px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E8EB', borderRadius: 10, background: '#fff', color: 'var(--text, #191F28)' }}
                >
                  {BROKER_ORDER.map((b) => <option key={b} value={b}>{BROKER_LABELS[b]}</option>)}
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  value={Number.isFinite(row.gainKrw) ? row.gainKrw : ''}
                  onChange={(e) => updateEntry(row.id, { gainKrw: e.target.value === '' ? 0 : Number(e.target.value) })}
                  placeholder="실현손익 (원, 손실은 −)"
                  aria-label="실현손익(원)"
                  style={{ flex: 1, minWidth: 0, padding: '10px 12px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E8EB', borderRadius: 10, outline: 'none', boxSizing: 'border-box', textAlign: 'right', color: row.gainKrw >= 0 ? GAIN : LOSS }}
                />
                <button onClick={() => removeEntry(row.id)} aria-label="삭제" style={{ flex: '0 0 auto', background: 'none', border: 'none', color: '#B0B8C1', fontSize: 16, cursor: 'pointer', padding: 4 }}>✕</button>
              </div>
            ))}
          </div>

          {/* 증권사 추가 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select
              value={pendingBroker}
              onChange={(e) => setPendingBroker(e.target.value as Broker)}
              aria-label="추가할 증권사"
              style={{ flex: '0 0 116px', padding: '10px 8px', fontSize: 13, fontWeight: 600, border: '1px solid #E5E8EB', borderRadius: 10, background: '#fff', color: 'var(--text, #191F28)' }}
            >
              {BROKER_ORDER.map((b) => <option key={b} value={b}>{BROKER_LABELS[b]}</option>)}
            </select>
            <button
              onClick={() => addEntry(pendingBroker, 0)}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(14,124,123,0.08)', color: 'var(--brand-primary, #0E7C7B)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              + 증권사 추가
            </button>
          </div>

          {entries.length === 0 && (
            <div style={{ marginTop: 16, padding: '20px 16px', textAlign: 'center', color: '#8B95A1', fontSize: 13, lineHeight: 1.6, background: '#F8F9FA', borderRadius: 12 }}>
              증권사별 올해 실현손익을 더해보세요.<br />증권사 앱의 “양도소득세 계산내역” 금액을 그대로 넣으면 돼요.
            </div>
          )}

          {/* 결과 */}
          {entries.length > 0 && (
            <div style={{ marginTop: 18, padding: 18, background: '#F8F9FA', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, color: '#4E5968', fontWeight: 600 }}>합산 실현손익</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: est.totalGainKrw >= 0 ? GAIN : LOSS }}>
                  {est.totalGainKrw >= 0 ? '+' : '−'}{formatKRW(Math.abs(est.totalGainKrw), { short: false })}
                </span>
              </div>

              {/* 250만 기본공제 */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#8B95A1', marginBottom: 6 }}>
                  <span>기본공제 250만 (국내·해외 합산 1회)</span>
                  <span>잔여 {formatKRW(est.deductionRemaining, { short: false })}</span>
                </div>
                <div style={{ height: 8, background: '#E5E8EB', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${deductionPct}%`, height: '100%', background: 'var(--brand-primary, #0E7C7B)', borderRadius: 99 }} />
                </div>
              </div>

              {/* 예상 양도세 */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #E5E8EB', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, color: 'var(--text, #191F28)', fontWeight: 700 }}>예상 양도세 <span style={{ fontSize: 12, fontWeight: 600, color: '#8B95A1' }}>(추정)</span></span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text, #191F28)' }}>약 {formatKRW(est.estimatedTaxKrw, { short: false })}</span>
              </div>
              <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 6, textAlign: 'right' }}>세율 22% · 과세표준 {formatKRW(est.taxableBaseKrw, { short: false })}</div>
            </div>
          )}

          {/* 면책 + 안내 */}
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(245,158,11,0.06)', borderRadius: 10, fontSize: 11.5, color: '#9A6700', lineHeight: 1.65 }}>
            신고 편의용 추정이에요. 최종 세액과 신고 책임은 본인에게 있어요. 정확한 건 증권사 양도소득세 계산내역과 홈택스(매년 5월) 기준이에요.
          </div>
          <a
            href="https://www.hometax.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '11px 0', background: 'var(--brand-primary, #0E7C7B)', color: '#fff', borderRadius: 12, fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}
          >
            홈택스 바로가기 →
          </a>
        </div>
      </div>
    </div>
  );
}
