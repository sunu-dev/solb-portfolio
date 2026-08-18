import { describe, expect, it } from 'vitest';
import {
  buildPersonalizationLayer,
  buildUserTypeContext,
  CHOK_SYSTEM_PROMPT,
  getMentorLayer2Rules,
  SYSTEM_LAYER1,
} from '@/config/analysisPrompt';
import { TIER_LIMITS } from '@/lib/userTier';

describe('개인 주식비서 규제 경계', () => {
  it('사용자 목표율은 산술 정보로 유지하고 행동 방향과 연결하지 않는다', () => {
    const prompt = buildPersonalizationLayer({
      category: 'investing',
      currentPLPct: 12,
      targetReturn: 20,
      targetProgress: 60,
      stopLoss: 90,
      stopLossDistance: 4,
      weight: 25,
    });

    expect(prompt).toContain('사용자 설정 목표 수익률: 20%');
    expect(prompt).toContain('현재 달성률: 60%');
    expect(prompt).toContain('산술적 현황만 설명하세요');
    expect(prompt).not.toContain('보유를 고려');
    expect(prompt).not.toContain(['매도', '타이밍'].join(' '));
    expect(prompt).not.toContain('추가 매수');
  });

  it('투자자 유형은 설명 방식에만 사용한다', () => {
    const prompt = buildUserTypeContext('momentum');
    expect(prompt).toContain('말투, 전문용어 난이도, 설명 순서에만 사용');
    expect(prompt).toContain('종목 평가, 지표 신호, 결론, 관찰 목록을 이 유형에 따라 바꾸지 마세요');
    expect(prompt).not.toContain('진입가');
    expect(prompt).not.toContain('우선순위');
  });

  it('시장 관찰판 프롬프트는 개인 포트폴리오 입력을 요구하지 않는다', () => {
    expect(CHOK_SYSTEM_PROMPT).toContain('모든 사용자에게 같은 공개 시장 데이터');
    expect(CHOK_SYSTEM_PROMPT).not.toContain('{USER_TYPE_CONTEXT}');
    expect(CHOK_SYSTEM_PROMPT).not.toContain('{SECTOR_CONCENTRATION}');
    expect(CHOK_SYSTEM_PROMPT).not.toContain('{EXCLUDE_SYMBOLS}');
  });

  it('Free와 PRO의 투자 관련 AI 한도는 동일하다', () => {
    expect(TIER_LIMITS.pro).toEqual(TIER_LIMITS.free);
  });

  it('일반 분석 프롬프트가 전망·가치판단·행동 고려를 허용하지 않는다', () => {
    expect(SYSTEM_LAYER1).toContain('현재 데이터만으로 이후 가격 방향은 판단할 수 없어요');
    expect(SYSTEM_LAYER1).not.toContain('추가 상승 시 관망 고려');
    expect(SYSTEM_LAYER1).not.toContain('~를 고려해볼 수 있어요');
    expect(SYSTEM_LAYER1).not.toContain('~할 가능성이 높아요');
    expect(SYSTEM_LAYER1).not.toContain('역사적 지지 구간');
    expect(SYSTEM_LAYER1).not.toContain('역사적 저항 구간');
  });

  it('실제 분석 규칙은 개인 보유기록을 요구하거나 추정하지 않는다', () => {
    expect(SYSTEM_LAYER1).toContain('제공된 공개 시세·지표·뉴스의 범위와 누락 확인');
    expect(SYSTEM_LAYER1).not.toContain('사용자 기록 파악');
    expect(SYSTEM_LAYER1).not.toContain('사용자 기록 연결');
    expect(SYSTEM_LAYER1).not.toContain('보유 중인 위험');

    const mentorRules = getMentorLayer2Rules('가치의 등대');
    expect(mentorRules).toContain('개인의 손익, 비중, 목표, 하락 기준은 제공되지 않았으며 추정하지 마세요');
    expect(mentorRules).not.toContain('사용자가 입력한 기록');
  });
});
