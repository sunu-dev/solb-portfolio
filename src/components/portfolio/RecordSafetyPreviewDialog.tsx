'use client';

import { useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  FileCheck2,
  History,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { logTourEvent } from '@/lib/tourTelemetry';

interface Props {
  onClose: () => void;
}

type Stage = 'review' | 'approved' | 'restored';

const SAMPLE_ROWS = [
  {
    id: 'same',
    name: '삼성전자',
    broker: '증권사 A',
    status: '그대로',
    detail: '수량과 평균단가가 기존 기록과 같아요',
    actionable: false,
  },
  {
    id: 'changed',
    name: '엔비디아',
    broker: '증권사 B',
    status: '변경',
    detail: '수량 2주 → 3주',
    actionable: true,
  },
  {
    id: 'new',
    name: '애플',
    broker: '증권사 B',
    status: '새 항목',
    detail: '새 기록 1주',
    actionable: true,
  },
] as const;

export default function RecordSafetyPreviewDialog({ onClose }: Props) {
  const [stage, setStage] = useState<Stage>('review');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(SAMPLE_ROWS.filter((row) => row.actionable).map((row) => row.id)),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef, onClose);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approve = () => {
    setStage('approved');
    void logTourEvent('record_preview_approved', { selectedCount: selected.size });
  };

  const restore = () => {
    setStage('restored');
    void logTourEvent('record_preview_restored');
  };

  const restart = () => {
    setSelected(new Set(SAMPLE_ROWS.filter((row) => row.actionable).map((row) => row.id)));
    setStage('review');
    void logTourEvent('record_preview_started', { source: 'restart' });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(5px)',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-preview-title"
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-light, #E5E8EB)',
          borderRadius: 24,
          background: 'var(--surface, #FFFFFF)',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.24)',
        }}
      >
        <div style={{ padding: '20px 20px 15px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
          <div style={{ width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 14, background: 'var(--brand-primary-bg, rgba(14,124,123,0.08))', color: 'var(--brand-primary, #0E7C7B)' }}>
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <h2 id="record-preview-title" style={{ margin: 0, color: 'var(--text-primary, #191F28)', fontSize: 18, lineHeight: 1.35 }}>
                변경 확인을 미리 체험해보세요
              </h2>
              <span style={{ padding: '3px 7px', borderRadius: 999, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #6B7684)', fontSize: 9, fontWeight: 800 }}>
                예시 데이터
              </span>
            </div>
            <p style={{ margin: '5px 0 0', color: 'var(--text-secondary, #6B7684)', fontSize: 12, lineHeight: 1.55 }}>
              계정이나 파일 없이, 주비가 기록을 지키는 방식을 확인해요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="변경 확인 체험 닫기"
            style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--text-tertiary, #8B95A1)', cursor: 'pointer' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {stage === 'review' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                {[
                  ['새 항목', 1],
                  ['변경', 1],
                  ['그대로', 1],
                ].map(([label, count]) => (
                  <div key={label} style={{ padding: '10px 5px', borderRadius: 11, background: 'var(--bg-subtle, #F8F9FA)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-primary, #191F28)', fontSize: 15, fontWeight: 800 }}>{count}</div>
                    <div style={{ marginTop: 2, color: 'var(--text-tertiary, #8B95A1)', fontSize: 10 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {SAMPLE_ROWS.map((row) => {
                  const isSelected = selected.has(row.id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      disabled={!row.actionable}
                      onClick={() => toggle(row.id)}
                      aria-pressed={row.actionable ? isSelected : undefined}
                      style={{
                        width: '100%',
                        padding: '13px 14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        border: `1.5px solid ${isSelected ? 'var(--brand-primary, #0E7C7B)' : 'var(--border-light, #E5E8EB)'}`,
                        borderRadius: 13,
                        background: isSelected ? 'var(--brand-primary-bg, rgba(14,124,123,0.06))' : 'var(--surface, #FFFFFF)',
                        opacity: row.actionable ? 1 : 0.68,
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: row.actionable ? 'pointer' : 'default',
                      }}
                    >
                      <span style={{ width: 21, height: 21, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 6, background: isSelected ? 'var(--brand-primary, #0E7C7B)' : 'var(--bg-subtle, #F2F4F6)' }}>
                        {isSelected && <Check size={14} color="white" strokeWidth={3} aria-hidden="true" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--text-primary, #191F28)', fontSize: 13 }}>{row.name}</strong>
                          <span style={{ color: 'var(--text-tertiary, #8B95A1)', fontSize: 10 }}>{row.broker}</span>
                          <span style={{ color: row.status === '그대로' ? 'var(--text-tertiary, #8B95A1)' : 'var(--brand-primary, #0E7C7B)', fontSize: 10, fontWeight: 800 }}>
                            {row.status}
                          </span>
                        </span>
                        <span style={{ display: 'block', marginTop: 5, color: 'var(--text-secondary, #5B6674)', fontSize: 11, lineHeight: 1.5 }}>
                          {row.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 14, padding: 12, display: 'flex', gap: 9, borderRadius: 12, background: 'rgba(14,124,123,0.07)', color: 'var(--text-secondary, #4E5968)', fontSize: 11, lineHeight: 1.55 }}>
                <FileCheck2 size={17} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" style={{ flexShrink: 0 }} />
                선택하지 않은 항목과 같은 기록은 건드리지 않아요. 승인 전에는 실제 기록이 바뀌지 않습니다.
              </div>

              <button
                type="button"
                onClick={approve}
                disabled={selected.size === 0}
                style={{ width: '100%', minHeight: 48, marginTop: 16, border: 0, borderRadius: 13, background: selected.size > 0 ? 'var(--brand-primary, #0E7C7B)' : 'var(--border-strong, #D1D6DB)', color: 'white', fontSize: 14, fontWeight: 800, cursor: selected.size > 0 ? 'pointer' : 'not-allowed' }}
              >
                선택한 {selected.size}개 변경 승인
              </button>
            </>
          )}

          {stage !== 'review' && (
            <div style={{ padding: '28px 4px 8px', textAlign: 'center' }}>
              <div style={{ width: 58, height: 58, margin: '0 auto', display: 'grid', placeItems: 'center', borderRadius: 20, background: stage === 'approved' ? 'rgba(52,199,89,0.1)' : 'var(--brand-primary-bg, rgba(14,124,123,0.08))', color: stage === 'approved' ? 'var(--color-success, #228B45)' : 'var(--brand-primary, #0E7C7B)' }}>
                {stage === 'approved'
                  ? <CheckCircle2 size={29} aria-hidden="true" />
                  : <RotateCcw size={27} aria-hidden="true" />}
              </div>
              <h3 style={{ margin: '15px 0 0', color: 'var(--text-primary, #191F28)', fontSize: 18 }}>
                {stage === 'approved' ? '선택한 변경만 반영했어요' : '변경 전으로 복구했어요'}
              </h3>
              <p style={{ margin: '8px auto 0', maxWidth: 340, color: 'var(--text-secondary, #6B7684)', fontSize: 12, lineHeight: 1.7 }}>
                {stage === 'approved'
                  ? '반영 직전 상태를 복구 지점으로 자동 보관했어요. 원하면 바로 되돌릴 수 있어요.'
                  : '복구 전 상태도 별도 지점으로 남겨서, 복구 때문에 기록을 잃지 않아요.'}
              </p>

              <div style={{ marginTop: 18, padding: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 12, color: 'var(--text-secondary, #4E5968)', fontSize: 11 }}>
                <History size={16} color="var(--brand-primary, #0E7C7B)" aria-hidden="true" />
                {stage === 'approved' ? '방금 전 기록 · 복구 가능' : '복구 전 기록까지 안전하게 보관'}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                {stage === 'approved' ? (
                  <button
                    type="button"
                    onClick={restore}
                    style={{ flex: 1, minHeight: 46, border: '1px solid var(--border-strong, #D1D6DB)', borderRadius: 12, background: 'var(--surface, #FFFFFF)', color: 'var(--text-secondary, #4E5968)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                  >
                    안전하게 되돌리기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={restart}
                    style={{ flex: 1, minHeight: 46, border: '1px solid var(--border-strong, #D1D6DB)', borderRadius: 12, background: 'var(--surface, #FFFFFF)', color: 'var(--text-secondary, #4E5968)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                  >
                    다시 체험
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{ flex: 1, minHeight: 46, border: 0, borderRadius: 12, background: 'var(--brand-primary, #0E7C7B)', color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  체험 마치기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
