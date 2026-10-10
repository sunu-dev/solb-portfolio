'use client';

import { useEffect, useRef } from 'react';
import { STOCK_KR } from '@/config/constants';
import { industryIllustration, industrySource, type IndustryGroup, type StoredIndustryProfile } from '@/lib/industryRegistry';
import { sectorById, type SectorId } from '@/lib/sectorExploration';
import { explorationCompany, type ExplorationId } from '@/lib/contextExploration';
import { companyBusinessSummary, companyStory } from '@/lib/companyStories';
import CompanyBusinessExplanation from './CompanyBusinessExplanation';
import SectorIllustration from './SectorIllustration';
import IndustryDirectory from './IndustryDirectory';
import styles from './ContextExploration.module.css';

interface Props {
  group: IndustryGroup; current?: StoredIndustryProfile; context: string;
  onIndustry: (id: string) => void; onTopic: (id: ExplorationId) => void;
  onSector: (id: SectorId) => void; onExit: () => void;
  focusOnMount?: boolean; selectedCompanySymbol?: string; onCompany: (symbol: string) => void;
}
const companyName = (company: { symbol: string; name: string }) => companyStory(company.symbol)?.name || explorationCompany(company.symbol)?.name || STOCK_KR[company.symbol] || company.name;
export default function CatalogIndustryExploration({ group, current, context, onIndustry, onTopic, onSector, onExit, focusOnMount = false, selectedCompanySymbol, onCompany }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusOnMount) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'nearest' }); } }, [group.id, focusOnMount, selectedCompanySymbol]);
  const source = industrySource(group);
  const parent = sectorById(group.parent);
  const origin = current?.industryId === group.id ? current : undefined;
  const examples = [...(origin ? [{ ...origin, marketCap: null }] : []), ...group.examples.filter(item => item.symbol !== origin?.symbol)].slice(0, 4);
  const company = examples.find(item => item.symbol === selectedCompanySymbol);
  const business = company ? companyBusinessSummary(company.symbol, company.products) : undefined;
  const illustration = industryIllustration(group);
  return <section className={styles.explore} aria-label={`${context} 이어서 알아보기`} data-context-exploration data-sector-id={group.parent} data-industry-id={group.id}>
    <p className={styles.eyebrow}>{context} · 이어서 알아보기</p>
    <nav className={styles.history} aria-label="설명 탐색 경로"><button type="button" onClick={onExit}>← 이전 설명</button><button type="button" onClick={() => onSector(group.parent)}>{parent.name} 전체 보기</button></nav>
    {origin?.securityType === 'preferred' && <p className={styles.note}>우선주예요. 발행 회사의 업종으로 연결했으며 보통주와 배당·의결권 조건이 다를 수 있어요.</p>}
    {origin?.listingNote && <p className={styles.note}>보고 있는 종목은 자료 제공처에서 상장폐지 이력이 확인됐어요. 과거 기업의 업종을 연결한 것이며 현재 거래 가능 여부는 별도 확인이 필요해요. 원문: {origin.listingNote}</p>}
    {origin?.evidenceUrl && <a className={styles.source} href={origin.evidenceUrl} target="_blank" rel="noopener noreferrer">이 종목의 분류 원문 · {origin.evidenceCheckedAt?.slice(0, 10)} 확인 ↗</a>}
    <p className={styles.note}>{group.market === 'us' ? '미국' : '한국'} 분류 · {group.name}</p>
    <div className={`${styles.hero} ${company ? '' : styles.sectorHero}`}>
      <div><h3 ref={heading} tabIndex={-1}>{company ? business ? `${companyName(company)}는 어떤 회사인가요?` : `${companyName(company)}의 업종·종목 정보` : origin ? `${companyName(origin)}와 같은 업종에는 어떤 회사가 있을까요?` : `${group.name}, 어떤 회사부터 볼까요?`}</h3>
        <p className={styles.summary}>{company ? business ?? `현재 확인된 정보는 ‘${group.name}’ 업종 분류예요. 이 회사의 구체적인 사업 설명은 아직 준비되지 않았어요.` : `${source.name}의 ‘${group.name}’ 분류에 포함된 기업을 함께 살펴보세요. 같은 업종이어도 제품과 고객, 수익 구조는 다를 수 있어요.`}</p></div>
      {!company && <div className={styles.diagram}><SectorIllustration sector={illustration} /><p className={styles.diagramCaption}>{sectorById(illustration).name}의 대표 장면</p></div>}
    </div>
    {company && <CompanyBusinessExplanation key={company.symbol} symbol={company.symbol} />}
    {company ? <><a className={styles.stock} href={`/?stock=${encodeURIComponent(company.symbol)}`} target="_blank" rel="noopener noreferrer">{companyName(company)} 시세·뉴스·분석 열기 ↗ <small>(새 탭)</small></a><p className={styles.note}>이 설명을 남겨두고 종목을 살펴볼 수 있어요.</p></> : <div className={styles.companies}><div className={styles.sectionHeading}><h4>같은 업종에서 함께 살펴볼 기업</h4></div><div className={styles.companyGrid}>{examples.map(item => <button type="button" key={item.symbol} onClick={() => onCompany(item.symbol)} aria-label={companyName(item)}><span className={styles.role}>{group.name}{origin?.symbol === item.symbol ? ' · 지금 보고 있는 기업' : ''}</span><span className={styles.companyName}>{companyName(item)} <span aria-hidden="true">→</span></span><span className={styles.companyDetail}>{item.products || `${item.symbol} · ${source.name} 업종 분류`}</span></button>)}</div></div>}
    <details className={styles.selection}><summary>분류와 기업 선정 근거</summary><p className={styles.note}>{source.name} 자료 확인일 · {source.checkedAt.slice(0, 10)}. 원래 업종명은 ‘{group.raw}’예요. {group.market === 'us' ? '기업 예시는 이 자료에 실린 시가총액이 큰 순서로 최대 3개를 골랐어요. 현재 시가총액 순위나 제품 점유율 1위를 뜻하지 않아요.' : '기업 예시는 거래소 자료의 회사명 순서로 최대 3개를 골랐어요. 순위나 대표성 평가가 아니에요.'} 지금 보고 있는 기업은 먼저 표시해요. 직접 거래 관계나 투자 추천을 뜻하지 않아요.</p><a className={styles.source} href={source.url} target="_blank" rel="noopener noreferrer">{source.name} 원문 ↗<span className="sr-only"> (새 창)</span></a></details>
    <div className={styles.sectionHeading}><h4>이것도 궁금하지 않으세요?</h4></div>
    <div className={styles.questions}><button type="button" onClick={() => onTopic('compare')}><span>같은 업종 회사도 실적이 다른 이유는 뭘까요?</span><span aria-hidden="true"> →</span></button><button type="button" onClick={() => onTopic('earnings')}><span>매출이 늘면 이익도 늘어날까요?</span><span aria-hidden="true"> →</span></button><button type="button" onClick={() => onSector(group.parent)}><span>{parent.name}의 다른 사업도 살펴볼까요?</span><span aria-hidden="true"> →</span></button></div>
    <IndustryDirectory onSelect={onIndustry} />
  </section>;
}
