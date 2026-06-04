'use client';

// 해외주식 양도세 계산기 (v1 합산기) — docs/TAX_PIVOT_MVP_SPEC.md
// ⚠️ '계산·정리 도구'(세무대리/상담 아님). 증권사 제공 실현손익을 합산만 — 우리가 재계산 안 함.
//    모든 결과는 '(추정)'. 신고는 사용자가 홈택스 셀프. '세무 비서'/신고대행/절세상담 카피 금지(§20③).

import { useEffect, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
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

// 만원 단위 입력 ↔ 원 저장 변환 (7자리 입력 마찰 해소, 추정 도구라 만원 단위 적정)
const toManwon = (krw: number): number | '' => (krw === 0 ? '' : Math.round(krw / 10_000));
const fromManwon = (man: string): number => {
  if (man.trim() === '' || man.trim() === '-') return 0;
  const n = Number(man);
  return Number.isFinite(n) ? Math.round(n) * 10_000 : 0;
};

export default function TaxEstimateModal({ onClose }: Props) {
  const { taxYear, entries, addEntry, updateEntry, removeEntry, setYear, clear } = useTaxStore();
  const est = computeTaxEstimate(entries);
  const deductionPct = Math.min(100, (est.deductionUsed / ANNUAL_BASIC_DEDUCTION_KRW) * 100);
  const [pendingBroker, setPendingBroker] = useState<Broker>('toss');
  const [wtp, setWtp] = useState<string | null>(null);   // 카나리 WTP 위젯 응답
  const firedRef = useRef<Set<string>>(new Set());

  const thisYear = new Date().getFullYear();
  const yearOptions = [thisYear]; // 카나리: 단일 연도(올해). 연도별 분리는 v2(entries.taxYear 필드 후)
  const brokerCount = new Set(entries.map((e) => e.broker)).size;

  // 카나리 텔레메트리 — WTP 검증용 행동 이벤트(이벤트당 1회). Vercel Analytics, best-effort.
  const fire = (evt: string, data?: Record<string, string | number | boolean>) => {
    if (firedRef.current.has(evt)) return;
    firedRef.current.add(evt);
    try { track(evt, data); } catch { /* analytics 실패 무시 */ }
  };
  useEffect(() => { fire('tax_modal_open'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    if (entries.length >= 1) fire('tax_first_entry');
    if (brokerCount >= 2) fire('tax_aha_2brokers', { brokers: brokerCount });
    if (est.estimatedTaxKrw > 0) fire('tax_result_positive');
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [entries.length, brokerCount, est.estimatedTaxKrw]);

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
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #191F28)' }}>해외주식 양도세 <span style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1' }}>(추정)</span></div>
            <div style={{ fontSize: 12.5, color: '#8B95A1', marginTop: 4, lineHeight: 1.5 }}>흩어진 증권사 실현손익을 합쳐 예상 세금을 봐요</div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: 20, color: '#B0B8C1', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 24px' }}>
          {/* 과세연도 선택 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {yearOptions.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: taxYear === y ? '1px solid var(--brand-primary, #0E7C7B)' : '1px solid var(--border-light, #E5E8EB)',
                  background: taxYear === y ? 'rgba(14,124,123,0.08)' : '#fff',
                  color: taxYear === y ? 'var(--brand-primary, #0E7C7B)' : '#8B95A1',
                }}
              >
                {y === thisYear ? `올해 (${y})` : `작년 (${y})`}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 12, lineHeight: 1.5 }}>
            {taxYear}년 실현분은 {taxYear + 1}년 5월 신고 대상이에요
          </div>

          {/* 출처 안내 — 상시 노출(입력 시작해도 사라지지 않게) */}
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #4E5968)', marginBottom: 10, lineHeight: 1.55, padding: '9px 11px', background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 8 }}>
            증권사 앱의 <b>‘양도소득세 계산내역’</b> 금액을 만원 단위로 더해주세요. 손실난 곳은 앞에 <b>−</b>를 붙이면 돼요.
          </div>

          {/* 입력 행 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((row) => (
              <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={row.broker}
                  onChange={(e) => updateEntry(row.id, { broker: e.target.value })}
                  aria-label="증권사"
                  style={{ flex: '0 0 116px', padding: '10px 8px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 10, background: 'var(--surface, #fff)', color: 'var(--text-primary, #191F28)' }}
                >
                  {BROKER_ORDER.map((b) => <option key={b} value={b}>{BROKER_LABELS[b]}</option>)}
                </select>
                <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    inputMode="text"
                    value={toManwon(row.gainKrw)}
                    onChange={(e) => updateEntry(row.id, { gainKrw: fromManwon(e.target.value) })}
                    placeholder="예: 300, 손실 -50"
                    aria-label="실현손익(만원, 손실은 마이너스)"
                    style={{ width: '100%', padding: '10px 40px 10px 12px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 10, outline: 'none', boxSizing: 'border-box', textAlign: 'right', color: row.gainKrw >= 0 ? GAIN : LOSS }}
                  />
                  <span style={{ position: 'absolute', right: 12, fontSize: 12, color: '#8B95A1', pointerEvents: 'none' }}>만원</span>
                </div>
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
              style={{ flex: '0 0 116px', padding: '10px 8px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 10, background: 'var(--surface, #fff)', color: 'var(--text-primary, #191F28)' }}
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

          {entries.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: 6 }}>
              <button onClick={clear} style={{ background: 'none', border: 'none', fontSize: 11.5, color: '#B0B8C1', cursor: 'pointer', textDecoration: 'underline' }}>전체 지우기</button>
            </div>
          )}

          {entries.length === 0 && (
            <div style={{ marginTop: 16, padding: '20px 16px', textAlign: 'center', color: '#8B95A1', fontSize: 13, lineHeight: 1.6, background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 12 }}>
              증권사별 올해 실현손익을 만원 단위로 더해보세요.<br />증권사 앱의 “양도소득세 계산내역” 금액을 넣으면 돼요.
            </div>
          )}

          {/* 결과 */}
          {entries.length > 0 && (
            <div style={{ marginTop: 14, padding: 18, background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 16 }}>
              {brokerCount >= 2 && (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand-primary, #0E7C7B)', marginBottom: 10 }}>
                  🔗 {brokerCount}개 증권사 합산 — 한 곳에서 모아 봐요
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', fontWeight: 600 }}>합산 실현손익</span>
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
                <div style={{ height: 8, background: 'var(--border-light, #E5E8EB)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${deductionPct}%`, height: '100%', background: 'var(--brand-primary, #0E7C7B)', borderRadius: 99 }} />
                </div>
              </div>

              {/* 예상 양도세 */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-light, #E5E8EB)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, color: 'var(--text-primary, #191F28)', fontWeight: 700 }}>예상 양도세 <span style={{ fontSize: 12, fontWeight: 600, color: '#8B95A1' }}>(추정)</span></span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #191F28)' }}>약 {formatKRW(est.estimatedTaxKrw, { short: false })}</span>
              </div>
              {est.estimatedTaxKrw > 0 ? (
                <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 6, textAlign: 'right' }}>세율 22% · 과세표준 {formatKRW(est.taxableBaseKrw, { short: false })}</div>
              ) : (
                <div style={{ fontSize: 11.5, color: 'var(--brand-primary, #0E7C7B)', marginTop: 8, fontWeight: 600 }}>
                  {est.totalGainKrw <= 0
                    ? '올해는 실현 손익이 0 이하라 낼 양도세가 없어요'
                    : '250만 공제 안에 들어 낼 양도세가 없어요'}
                </div>
              )}
            </div>
          )}

          {/* 카나리 WTP 위젯 — 결과를 본 직후 1탭. '자동 합산'(기능 편의)만 가치로 노출(§20③ 준수) */}
          {entries.length > 0 && (
            <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--brand-primary, #0E7C7B)', background: 'var(--brand-primary-light, rgba(14,124,123,0.08))' }}>
              {wtp === null ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 10, lineHeight: 1.5 }}>
                    매년 5월, 증권사 연동으로 이게 <b>자동 합산</b>되면 쓰실래요?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {([['paid', '월 구독이면 쓸래요'], ['free', '무료면 쓸래요'], ['no', '안 쓸 것 같아요']] as const).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => { setWtp(k); try { track('tax_wtp', { choice: k }); } catch { /* best-effort */ } }}
                        style={{ width: '100%', padding: '11px 12px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-light, #E5E8EB)', background: 'var(--surface, #fff)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--brand-primary, #0E7C7B)', fontWeight: 600 }}>답변 고마워요! 더 편하게 만들게요 🙏</div>
              )}
            </div>
          )}

          {/* 면책 + 안내 */}
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--color-warning-bg, rgba(245,158,11,0.08))', borderRadius: 10, fontSize: 11.5, color: 'var(--color-warning, #9A6700)', lineHeight: 1.65 }}>
            참고용 추정이에요(만원 단위 반올림). 전문 세무 서비스가 아니라 계산을 돕는 도구이고, 최종 세액과 신고 책임은 본인에게 있어요. 정확한 건 증권사 양도소득세 계산내역과 홈택스(매년 5월) 기준이에요.
          </div>
          <a
            href="https://www.hometax.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { try { track('tax_hometax_click'); } catch { /* best-effort */ } }}
            style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '11px 0', background: 'var(--brand-primary, #0E7C7B)', color: '#fff', borderRadius: 12, fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}
          >
            홈택스 바로가기 →
          </a>
        </div>
      </div>
    </div>
  );
}
