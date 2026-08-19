import Image from 'next/image';
import styles from './lockup-30.module.css';

const concepts = [
  { name: 'Lexend', tone: '편안한 명료함', card: styles.mintCore, font: styles.fontLexend },
  { name: 'Instrument Sans', tone: '정밀한 제품형', card: styles.inkEditorial, font: styles.fontInstrument },
  { name: 'Manrope', tone: '부드러운 현대형', card: styles.electricBlue, font: styles.fontManrope },
  { name: 'Sora', tone: '글로벌 앱형', card: styles.warmPaper, font: styles.fontSora },
  { name: 'Space Grotesk', tone: '창의적 기술형', card: styles.monoUtility, font: styles.fontSpace },
  { name: 'Bricolage Grotesque', tone: '개성 있는 제품형', card: styles.coralPop, font: styles.fontBricolage },
  { name: 'Syne', tone: '예술적 포스터형', card: styles.violetIntelligence, font: styles.fontSyne },
  { name: 'Urbanist', tone: '친근한 소비자형', card: styles.citrusLabel, font: styles.fontUrbanist },
  { name: 'Outfit', tone: '앱 아이콘 친화형', card: styles.aquaGlass, font: styles.fontOutfit },
  { name: 'Archivo Black', tone: '강한 도구형', card: styles.navyGold, font: styles.fontArchivo },
  { name: 'Fraunces', tone: '현대적 편집형', card: styles.paperGrid, font: styles.fontFraunces },
  { name: 'DM Serif Display', tone: '부드러운 고급형', card: styles.softLilac, font: styles.fontDmSerif },
  { name: 'Cormorant Garamond', tone: '섬세한 패션형', card: styles.terminalGreen, font: styles.fontCormorant },
  { name: 'Playfair Display', tone: '전통 금융형', card: styles.slateModule, font: styles.fontPlayfair },
  { name: 'Montserrat Alternates', tone: '기하학적 대안형', card: styles.redSignal, font: styles.fontMontserratAlt },
  { name: 'Unbounded', tone: '넓은 미래형', card: styles.skySystem, font: styles.fontUnbounded },
  { name: 'Righteous', tone: '복고 미래형', card: styles.peachHuman, font: styles.fontRighteous },
  { name: 'Chakra Petch', tone: '시장 터미널형', card: styles.forestArchive, font: styles.fontChakra },
  { name: 'Bebas Neue', tone: '응축된 신호형', card: styles.chromeProduct, font: styles.fontBebas },
  { name: 'Black Ops One', tone: '스텐실 정체성형', card: styles.midnightGlow, font: styles.fontBlackOps },
  { name: 'Onest', tone: '차분한 SaaS형', card: styles.sandAtelier, font: styles.fontOnest },
  { name: 'Inter Tight', tone: '밀도 높은 인터페이스형', card: styles.cobaltFrame, font: styles.fontInterTight },
  { name: 'Figtree', tone: '깨끗한 서비스형', card: styles.roseStudio, font: styles.fontFigtree },
  { name: 'Epilogue', tone: '독립적인 기하형', card: styles.yolkPoster, font: styles.fontEpilogue },
  { name: 'Red Hat Display', tone: '인간적인 기술형', card: styles.icePrecision, font: styles.fontRedHat },
  { name: 'League Spartan', tone: '대담한 헤드라인형', card: styles.clayCraft, font: styles.fontLeagueSpartan },
  { name: 'Space Mono', tone: '실험적 모노형', card: styles.graphiteSignal, font: styles.fontSpaceMono },
  { name: 'IBM Plex Mono', tone: '신뢰도 높은 데이터형', card: styles.tealWave, font: styles.fontIbmPlexMono },
  { name: 'Bodoni Moda', tone: '대비 강한 럭셔리형', card: styles.indigoOrbit, font: styles.fontBodoniModa },
  { name: 'Yeseva One', tone: '장식적인 시그니처형', card: styles.whiteEssential, font: styles.fontYeseva },
] as const;

export const metadata = {
  title: 'JOOBI 확정 락업 폰트 30안',
  robots: { index: false, follow: false },
};

function JoobiLockup({ font }: { font: string }) {
  return (
    <div className={styles.brandStage}>
      <Image className={styles.icon} src="/icon-192.png" alt="" width={46} height={46} />
      <div className={styles.lockup} aria-label="JOO BI, 나만의 주식 비서">
        <span className={`${styles.word} ${styles.joo} ${font}`}>JOO</span>
        <span className={`${styles.word} ${styles.bi} ${font}`}>BI</span>
        <span className={`${styles.meaning} ${styles.mine}`}>나만의</span>
        <span className={`${styles.meaning} ${styles.stock}`}>주식</span>
        <span className={`${styles.meaning} ${styles.secretary}`}>비서</span>
      </div>
    </div>
  );
}

export default function LockupThirtyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>JOOBI LOCKUP SYSTEM</p>
            <h1>확정 락업 폰트 30안</h1>
          </div>
          <p>글자 크기와 위치 알고리즘은 고정하고, 영문 워드마크 폰트를 30종으로 다르게 설계했습니다.</p>
        </header>

        <div className={styles.grid}>
          {concepts.map((concept, index) => (
            <article className={`${styles.card} ${concept.card}`} key={concept.name}>
              <div className={styles.cardHeader}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{concept.name}</strong>
                <small>{concept.tone}</small>
              </div>
              <JoobiLockup font={concept.font} />
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
