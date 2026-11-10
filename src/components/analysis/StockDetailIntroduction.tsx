import { ChevronRight } from 'lucide-react';
import FinancialText from '../common/FinancialText';
import { companyBusinessProfile } from '@/lib/companyBusinessProfile';
import { companyStory } from '@/lib/companyStories';
import { fundProfile, fundSummary } from '@/lib/fundExploration';
import type { SectorProfile } from '@/lib/sectorExploration';
import styles from './StockDetailIntroduction.module.css';

/** Reuse the same sourced facts as company/product understanding, including its withdrawal decision. */
export default function StockDetailIntroduction({ symbol, name, isFund, profile, onOpen }: {
  symbol: string; name: string; isFund: boolean; profile?: SectorProfile; onOpen: () => void;
}) {
  const business = companyBusinessProfile(symbol, profile?.classification, profile?.business);
  const fund = isFund ? fundProfile(symbol) : undefined;
  const story = !isFund && business.summary && business.origin !== 'engine' ? companyStory(symbol) : undefined;
  const known = fund ? fundSummary(fund) : story?.headline ?? business.summary;
  // A brief excerpt is followed by the complete explanation; never synthesize facts from an industry.
  const end = known?.indexOf('요.');
  const sentence = known && typeof end === 'number' && end >= 0 ? known.slice(0, end + 2) : known;
  return <div className={styles.introduction} data-stock-introduction>
    <p className={styles.copy}>{sentence
      ? <FinancialText>{sentence}</FinancialText>
      : isFund ? '투자 대상과 상품 구조를 살펴보세요.' : business.availability === 'loading' ? '회사 소개를 확인하고 있어요.' : '확인된 회사 자료를 살펴보세요.'}</p>
    <button type="button" className={styles.more} onClick={onOpen} aria-label={`${name} ${isFund ? '상품' : '회사'} 이해로 이동`}>
      자세히 <ChevronRight size={16} aria-hidden="true" />
    </button>
  </div>;
}
