'use client';

import { useId, useRef, useState } from 'react';
import { companyExploration, explorationCompany, explorationTopic, sectorForTopic, sectorQuestions, explorationRole, type ExplorationId } from '@/lib/contextExploration';
import { classifiedSectors, SECTORS, sectorById, sectorsForCompany, type SectorId, type SectorProfile } from '@/lib/sectorExploration';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import { industryGroup } from '@/lib/industryRegistry';
import CatalogIndustryExploration from './CatalogIndustryExploration';
import IndustryDirectory from './IndustryDirectory';
import CompanyBusinessExplanation from './CompanyBusinessExplanation';
import { companyBusinessSummary } from '@/lib/companyStories';
import styles from './ContextExploration.module.css';
import SectorIllustration, { SECTOR_ILLUSTRATION_CAPTIONS } from './SectorIllustration';

type Step = { topic: ExplorationId } | { company: string } | { sector: SectorId } | { industry: string; industryCompany?: string };
interface Props { topics: ExplorationId[]; context: string; compact?: boolean; symbol?: string; profile?: SectorProfile }

/** Local, session-only reading trail. No AI call, portfolio write, or tracking of reading content. */
export default function ContextExploration({ topics, context, compact = false, symbol, profile }: Props) {
  const [trail, setTrail] = useState<Step[]>([]);
  const [expanded, setExpanded] = useState(!compact);
  const [catalogDismissed, setCatalogDismissed] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const step = trail.at(-1);
  const topic = step && 'topic' in step ? explorationTopic(step.topic) : undefined;
  const company = step && 'company' in step ? explorationCompany(step.company) : undefined;
  const classification = classifiedSectors(symbol ?? '', profile);
  const originCompany = symbol ? explorationCompany(symbol) : undefined;
  const entrySector = classification.sectors[0] ?? (!symbol && topics[0] ? sectorForTopic(topics[0]) : undefined);
  const priorSector = [...trail].reverse().map(item => 'industry' in item ? sectorById(industryGroup(item.industry)!.parent) : 'sector' in item ? sectorById(item.sector) : 'topic' in item ? sectorForTopic(item.topic) : undefined).find(Boolean) ?? entrySector;
  const companySectors = step && 'company' in step ? sectorsForCompany(step.company) : [];
  const sector = step && 'sector' in step ? sectorById(step.sector) : topic ? sectorForTopic(topic.id) ?? priorSector : company ? companySectors.find(item => item.id === priorSector?.id) ?? companySectors[0] : entrySector;
  const choices = topic?.related ?? (step && 'company' in step ? sector && sector.id !== 'semiconductors' ? sectorQuestions(sector.id) : companyExploration(step.company) : sector ? sectorQuestions(sector.id) : topics);
  const companies = company ? [] : sector ? topic && sectorForTopic(topic.id) && topic.companies.length ? topic.companies : sector.companies : topic?.companies ?? [];
  const sectorIntro = !!sector && !topic && !company;
  const title = topic?.title ?? (company ? `${company.name}는 어떤 역할을 하나요?` : sectorIntro && !compact ? !step && originCompany ? `${originCompany.name} 옆에는 어떤 회사가 있을까요?` : `${sector.name}, 어떤 회사부터 볼까요?` : '다음으로 무엇이 궁금하세요?');
  const navigate = (next: Step[]) => {
    setTrail(next);
    setHasNavigated(true);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'nearest' });
    });
  };
  if (!topics.length) return null;
  const catalog = industryGroup(step && 'industry' in step ? step.industry : !step && !catalogDismissed && classification.basis === 'catalog' ? profile?.classification?.industryId : undefined);
  if (!compact && catalog) return <CatalogIndustryExploration key={catalog.id} focusOnMount={hasNavigated} group={catalog} current={profile?.classification} context={context}
    selectedCompanySymbol={step && 'industry' in step ? step.industryCompany : undefined}
    onCompany={company => navigate([...trail, { industry: catalog.id, industryCompany: company }])}
    onIndustry={industry => navigate([...trail, { industry }])}
    onTopic={topic => navigate([...trail, { topic }])} onSector={sector => navigate([...trail, { sector }])}
    onExit={() => { if (!step) setCatalogDismissed(true); navigate(trail.slice(0, -1)); }} />;
  return <section className={styles.explore} aria-label={`${context} 이어서 알아보기`} data-context-exploration data-sector-id={sector?.id ?? 'unclassified'}>
    {compact && <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>이 소식의 배경 알아보기 <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
    {expanded && <div id={id}>
      <p className={styles.eyebrow}>{context} · 이어서 알아보기</p>
      {compact && <p className={styles.note}>제목과 관련된 배경 설명이에요. 기사 본문 요약이나 이번 주가 변동의 원인 분석은 아니에요.</p>}
      {!step && symbol && classification.basis !== 'reviewed' && <p className={styles.note}>{classification.basis === 'provider' || classification.basis === 'catalog' ? '제공된 기업 지표의 업종 분류로 연결했어요. 아래는 산업의 대표 기업이며 이 종목과의 직접 거래 관계를 뜻하지 않아요.' : profile?.classification?.status === 'etp' ? '펀드·상장지수상품으로 확인된 종목이에요. 개별 기업의 업종 대신 투자 대상과 구성 종목을 확인해야 해요.' : profile?.classification?.status === 'instrument' ? '우선주·채권·워런트·유닛 등 별도 조건을 가진 증권이에요. 발행사와 상품 조건을 확인한 뒤 산업을 연결해야 해요.' : profile?.classification?.status === 'conflict' ? '자료 제공처의 종목 구분이 서로 달라 산업 연결을 보류했어요.' : profile?.classification?.status === 'shell' ? '기업인수목적회사 등으로 분류된 종목이에요. 합병 대상과 실제 사업을 확인한 뒤 산업을 연결해야 해요.' : '이 종목의 산업 연결은 아직 확인하지 못했어요. 아래에서 관심 있는 산업을 직접 살펴볼 수 있어요.'}</p>}
      {!step && classification.sectors.length > 1 && <nav className={styles.sectorLinks} aria-label="이 기업의 산업"><span>사업별로 보기</span>{classification.sectors.map(item => <button type="button" key={item.id} onClick={() => navigate([...trail, { sector: item.id }])}>{item.name}</button>)}</nav>}
      {step && <nav className={styles.history} aria-label="설명 탐색 경로">
        <button type="button" onClick={() => navigate(trail.slice(0, -1))}>← 이전 설명</button>
        <button type="button" onClick={() => navigate([])}>처음 질문</button>
        <span>{trail.length}번째 설명</span>
      </nav>}
      <div className={`${styles.hero} ${sectorIntro && !compact ? styles.sectorHero : ''}`}>
        <div>
          <h3 ref={heading} tabIndex={-1}>{title}</h3>
          {!topic && !company && <p className={styles.summary}>{sector?.intro ?? '궁금한 주제부터 이어서 읽어보세요.'}</p>}
        </div>
        {sectorIntro && !compact && <div className={styles.diagram}>
          <SectorIllustration sector={sector.id} />
          <p className={styles.diagramCaption}>{SECTOR_ILLUSTRATION_CAPTIONS[sector.id] ?? sector.flow.join(' · ')}</p>
        </div>}

      </div>
      {topic && <>
        <p className={styles.summary}>{topic.summary}</p>
        <ol className={styles.steps}>{topic.steps.map(item => <li key={item.title}><strong>{item.title}</strong><p>{item.body}</p></li>)}</ol>
        <div className={styles.watch}><strong>다음에 확인할 것</strong><p>{topic.watch}</p></div>
        <p className={styles.note}>{topic.condition}</p>
        <details className={styles.sources}><summary>설명의 근거 보기</summary>{topic.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗<span className="sr-only"> (새 창)</span></a>)}</details>
      </>}
      {companies.length > 0 && <div className={styles.companies}>
        <div className={styles.sectionHeading}><h4>{sector ? `${sector.name}에서 먼저 알아둘 기업` : '역할을 함께 살펴볼 기업'}</h4></div>
        <div className={styles.companyGrid}>{companies.map(companySymbol => {
          const info = explorationCompany(companySymbol)!;
          const role = explorationRole(companySymbol);
          return <button type="button" key={companySymbol} aria-label={info.name} onClick={() => navigate([...trail, { company: companySymbol }])}>
            {role && <span className={styles.role}>{role.role}{sector?.anchor === companySymbol ? ' · 대표 기업' : ''}</span>}
            <span className={styles.companyName}>{info.name}<span aria-hidden="true"> →</span></span>
            <span className={styles.companyDetail}>{role && 'detail' in role ? role.detail : info.business}</span>
            {symbol && getStockIdentityKey(symbol) === getStockIdentityKey(companySymbol) && <span className={styles.current}>지금 보고 있는 기업</span>}
          </button>;
        })}</div>
        <details className={styles.selection}><summary>어떤 기준으로 골랐나요?</summary><p className={styles.note}>공식 사업 자료에서 제품과 고객을 확인해 고른 기업이에요. 대표 기업은 산업을 이해하는 출발점이며 시가총액·점유율 1위라는 뜻은 아니에요. 표시 순서는 순위가 아니에요. 기업을 누르면 사업 설명과 출처를 볼 수 있어요.</p></details>
      </div>}
      {company && step && 'company' in step && <>
        <p className={styles.summary}>{companyBusinessSummary(step.company)}</p>
        <CompanyBusinessExplanation key={step.company} symbol={step.company} />
        <a className={styles.stock} href={`/?stock=${encodeURIComponent(step.company)}`} target="_blank" rel="noopener noreferrer">{company.name} 시세·뉴스·분석 열기 ↗ <small>(새 탭)</small></a>
        <p className={styles.note}>이 설명을 남겨두고 종목을 살펴볼 수 있어요. 돌아오면 이어서 읽을 수 있어요.</p>
      </>}
      <div className={styles.sectionHeading}><h4>{step ? '이것도 궁금하지 않으세요?' : '이런 것도 궁금하다면'}</h4></div>
      <div className={styles.questions} aria-label="연결된 질문">{choices.slice(0, 3).map((next, index) => <button type="button" key={next} aria-label={explorationTopic(next).title} onClick={() => navigate([...trail, { topic: next }])}>
        <span className={styles.questionNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.questionCopy}><strong>{explorationTopic(next).title}</strong><small>{explorationTopic(next).summary.split(/(?<=요\.)\s/)[0]}</small></span><span aria-hidden="true"> →</span>
      </button>)}</div>
      {choices.length > 3 && <details className={styles.selection}><summary>연결된 질문 더 보기</summary><div className={styles.sectorLinks}>{choices.slice(3).map(next => <button type="button" key={next} onClick={() => navigate([...trail, { topic: next }])}>{explorationTopic(next).title} →</button>)}</div></details>}
      {sector && <nav className={styles.sectorLinks} aria-label="이어지는 산업"><span>이 산업은 어디로 이어질까요?</span>{sector.connections.map(next => <button type="button" key={next} onClick={() => navigate([...trail, { sector: next }])}>{sectorById(next).name} →</button>)}</nav>}
      <details className={styles.directory} data-sector-directory><summary>주요 산업 이야기 <span>{SECTORS.filter(item => !item.parent).length}개 산업 · {SECTORS.filter(item => item.parent).length}개 세부 분야</span></summary><div className={styles.directoryGrid}>{SECTORS.filter(item => !item.parent).map(group => <div key={group.id}><button type="button" onClick={() => navigate([...trail, { sector: group.id }])}>{group.name} →</button>{SECTORS.filter(item => item.parent === group.id).map(child => <button type="button" key={child.id} className={styles.subsector} onClick={() => navigate([...trail, { sector: child.id }])}>{child.name} →</button>)}</div>)}</div></details>
      {!compact && <IndustryDirectory onSelect={industry => navigate([...trail, { industry }])} />}
    </div>}
  </section>;
}
