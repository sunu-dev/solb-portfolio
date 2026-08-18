import { describe, expect, it } from 'vitest';
import {
  FREE_TOOL_BASELINE,
  PRO_PLAN,
  PRO_TOOL_FEATURES,
  SHARED_INVESTMENT_ACCESS,
} from '@/config/proPlan';
import { resolveProEntitlements } from '@/lib/proEntitlements';
import { buildProReadiness } from '@/lib/proReadiness';
import { isProMembershipValid, TIER_LIMITS } from '@/lib/userTier';
import {
  buildPortfolioCsv,
  buildPortfolioJson,
  parsePortfolioBackupJson,
} from '@/utils/portfolioExport';
import { canTransitionSubscription, deriveSubscriptionEntitlement } from '@/lib/subscriptionState';
import {
  evaluateFakeDoorExperiment,
  evaluatePaidBeta,
  isQualifiedProDemandCandidate,
  isProDemandPlacement,
  PRO_DEMAND_EVENT_NAMES,
} from '@/lib/proDemandValidation';
import { sanitizeProDemandActivity } from '@/lib/proDemandActivity';

describe('도구형 PRO 경계', () => {
  it('투자 관련 AI 접근은 Free와 PRO가 완전히 동일하다', () => {
    expect(TIER_LIMITS.pro).toEqual(TIER_LIMITS.free);
    expect(SHARED_INVESTMENT_ACCESS).toContain('ai_analysis_count');
    expect(SHARED_INVESTMENT_ACCESS).toContain('ai_analysis_quality');
    expect(SHARED_INVESTMENT_ACCESS).toContain('ai_analysis_speed');
  });

  it('PRO 혜택 문구에 투자정보 유료 차등이 들어가지 않는다', () => {
    const copy = JSON.stringify(PRO_TOOL_FEATURES);
    expect(copy).not.toContain('종목 추천');
    expect(copy).not.toContain('매수');
    expect(copy).not.toContain('매도');
    expect(copy).not.toContain('AI 분석');
    expect(copy).not.toContain('시세 속도');
  });

  it('기본 데이터 이동권과 기본 통합은 무료 기준에 남는다', () => {
    expect(FREE_TOOL_BASELINE).toContain('기본 CSV·JSON 수동 내보내기');
    expect(FREE_TOOL_BASELINE).toContain('기본 다중 증권사 통합');
    expect(PRO_TOOL_FEATURES.find((feature) => feature.id === 'advanced_portfolio_export')?.description)
      .toContain('기본 수동 내보내기는 무료');
  });

  it('무료는 도구 권한이 없고 PRO만 정의된 도구 권한을 갖는다', () => {
    expect(Object.values(resolveProEntitlements('free')).every((value) => !value)).toBe(true);
    expect(Object.values(resolveProEntitlements('pro')).every(Boolean)).toBe(true);
    expect(Object.keys(resolveProEntitlements('pro')).sort()).toEqual(
      PRO_TOOL_FEATURES.map((feature) => feature.id).sort(),
    );
  });

  it('모든 필수 게이트와 판매 요청이 있어야 판매 준비 상태가 된다', () => {
    expect(buildProReadiness({}).readyForSales).toBe(false);
    const ready = buildProReadiness({
      PRO_TOOLS_SALES_ENABLED: 'true',
      PRO_TOOLS_SCHEMA_READY: 'true',
      PRO_TOOLS_LEGAL_APPROVED: 'true',
      PRO_TOOLS_POLICIES_READY: 'true',
      PRO_TOOLS_BILLING_READY: 'true',
      PRO_TOOLS_BUSINESS_READY: 'true',
      PRO_TOOLS_MANUAL_GRANTS_AUDITED: 'true',
      PRO_TOOLS_RESTORE_DRILL_READY: 'true',
      PRO_TOOLS_METRICS_READY: 'true',
      PRO_TOOLS_SUPPORT_READY: 'true',
    });
    expect(ready.readyForSales).toBe(true);
    expect(ready.planId).toBe(PRO_PLAN.id);
  });

  it('PRO 만료일이 지나면 권한을 닫고 기존 수동 PRO는 호환한다', () => {
    const now = Date.parse('2026-07-18T00:00:00.000Z');
    expect(isProMembershipValid({ tier: 'pro', pro_until: '2026-07-19T00:00:00.000Z' }, now)).toBe(true);
    expect(isProMembershipValid({ tier: 'pro', pro_until: '2026-07-17T00:00:00.000Z' }, now)).toBe(false);
    expect(isProMembershipValid({ tier: 'pro', pro_until: null }, now)).toBe(true);
    expect(isProMembershipValid({ tier: 'free', pro_until: null }, now)).toBe(false);
  });

  it('구독 상태 전이를 제한하고 연체 유예기간 이후 권한을 닫는다', () => {
    expect(canTransitionSubscription('active', 'past_due')).toBe(true);
    expect(canTransitionSubscription('expired', 'active')).toBe(false);

    const periodEnd = '2026-07-18T00:00:00.000Z';
    const inGrace = deriveSubscriptionEntitlement(
      { status: 'past_due', currentPeriodEnd: periodEnd },
      Date.parse('2026-07-20T00:00:00.000Z'),
    );
    const afterGrace = deriveSubscriptionEntitlement(
      { status: 'past_due', currentPeriodEnd: periodEnd },
      Date.parse('2026-07-22T00:00:00.000Z'),
    );
    expect(inGrace).toMatchObject({ active: true, reason: 'past_due_grace' });
    expect(afterGrace).toMatchObject({ active: false, reason: 'period_ended' });
  });
});

