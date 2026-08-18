import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// AI 인사이트의 장식 아이콘은 OS마다 모양이 달라지는 네이티브 이모지 대신
// 디자인 시스템의 lucide-react를 사용한다. 데이터 파싱·알림 본문은 별도 정책 범위다.
const AI_INSIGHT_ICON_SURFACES = [
  'src/components/insights/InsightsSection.tsx',
  'src/components/insights/InvestorTypeQuiz.tsx',
  'src/components/insights/InvestorTypePicker.tsx',
  'src/components/portfolio/CohortReference.tsx',
  'src/components/portfolio/ThrowbackCard.tsx',
  'src/components/portfolio/PortfolioDNA.tsx',
  'src/components/portfolio/StockPulse.tsx',
  'src/components/portfolio/InvestmentJournal.tsx',
] as const;

const NATIVE_EMOJI = /\p{Extended_Pictographic}/u;

describe('AI 인사이트 아이콘 정책', () => {
  it.each(AI_INSIGHT_ICON_SURFACES)('%s에 네이티브 이모지 아이콘이 없다', (relativePath) => {
    const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
    expect(source.match(NATIVE_EMOJI)?.[0], `${relativePath}에 기본 이모지가 다시 들어왔어요`).toBeUndefined();
  });
});
