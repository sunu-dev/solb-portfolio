'use client';

import { useEffect, useRef } from 'react';
import { STOCK_KR } from '@/config/constants';
import { eunNeun } from '@/utils/koreanJosa';
import { industrySource, type IndustryGroup, type StoredIndustryProfile } from '@/lib/industryRegistry';
import { sectorById, sectorsForCompany, type SectorId } from '@/lib/sectorExploration';
import { explorationCompany, type ExplorationId } from '@/lib/contextExploration';
import { companyBusinessSummary, companyStory } from '@/lib/companyStories';
import CompanyBusinessExplanation from './CompanyBusinessExplanation';
import StockExplorationLink from './StockExplorationLink';
import IndustryDirectory from './IndustryDirectory';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './ContextExploration.module.css';
import layout from './CatalogIndustryExploration.module.css';

interface Props {
  group: IndustryGroup; current?: StoredIndustryProfile; context: string;
  onIndustry: (id: string) => void; onTopic: (id: ExplorationId) => void;
  onSector: (id: SectorId) => void; onExit: () => void;
  focusOnMount?: boolean; selectedCompanySymbol?: string; onCompany: (symbol: string) => void;
  onOpenStock?: (symbol: string) => void;
}
const companyName = (company: { symbol: string; name: string }) => companyStory(company.symbol)?.name || explorationCompany(company.symbol)?.name || STOCK_KR[company.symbol] || company.name;
export default function CatalogIndustryExploration({ group, current, context, onIndustry, onTopic, onSector, onExit, focusOnMount = false, selectedCompanySymbol, onCompany, onOpenStock }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusOnMount) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'nearest' }); } }, [group.id, focusOnMount, selectedCompanySymbol]);
  const source = industrySource(group);
  const parent = sectorById(group.parent);
  const origin = current?.industryId === group.id ? current : undefined;
  const examples = group.examples.filter(item => item.symbol !== origin?.symbol).slice(0, 3);
  const company = [...(origin ? [origin] : []), ...examples].find(item => item.symbol === selectedCompanySymbol);
  const businessSubject = company ?? origin;
  const business = company ? companyBusinessSummary(company.symbol, company.products) : undefined;
  return <section className={`${styles.explore} ${styles.stockReader} ${layout.catalog}`} aria-label={`${context} 이어서 알아보기`} data-context-exploration data-sector-id={group.parent} data-industry-id={group.id}>
    <nav className={layout.history} aria-label="설명 탐색 경로"><button type="button" onClick={onExit}>← 이전 설명</button><button type="button" onClick={() => onSector(group.parent)}>{parent.name} 전체 보기</button></nav>
    {origin?.securityType === 'preferred' && <p className={styles.note}>우선주예요. 발행 회사의 업종으로 연결했으며 보통주와 배당·의결권 조건이 다를 수 있어요.</p>}
    {origin?.listingNote && <p className={styles.note}>보고 있는 종목은 자료 제공처에서 상장폐지 이력이 확인됐어요. 과거 기업의 업종을 연결한 것이며 현재 거래 가능 여부는 별도 확인이 필요해요. 원문: {origin.listingNote}</p>}
    {origin?.evidenceUrl && <a className={styles.source} href={origin.evidenceUrl} target="_blank" rel="noopener noreferrer">이 종목의 분류 원문 · {origin.evidenceCheckedAt?.slice(0, 10)} 확인 ↗</a>}
    {businessSubject && sectorsForCompany(businessSubject.symbol).some(item => item.parent) && <nav className={styles.sectorLinks} aria-label="확인된 사업 분야"><span>실제 사업으로 보기</span>{sectorsForCompany(businessSubject.symbol).filter(item => item.parent).map(item => <button type="button" key={item.id} onClick={() => onSector(item.id)}>{item.name} →</button>)}</nav>}
    <header className={layout.header}>
      <h3 className={layout.heading} ref={heading} tabIndex={-1}>{company ? business ? `${companyName(company)}${eunNeun(companyName(company))} 어떤 회사인가요?` : `${companyName(company)}의 업종·종목 정보` : '같은 업종으로 분류된 회사'}</h3>
      <p className={layout.intro}>{company ? business ?? `${source.name}에는 ‘${group.name}’ 업종으로 등록돼 있어요. 구체적인 사업 설명은 아직 준비하지 못했어요.` : `${source.name}의 ‘${group.name}’ 분류예요. 같은 업종이어도 만드는 제품과 고객은 다를 수 있어요.`}</p>
    </header>
    {company && <CompanyBusinessExplanation key={company.symbol} symbol={company.symbol} />}
    {company ? <StockExplorationLink symbol={company.symbol} onNavigate={onOpenStock}>{companyName(company)} 종목으로 이동</StockExplorationLink> : examples.length > 0 ? <div className={layout.companies} aria-label="같은 업종의 다른 회사">{examples.map(item => <button type="button" key={item.symbol} onClick={() => onCompany(item.symbol)} aria-label={companyName(item)}>
      <span className={layout.companyName}>{companyName(item)} <span aria-hidden="true">›</span></span>
      <span className={layout.products}>{companyBusinessSummary(item.symbol, item.products) || '이 회사의 제품 설명은 아직 준비하지 못했어요.'}</span>
      <span className={layout.symbol}>{item.symbol}</span>
    </button>)}</div> : <p className={layout.intro}>이 업종의 다른 회사는 아직 주비 목록에 없어요. 아래에서 다른 업종을 찾아볼 수 있어요.</p>}
    <details className={styles.selection}><summary className={readingUI.disclosure}>분류와 기업 선정 근거</summary><p className={styles.note}>{source.name} 자료 확인일 · {source.checkedAt.slice(0, 10)}. 원래 업종명은 ‘{group.raw}’예요. {group.market === 'us' ? '기업 예시는 이 자료에 실린 시가총액이 큰 순서로 최대 3개를 골랐어요. 현재 시가총액 순위나 제품 점유율 1위를 뜻하지 않아요.' : '기업 예시는 거래소 자료의 회사명 순서로 최대 3개를 골랐어요. 순위나 대표성 평가가 아니에요.'} 지금 보고 있는 회사는 목록에서 제외했어요. 회사 간 거래 관계나 투자 추천을 뜻하지 않아요.</p><a className={styles.source} href={source.url} target="_blank" rel="noopener noreferrer">{source.name} 원문 ↗<span className="sr-only"> (새 창)</span></a></details>
    <nav className={layout.further} aria-label="회사 비교를 이해하는 개념">
      <button type="button" onClick={() => onTopic('compare')}>같은 업종의 회사를 비교하는 방법 <span aria-hidden="true">›</span></button>
      <button type="button" onClick={() => onTopic('earnings')}>매출과 이익의 차이 <span aria-hidden="true">›</span></button>
    </nav>
    <details className={layout.directory}><summary className={readingUI.disclosure}>다른 업종 찾아보기</summary><IndustryDirectory onSelect={onIndustry} onSector={onSector} /></details>
  </section>;
}
