'use client';

import { useArrivalMessage } from '@/hooks/useArrivalMessage';
import Image from 'next/image';
import { ArrowRight, ChevronRight, Search } from 'lucide-react';
import { explorationCompany } from '@/lib/contextExploration';
import CompanyMark from '../common/CompanyMark';
import appUI from '../ui/AppUI.module.css';
import styles from './PortfolioEmptyState.module.css';
import PortfolioTools from './PortfolioTools';

type Props = {
  title: string;
  suggestions: readonly { symbol: string; label: string; description?: string }[];
  onSearch: () => void;
  onStock: (symbol: string) => void;
  onSample: () => void;
  onReport?: () => void;
  onImport?: () => void;
};
export default function PortfolioEmptyState({ title, suggestions, onSearch, onStock, onSample, onReport, onImport }: Props) {
  const greeting = useArrivalMessage();
  return <section className={styles.empty} aria-label="내 투자 시작하기">
    <header className={styles.intro}>
      <div><h1>{onReport ? '내 투자' : title}</h1>
        <p className={styles.eyebrow}>{onReport ? '종목을 추가하면 시세와 소식을 함께 볼 수 있어요.' : '관심 있는 회사와 보유 종목을 모아보세요.'}</p>
      </div>
      {onReport && <PortfolioTools />}
    </header>
    {onReport && <span className={styles.marketContext}>{greeting.context}</span>}
    <button type="button" className={`${appUI.secondaryButton} ${styles.search}`} aria-label="종목 검색하기" onClick={onSearch}><Search size={20} strokeWidth={1.8} aria-hidden="true" /><span>어떤 종목을 찾으세요?</span><span className={styles.searchHint}>회사명 · 종목 코드</span></button>
    <aside className={styles.start} aria-label="내 투자 화면 시작하기">
      <span className={styles.startLabel}>내 종목 시작하기</span>
      <h2>{onReport ? <>보유한 종목부터{/* keep-br: tagline */}<br />한곳에 모아보세요</> : title}</h2>
      <p>시세와 내 수익, 관련 소식을 한눈에. 관심 있는 종목만 등록해도 괜찮아요.</p>
      <div className={styles.startBottom}>
        <div className={styles.startActions}>
          <button type="button" className={appUI.accentButton} onClick={onSearch}>내 종목 등록하기 <ArrowRight size={16} aria-hidden="true" /></button>
          {onImport && <button type="button" className={appUI.textButton} onClick={onImport}>증권앱에서 가져오기</button>}
        </div>
        <Image className={styles.startArtwork} src="/illustrations/home/portfolio-handdrawn-v2.png" alt="" width={1536} height={1024} sizes="(max-width:700px) 140px, 180px" loading="eager" />
      </div>
      <div className={styles.sample}><span>먼저 둘러보고 싶다면</span><button type="button" className={appUI.textButton} onClick={onSample}>예시 포트폴리오 체험 <ChevronRight size={15} aria-hidden="true" /></button></div>
    </aside>
    <div className={styles.explore}>
      <div className={styles.sectionTitle}><h2>기업 둘러보기</h2><span>하는 일부터 알아봐요</span></div>
      <ul>{suggestions.map(stock => <li key={stock.symbol}><button type="button" aria-label={`${stock.label} 살펴보기`} onClick={() => onStock(stock.symbol)}>
        <CompanyMark symbol={stock.symbol} />
        <span className={styles.company}>{stock.label}<small>{stock.description ?? explorationCompany(stock.symbol)?.business ?? stock.symbol}</small></span>
        <span className={styles.symbol}>{stock.symbol.replace('.KS', '')}</span>
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </button></li>)}</ul>
    </div>
    {onReport && <button type="button" className={styles.report} onClick={onReport}><span><small>주비 리포트 · 시장 흐름과 기업 소식</small><strong>오늘 시장은 어떤가요?</strong></span><span className={styles.reportArrow}><ArrowRight size={20} aria-hidden="true" /></span></button>}
  </section>;
}
