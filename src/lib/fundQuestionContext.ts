import { fundProfile, FUND_MECHANISMS } from '@/lib/fundExploration';
import { getStoredIndustry } from '@/lib/storedIndustry';
import { isSingleStockLeverage } from '@/utils/leverageGuard';
import { benchmarkLesson } from './fundLearning';

/** Server-owned catalogue wins over request text; names only widen product safeguards. */
export function isFundAnalysis(symbol: string, name = ''): boolean {
  return Boolean(fundProfile(symbol)) || getStoredIndustry(symbol).status === 'etp'
    || isSingleStockLeverage(symbol, name)
    || /\b(?:ETF|ETN|ETP|FUND)\b|상장지수|상장지수증권/i.test(name);
}

export function fundAnalysisContext(symbol: string): string {
  const profile = fundProfile(symbol);
  const boundary = `## 상품 설명 기준 — 기업 실적 관점보다 우선
이 대상은 펀드·상장상품입니다. 일반 회사로 보고 자체 매출·이익·영업현금흐름·PER로 평가하지 마세요.
수익이 생기는 구조와 손실 경로를 쉽게 설명하세요. 회사 지표가 전달되어도 상품 자체의 실적으로 해석하지 마세요.
기초지수·투자대상과 하루 목표 배수는 다른 개념입니다. 일일 목표를 장기 수익의 배수나 보장 수익으로 말하지 마세요.
최신 구성 비중·보수·분배금·수익률은 제공되지 않았으므로 만들지 마세요. 구조 설명을 오늘 변동의 원인으로 단정하지 마세요.`;
  if (!profile) return `${boundary}
이 상품은 검증한 상세 구조 설명의 제공 범위 밖입니다. 기초지수·투자대상·배수·수익 방식은 미확인입니다. 이름으로 추정하지 말고 운용사·발행사의 투자설명서에서 확인할 항목을 안내하세요.`;
  const mechanism = FUND_MECHANISMS[profile.kind];
  const benchmark = benchmarkLesson(profile);
  const singleStockLeverage = profile.kind === 'leverage' && Boolean(profile.underlyingSymbol);
  const flow = singleStockLeverage
    ? ['기준 주식의 하루 주가 변화', '정해진 배수 목표', '매일 다시 맞추기']
    : mechanism.flow;
  const returns = singleStockLeverage
    ? `${profile.target}의 하루 주가 변화를 기준으로 정해진 배수만큼 움직이는 것이 목표예요. 여러 회사를 묶은 지수를 따라가는 상품은 아니에요. 매일 달라진 금액을 기준으로 투자 규모를 다시 맞추므로, 며칠간의 수익률은 기준 주식 수익률에 배수를 곱한 값과 달라질 수 있어요.`
    : mechanism.returns;
  const basis = profile.underlyingSymbol ? '기준 주식이' : '기준 지수가';
  const dailyExample = profile.multiple !== undefined ? `\n수익 구조를 답할 때 사용할 가상 하루 예시: ${basis} 하루 1% 오르면 이 상품은 ${profile.multiple > 0 ? '+' : ''}${profile.multiple}%를, 1% 내리면 ${-profile.multiple > 0 ? '+' : ''}${-profile.multiple}%를 목표로 해요. 실제 결과에는 비용과 추적 차이가 있어요. 이 예시는 가정이며 실제 오늘 등락과 구분하세요. 기준이 회사 주식인지 여러 기업을 묶은 지수인지 설명하세요. 며칠 동안의 수익이 그 배수라는 뜻은 아니에요.` : '';
  return `${boundary}
아래는 서버가 보관한 상품 구조 자료이며, 실시간 상품 수치가 아니에요.
상품: ${profile.symbol} (${profile.name})
${benchmark ? `따라가는 기준의 뜻: ${benchmark.meaning}\n${benchmark.detail}` : ''}
자료 확인일: ${profile.checkedAt}
투자대상·기초 기준: ${profile.target}
일일 목표 배수: ${profile.multiple !== undefined ? `${profile.multiple}배 (하루 기준, 비용·추적 차이 전 목표)` : '이 자료에 별도 일일 배수 목표 없음. 임의로 배수를 부여하지 마세요.'}
구조 유형: ${mechanism.label}
수익 전달 과정: ${flow.join(' → ')}
수익 구조: ${returns}
위험: ${mechanism.risk}
${dailyExample}
공식 확인자료: ${profile.issuerUrl}
보조 자료: ${profile.sourceUrl}`;
}

export function fundAnalysisSources(symbol: string) {
  const p = fundProfile(symbol);
  return p ? [{ name: '상품 구조', provider: '운용사·발행사 상품 설명', retrievedAt: p.checkedAt, url: p.issuerUrl, note: '주비 상품 자료 확인일' }] : [];
}
