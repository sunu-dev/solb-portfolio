'use client';

import { useState } from 'react';
import { INVESTOR_TYPE_QUIZ, INVESTOR_TYPES, calculateInvestorType, type InvestorType } from '@/config/investorTypes';

interface Props {
  onComplete: (type: InvestorType) => void;
  onSkip?: () => void;
  /** 외부 모달 형태로 띄울 때 닫기 버튼 표시 */
  onClose?: () => void;
}

/**
 * 5문항 투자자 유형 퀴즈
 * - 한 화면에 한 문제씩
 * - 답 선택하면 자동으로 다음 문제
 * - 마지막 답 → 결과 화면 (유형 제안 + 이대로 / 다시)
 */
export default function InvestorTypeQuiz({ onComplete, onSkip, onClose }: Props) {
  const [step, setStep] = useState(0); // 0~4: 문제 번호 / 5: 결과
  const [answers, setAnswers] = useState<Array<{ questionId: string; answerIndex: number }>>([]);
  const [resultType, setResultType] = useState<InvestorType | null>(null);

  const isResult = step >= INVESTOR_TYPE_QUIZ.length;
  const progress = Math.min(step, INVESTOR_TYPE_QUIZ.length) / INVESTOR_TYPE_QUIZ.length * 100;

  const handleAnswer = (answerIndex: number) => {
    const q = INVESTOR_TYPE_QUIZ[step];
    const newAnswers = [...answers, { questionId: q.id, answerIndex }];
    setAnswers(newAnswers);

    if (step + 1 >= INVESTOR_TYPE_QUIZ.length) {
      // 결과 계산
      const type = calculateInvestorType(newAnswers);
      setResultType(type);
      setStep(step + 1);
    } else {
      setStep(step + 1);
    }
  };

  const handleRetake = () => {
    setStep(0);
    setAnswers([]);
    setResultType(null);
  };

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
      {/* 진행 바 */}
      {!isResult && (
        <div style={{ marginBottom: 24 }}>
          <div
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={INVESTOR_TYPE_QUIZ.length}
            style={{
              height: 4, borderRadius: 2,
              background: 'var(--bg-subtle, #F2F4F6)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'var(--color-info, #3182F6)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
            <span>{step + 1} / {INVESTOR_TYPE_QUIZ.length}</span>
            {onSkip && (
              <button
                onClick={onSkip}
                className="cursor-pointer"
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary, #B0B8C1)', fontSize: 11, padding: 0 }}
              >
                건너뛰기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 질문 화면 */}
      {!isResult && (() => {
        const q = INVESTOR_TYPE_QUIZ[step];
        return (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-info, #3182F6)', letterSpacing: 0.5, marginBottom: 10 }}>
              Q{step + 1}
            </div>
            <div style={{
              fontSize: 20, fontWeight: 800, color: 'var(--text-primary, #191F28)',
              lineHeight: 1.4, marginBottom: 24, wordBreak: 'keep-all',
            }}>
              {q.question}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.answers.map((ans, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className="cursor-pointer"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    fontSize: 14, fontWeight: 500,
                    color: 'var(--text-primary, #191F28)',
                    background: 'var(--surface, #FFFFFF)',
                    border: '1px solid var(--border-light, #F2F4F6)',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    minHeight: 48,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--color-info-bg, rgba(49,130,246,0.04))';
                    e.currentTarget.style.borderColor = 'var(--color-info, #3182F6)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--surface, #FFFFFF)';
                    e.currentTarget.style.borderColor = 'var(--border-light, #F2F4F6)';
                  }}
                >
                  {ans.label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 결과 화면 */}
      {isResult && resultType && (() => {
        const meta = INVESTOR_TYPES[resultType];
        return (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5, marginBottom: 6, textAlign: 'center' }}>
              당신에게 맞는 투자자 유형은
            </div>

            {/* 유형 카드 */}
            <div
              style={{
                padding: '28px 24px',
                borderRadius: 20,
                background: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border-light, #F2F4F6)',
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 8, lineHeight: 1 }}>{meta.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
                {meta.nameKr}
              </div>
              <div style={{ fontSize: 13, color: meta.accentColor, fontWeight: 600, marginBottom: 14 }}>
                {meta.tagline}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.7, marginBottom: 16, wordBreak: 'keep-all' }}>
                {meta.description}
              </div>

              {/* 핵심 특성 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {meta.keyTraits.map(t => (
                  <span
                    key={t}
                    style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '4px 10px', borderRadius: 20,
                      background: 'var(--bg-subtle, #F2F4F6)',
                      color: 'var(--text-secondary, #4E5968)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* 미리보기 — AI가 이렇게 바뀌어요 */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--color-info-bg, rgba(49,130,246,0.06))',
                border: '1px solid rgba(49,130,246,0.12)',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-info, #3182F6)', marginBottom: 6 }}>
                🤖 AI가 이렇게 달라져요
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
                <strong>AI 촉:</strong> {meta.chokPreference.slice(0, 2).join(' · ')} 우선 추천<br />
                <strong>AI 분석:</strong> {meta.nameKr} 관점 · {meta.keyTraits[0]} 중심
              </div>
            </div>

            {/* 액션 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => onComplete(resultType)}
                style={{
                  padding: '14px 0', borderRadius: 12,
                  fontSize: 14, fontWeight: 700,
                  color: '#fff',
                  background: 'var(--text-primary, #191F28)',
                  border: 'none', cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                이대로 시작할게요
              </button>
              <button
                onClick={handleRetake}
                className="cursor-pointer"
                style={{
                  padding: '12px 0', borderRadius: 12,
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--text-secondary, #4E5968)',
                  background: 'transparent',
                  border: '1px solid var(--border-light, #F2F4F6)',
                }}
              >
                다시 풀어볼래요
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="cursor-pointer"
                  style={{
                    padding: '10px 0', borderRadius: 12,
                    fontSize: 12, fontWeight: 500,
                    color: 'var(--text-tertiary, #B0B8C1)',
                    background: 'transparent',
                    border: 'none',
                  }}
                >
                  닫기
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