describe('포트폴리오 내보내기 기반', () => {
  const stocks = {
    investing: [{
      symbol: '=DANGEROUS',
      name: '+FORMULA',
      avgCost: 100,
      shares: 2,
      targetReturn: 20,
      notes: [{ date: '2026-07-18', emoji: '', text: '+FORMULA' }],
    }],
    watching: [{ symbol: 'DEMO', avgCost: 0, shares: 0, targetReturn: 0, demo: true }],
    sold: [],
  };

  it('CSV 수식 주입을 중립화하고 데모 종목을 제외한다', () => {
    const csv = buildPortfolioCsv(stocks);
    expect(csv).toContain("'=DANGEROUS");
    expect(csv).toContain("'+FORMULA");
    expect(csv).not.toContain('DEMO');
  });

  it('JSON에 장기 기록 스키마를 넣고 데모 종목을 제외한다', () => {
    const json = JSON.parse(buildPortfolioJson(stocks, [{
      date: '2026-07-18',
      totalValue: 200,
      totalCost: 180,
      stocks: [],
    }])) as {
      schema: string;
      stocks: { watching: unknown[] };
      dailySnapshots: unknown[];
    };
    expect(json.schema).toBe('joobi-portfolio-backup-v2');
    expect(json.stocks.watching).toEqual([]);
    expect(json.dailySnapshots).toHaveLength(1);
  });

  it('JSON 저장본을 검증해 종목·스냅샷을 다시 읽고 구버전 종목 파일도 허용한다', () => {
    const backup = buildPortfolioJson(stocks, [{
      date: '2026-07-18',
      totalValue: 200,
      totalCost: 180,
      stocks: [],
    }]);
    const restored = parsePortfolioBackupJson(backup);
    expect(restored.sourceSchema).toBe('joobi-portfolio-backup-v2');
    expect(restored.payload.stocks.investing).toHaveLength(1);
    expect(restored.payload.snapshots).toHaveLength(1);

    const legacy = parsePortfolioBackupJson(JSON.stringify({
      schema: 'joobi-portfolio-export-v1',
      stocks,
    }));
    expect(legacy.payload.stocks.investing).toHaveLength(1);
    expect(legacy.payload.snapshots).toEqual([]);
  });
});

describe('PRO 실제 지불의향 판정', () => {
  it('여러 증권사·반복 관리 사용자를 적격 사용자로 분류한다', () => {
    expect(isQualifiedProDemandCandidate({
      brokerCount: 2,
      holdingCount: 15,
      visitsLast14Days: 2,
      importOrEditCountLast14Days: 2,
    })).toBe(true);
    expect(isQualifiedProDemandCandidate({
      brokerCount: 1,
      holdingCount: 30,
      visitsLast14Days: 5,
      importOrEditCountLast14Days: 5,
    })).toBe(false);
  });

  it('가짜 문은 최소 표본과 사전 전환 기준으로 판정한다', () => {
    expect(evaluateFakeDoorExperiment({ eligibleExposures: 99, startClicks: 30, waitlistSubmissions: 20 }))
      .toBe('insufficient_data');
    expect(evaluateFakeDoorExperiment({ eligibleExposures: 100, startClicks: 4, waitlistSubmissions: 4 }))
      .toBe('stop_or_redesign');
    expect(evaluateFakeDoorExperiment({ eligibleExposures: 100, startClicks: 12, waitlistSubmissions: 6 }))
      .toBe('go');
  });

  it('실제 결제와 45일 유지·가치 사용·단위 경제를 함께 통과해야 GO다', () => {
    expect(evaluatePaidBeta({
      invited: 20,
      paid: 5,
      retainedAtDay45: 4,
      coreValueUsers: 3,
      refunds: 0,
      contributionMarginRate: 0.7,
      monthlySupportMinutesPerPaidUser: 15,
    })).toBe('go');
    expect(evaluatePaidBeta({
      invited: 20,
      paid: 4,
      retainedAtDay45: 4,
      coreValueUsers: 3,
      refunds: 0,
      contributionMarginRate: 0.8,
      monthlySupportMinutesPerPaidUser: 5,
    })).toBe('stop_or_redesign');
  });

  it('수요 이벤트 이름에는 투자정보가 포함되지 않는다', () => {
    const events = PRO_DEMAND_EVENT_NAMES.join(' ');
    expect(events).not.toMatch(/ticker|symbol|shares|price|asset|holding/);
  });

  it('수요 이벤트 배치 위치는 허용 목록만 받는다', () => {
    expect(isProDemandPlacement('backup')).toBe(true);
    expect(isProDemandPlacement('stock_recommendation')).toBe(false);
  });

  it('로컬 활동 기록은 14일 범위와 최대 개수만 보존한다', () => {
    const now = Date.parse('2026-07-19T12:00:00+09:00');
    const recent = now - 24 * 60 * 60 * 1000;
    const old = now - 20 * 24 * 60 * 60 * 1000;
    const activity = sanitizeProDemandActivity({
      visitDays: ['2026-07-01', '2026-07-18', 'invalid', '2026-07-18'],
      managementActions: [old, recent, ...Array.from({ length: 60 }, (_, index) => recent + index)],
    }, now);
    expect(activity.visitDays).toEqual(['2026-07-18']);
    expect(activity.managementActions).toHaveLength(50);
    expect(activity.managementActions).not.toContain(old);
  });
});
