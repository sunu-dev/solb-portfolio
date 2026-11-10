import { describe, expect, it } from 'vitest';
import {
  createAiAnalysisParseFallback,
  governAiAnalysisReport,
  NEUTRALIZED_ANALYSIS_TEXT,
  REVENUE_CASH_EXPLANATION,
} from '@/lib/aiAnalysisGuard';

describe('governAiAnalysisReport', () => {
  it('diagnostics contain only known fields and rule IDs, never arbitrary keys or rejected text', () => {
    const result = governAiAnalysisReport({ 'private@example.test': '지금 매수하세요.', keyAdvice: ['목표가: $100'] });
    expect(result.blockedFields).toEqual([{ field: 'other', rule: 'phrase_1' }, { field: 'keyAdvice', rule: 'pattern_4' }]);
    expect(JSON.stringify(result.blockedFields)).not.toContain('private');
    expect(JSON.stringify(result.blockedFields)).not.toContain('$100');
  });
  it('permits explaining averaging down only in a direct educational question, while retaining recommendation guards', () => {
    const explanation = { currentStatus: '물타기는 낮은 가격에 더 사서 평균 매수가를 낮추는 행동이에요. 손실이 사라지는 것은 아니에요.' };
    expect(governAiAnalysisReport(explanation).blockedCount).toBe(1);
    expect(governAiAnalysisReport(explanation, { educationalQuestion: true }).blockedCount).toBe(0);
    for (const currentStatus of ['물타기하세요.', '물타기가 좋아요.', '물타기를 추천해요.', '지금 매수하세요.']) {
      expect(governAiAnalysisReport({ currentStatus }, { educationalQuestion: true }).blockedCount).toBeGreaterThan(0);
    }
  });
  it('preserves a narrow valuation negation without allowing an actual valuation or trading directive', () => {
    expect(governAiAnalysisReport({ currentStatus: '낮아진 가격이 곧 저평가라는 뜻은 아니에요.' }, { educationalQuestion: true }).blockedCount).toBe(0);
    for (const currentStatus of ['이 종목은 저평가예요.', '저평가라는 뜻은 아니지만 지금 매수하세요.']) {
      expect(governAiAnalysisReport({ currentStatus }, { educationalQuestion: true }).blockedCount).toBeGreaterThan(0);
    }
  });
  it('corrects the observed revenue-as-cash error without changing a valid distinction', () => {
    const wrong = governAiAnalysisReport({ keyAdvice: ['계약은 약속이고, 매출은 실제로 받은 돈이에요.'] });
    expect(wrong.report.keyAdvice).toEqual([REVENUE_CASH_EXPLANATION]);
    const valid = '매출은 실제로 받은 돈이 아니라 상품·서비스를 제공해 기록한 금액이에요.';
    expect(governAiAnalysisReport({ currentStatus: valid }).report.currentStatus).toBe(valid);
  });
  it('사용자가 입력한 산술 기록은 보존하고 방향 신호만 중립화한다', () => {
    const { report, blockedCount } = governAiAnalysisReport({
      currentStatus: '현재 수익률은 12%이고 사용자 설정 목표 수익률 20%의 60% 지점이에요.',
      indicators: [{ name: 'RSI', value: '현재 42예요.', signal: 'positive' }],
      conclusion: { label: '좋음', signal: 'positive', desc: '평균 매수가는 $100이에요.' },
    });

    expect(blockedCount).toBe(0);
    expect(report.currentStatus).toContain('사용자 설정 목표 수익률 20%');
    expect(report.indicators).toEqual([{ name: 'RSI', value: '현재 42예요.', signal: 'neutral' }]);
    expect(report.conclusion).toEqual({
      label: '정보 정리',
      signal: 'neutral',
      desc: '평균 매수가는 $100이에요.',
    });
  });

  it('중첩된 매매 행동·전망·목표가 문장 전체를 고정 중립문으로 교체한다', () => {
    const { report, blockedCount } = governAiAnalysisReport({
      currentStatus: '비중을 줄이고 일부 매도를 고려하세요.',
      keyAdvice: ['추가 상승 시 관망을 고려해볼 수 있어요.'],
      newsAnalysis: [{ impact: '단기 반등 가능성이 높아요.' }],
      conclusion: { desc: '목표가: $123.50' },
      mentorScore: 5,
      mentorVerdict: '매수 기회예요.',
      scenarios: { bull: '상승 전망' },
    });

    expect(blockedCount).toBe(6);
    expect(report.currentStatus).toBe(NEUTRALIZED_ANALYSIS_TEXT);
    expect(report.keyAdvice).toEqual([NEUTRALIZED_ANALYSIS_TEXT]);
    expect(report.newsAnalysis).toEqual([{ impact: NEUTRALIZED_ANALYSIS_TEXT }]);
    expect(report.conclusion).toMatchObject({ desc: NEUTRALIZED_ANALYSIS_TEXT });
    expect(report).not.toHaveProperty('mentorScore');
    expect(report).not.toHaveProperty('mentorVerdict');
    expect(report).not.toHaveProperty('scenarios');
  });
});

describe('createAiAnalysisParseFallback', () => {
  it('모델 원문 없이 고정된 표시 보류 응답만 만든다', () => {
    const rawModelText = ['지금', '매수', '하세요. 내부 원문'].join(' ');
    const fallback = createAiAnalysisParseFallback();

    expect(JSON.stringify(fallback)).not.toContain(rawModelText);
    expect(fallback.currentStatus).toContain('응답 형식을 확인하지 못해');
    expect(fallback.conclusion).toMatchObject({ label: '표시 보류', signal: 'neutral' });
  });
});
