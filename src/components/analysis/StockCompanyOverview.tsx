import FinancialText from '@/components/common/FinancialText';
import { eunNeun } from '@/utils/koreanJosa';
import { companyStory } from '@/lib/companyStories';
import { companyBusinessProfile } from '@/lib/companyBusinessProfile';
import { classifiedSectors, type SectorProfile } from '@/lib/sectorExploration';
import { industryArtwork, sectorArtwork } from '@/lib/sectorArtwork';
import { SectorArtworkView } from '../explore/SectorIllustration';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './StockCompanyOverview.module.css';
import CompanyBusinessFlow from './CompanyBusinessFlow';
import StockPriceDrivers from './StockPriceDrivers';
import InstrumentExplorationEntry from '../explore/InstrumentExplorationEntry';
import type { ExplorationReadingState } from '../explore/ContextExploration';

export default function StockCompanyOverview({ symbol, name, profile, onRetry, exploration, onExplorationChange, onOpenStock }: {
  symbol: string; name: string; profile?: SectorProfile; onRetry?: () => void;
  exploration?: { open?: boolean; reading?: ExplorationReadingState };
  onExplorationChange?: (state: { open?: boolean; reading?: ExplorationReadingState }) => void;
  onOpenStock?: (symbol: string, reading: ExplorationReadingState) => void;
}) {
  const story = companyStory(symbol);
  const business = companyBusinessProfile(symbol, profile?.classification, profile?.business);
  const restricted = business.level === 'restricted';
  const summary = business.summary;
  const detail = business.origin === 'engine' ? (business.level === 'detailed' ? business : undefined) : story;
  const sources = business.sources;
  const classification = classifiedSectors(symbol, profile);
  const sector = classification.sectors[0];
  const reviewedArt = classification.basis === 'reviewed' && sector && sectorArtwork(sector.id)
    ? { id:sector.id, artwork:sectorArtwork(sector.id) } : undefined;
  const art = restricted || !summary ? undefined : reviewedArt
    || (profile?.classification?.industryId && industryArtwork(profile.classification.industryId))
    || (sector && sectorArtwork(sector.id) ? { id:sector.id, artwork:sectorArtwork(sector.id) } : undefined);

  return <section className={styles.overview} aria-label={`${name} 회사 한눈에`} data-company-overview data-company-coverage={business.level}
    data-explanation-overview="company" data-explanation-coverage={business.level}>
    <div className={styles.hero}>
      <div className={styles.introduction}>
        <p className={styles.eyebrow}>회사 이해</p>
        <h3 className={styles.title}>{summary ? (business.origin === 'engine' ? undefined : story?.headline) ?? `${name}${eunNeun(name)} 어떤 회사인가요?` : `${name} · 종목·업종 정보`}</h3>
        <p className={styles.lead} data-explanation-summary><FinancialText>{summary ?? (restricted ? '이 종목은 증권 종류나 기업 상태를 먼저 확인해야 해요. 아래 종목 정보에서 확인된 분류를 살펴보세요.' : business.availability === 'loading' ? '사업 소개를 확인하고 있어요.' : business.availability === 'unavailable' ? '사업 소개를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.' : business.availability === 'rechecking' ? '사업 소개의 근거를 다시 확인하고 있어요.' : '이 회사의 사업 소개는 주비에 아직 준비되지 않았어요.')}</FinancialText></p>
        {business.availability === 'unavailable' && onRetry && <button type="button" className={styles.retry} onClick={onRetry}>회사 설명 다시 불러오기</button>}
        {sector && !restricted && <span className={styles.businessLabel}>{sector.name} · {classification.basis === 'reviewed' ? '확인한 사업 분야' : '거래소·자료 제공처의 업종'}</span>}
        {business.origin === 'engine' && business.sourcePublishedAt && <span className={styles.businessLabel}>사업 자료 {business.sourcePublishedAt.slice(0, 10).replaceAll('-', '. ')} 발표 기준</span>}
      </div>

    </div>
    {detail && !restricted && <p className={styles.lead}><FinancialText>{detail.revenue ?? ''}</FinancialText></p>}

    {detail && !restricted && <details className={styles.businessQuestion}><summary className={readingUI.disclosure}>고객과 수익 구조 자세히 보기</summary><div className={styles.chapters}>
      <section className={styles.chapter}><span className={styles.number} aria-hidden="true">01</span><div><h4>누가, 왜 쓰나요?</h4><p><FinancialText>{detail.customers ?? ''}</FinancialText></p></div></section>
      <section className={styles.chapter}><span className={styles.number} aria-hidden="true">02</span><div><h4>어떻게 돈을 버나요?</h4><p><FinancialText>{detail.revenue ?? ''}</FinancialText></p>{business.origin !== 'engine' && <CompanyBusinessFlow symbol={symbol} />}</div></section>
      <section className={styles.chapter}><span className={styles.number} aria-hidden="true">03</span><div><h4>다음 실적에서 볼 것</h4><p>{detail.watch?.replace(/^주비의 점검 관점이에요\.\s*/, '')}</p><span className={styles.editorialNote}>주비의 점검 관점</span></div></section>
    </div></details>}
    {summary && !restricted && <StockPriceDrivers />}
    {story && business.origin !== 'engine' && !restricted && <div className={styles.companyQuestions} aria-label={`${name} 더 알아보기`}>{story.questions.map(question => <details key={question.id} className={styles.businessQuestion}>
      <summary className={readingUI.disclosure}>{question.question}</summary>
      <p>{question.answer}</p>
    </details>)}</div>}
    {!restricted && <InstrumentExplorationEntry label={sector ? `${sector.name} 분야의 다른 회사` : '산업 둘러보기'} symbol={symbol} profile={profile} sector={sector?.id}
      description={sector ? '같은 업종에 속한 회사의 제품 살펴보기' : '관심 있는 산업에서 기업 찾아보기'}
      scope={sector ? undefined : '이 종목의 업종 정보는 아직 없어요. 관심 있는 산업을 직접 골라볼 수 있어요.'}
      open={exploration?.open} onOpenChange={open => onExplorationChange?.({ ...exploration, open })}
      reading={exploration?.reading} onReadingChange={reading => onExplorationChange?.({ ...exploration, reading })} onOpenStock={onOpenStock} />}
    {!detail && summary && <p className={styles.note}>사업별 매출 비중과 자세한 수익 구조는 아직 정리하지 못했어요.</p>}
    <div className={styles.references}>
      {story && business.origin !== 'engine' && !restricted && <details><summary className={readingUI.disclosure}>생활 속 예로 이해하기</summary><p>{story.example}</p><small>이해를 돕기 위한 가상 상황이에요.</small></details>}
      {sources.length > 0 && <section className={styles.sourceList} aria-label="사업 설명의 근거"><h4>사업 설명의 근거</h4>{sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}{'reviewedAt' in source ? ` · ${source.reviewedAt} 확인` : ''} ↗<span className="sr-only"> (새 창)</span></a>)}</section>}
      {art && <details className={styles.industryVisual}><summary className={readingUI.disclosure}>산업 그림으로 살펴보기</summary><div className={styles.artwork}>
        <SectorArtworkView key={art.id} id={art.id} art={art.artwork} />
        <p className={styles.artNote}>산업을 설명하는 대표 장면이에요. 이 회사의 실제 설비는 아니에요.</p>
      </div></details>}
    </div>
  </section>;
}
