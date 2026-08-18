import Image from 'next/image';
import styles from './brand-preview.module.css';

const concepts = [
  {
    label: 'Product system',
    reference: 'Linear 계열',
    display: 'JOOBI',
    font: styles.fontInstrument,
    card: styles.cardSystem,
    mark: styles.markSystem,
    note: '정밀하고 빠른 투자 기록 도구',
    accentDot: false,
  },
  {
    label: 'Soft intelligence',
    reference: 'Raycast 계열',
    display: 'joobi',
    font: styles.fontManrope,
    card: styles.cardSoft,
    mark: styles.markSoft,
    note: '매일 부담 없이 여는 개인 주식비서',
    accentDot: false,
  },
  {
    label: 'Editorial finance',
    reference: 'Stripe 계열',
    display: 'Joobi',
    font: styles.fontFraunces,
    card: styles.cardEditorial,
    mark: styles.markEditorial,
    note: '숫자 너머의 투자 기록을 읽는 서비스',
    accentDot: false,
  },
  {
    label: 'Bold utility',
    reference: 'Ramp 계열',
    display: 'JOOBI',
    font: styles.fontArchivo,
    card: styles.cardUtility,
    mark: styles.markUtility,
    note: '흩어진 투자 기록을 한곳에',
    accentDot: false,
  },
  {
    label: 'Global consumer',
    reference: 'Revolut 계열',
    display: 'joobi',
    font: styles.fontSora,
    card: styles.cardGlobal,
    mark: styles.markGlobal,
    note: '내 투자를 가장 쉽게 이해하는 방법',
    accentDot: false,
  },
  {
    label: 'Creative tech',
    reference: 'Framer 계열',
    display: 'JOO·BI',
    font: styles.fontSpace,
    card: styles.cardCreative,
    mark: styles.markCreative,
    note: '기록하고, 비교하고, 더 선명하게',
    accentDot: true,
  },
  {
    label: 'Neo craft',
    reference: '신규 제안',
    display: 'JOOBI',
    font: styles.fontBricolage,
    card: styles.cardNeo,
    mark: styles.markNeo,
    note: '정돈됐지만 예상 밖의 디테일',
    accentDot: false,
  },
  {
    label: 'Art poster',
    reference: '신규 제안',
    display: 'JOO\nBI',
    font: styles.fontSyne,
    card: styles.cardPoster,
    mark: styles.markPoster,
    note: '포스터처럼 기억되는 주비',
    accentDot: false,
  },
  {
    label: 'Future wide',
    reference: '신규 제안',
    display: 'JOOBI',
    font: styles.fontUnbounded,
    card: styles.cardFuture,
    mark: styles.markFuture,
    note: '새로운 금융 인터페이스의 인상',
    accentDot: false,
  },
  {
    label: 'Friendly modern',
    reference: '신규 제안',
    display: 'joobi',
    font: styles.fontUrbanist,
    card: styles.cardFriendly,
    mark: styles.markFriendly,
    note: '가볍게 시작하는 투자 기록',
    accentDot: false,
  },
  {
    label: 'Premium serif',
    reference: '신규 제안',
    display: 'Joobi',
    font: styles.fontDmSerif,
    card: styles.cardPremium,
    mark: styles.markPremium,
    note: '차분하고 성숙한 금융 브랜드',
    accentDot: false,
  },
  {
    label: 'Quiet luxury',
    reference: '신규 제안',
    display: 'joobi',
    font: styles.fontCormorant,
    card: styles.cardFashion,
    mark: styles.markFashion,
    note: '섬세하고 여백이 많은 인상',
    accentDot: false,
  },
  {
    label: 'Retro future',
    reference: '신규 제안',
    display: 'JOOBI',
    font: styles.fontRighteous,
    card: styles.cardRetro,
    mark: styles.markRetro,
    note: '복고를 현대적으로 다시 조립',
    accentDot: false,
  },
  {
    label: 'Calm clarity',
    reference: '신규 제안',
    display: 'JOOBI',
    font: styles.fontLexend,
    card: styles.cardCalm,
    mark: styles.markCalm,
    note: '읽기 쉽고 편안한 장기 사용형',
    accentDot: false,
    semanticSplit: true,
  },
  {
    label: 'Market terminal',
    reference: '신규 제안',
    display: '$JOOBI_01',
    font: styles.fontChakra,
    card: styles.cardTerminal,
    mark: styles.markTerminal,
    note: '시장 데이터와 연결된 도구형',
    accentDot: false,
  },
  {
    label: 'Classic finance',
    reference: '신규 제안',
    display: 'Joobi',
    font: styles.fontPlayfair,
    card: styles.cardClassic,
    mark: styles.markClassic,
    note: '전통 금융의 신뢰를 가볍게',
    accentDot: false,
  },
  {
    label: 'App first',
    reference: '신규 제안',
    display: 'joobi',
    font: styles.fontOutfit,
    card: styles.cardApp,
    mark: styles.markApp,
    note: '앱 아이콘과 잘 붙는 소비자형',
    accentDot: false,
  },
  {
    label: 'Alt geometry',
    reference: '신규 제안',
    display: 'JOO BI',
    font: styles.fontMontserratAlt,
    card: styles.cardAlt,
    mark: styles.markAlt,
    note: '두 음절을 공간으로 분리한 구조',
    accentDot: false,
  },
  {
    label: 'Condensed signal',
    reference: '신규 제안',
    display: 'JOOBI',
    font: styles.fontBebas,
    card: styles.cardCondensed,
    mark: styles.markCondensed,
    note: '작은 헤더에서도 강하게 보이는 형',
    accentDot: false,
  },
  {
    label: 'Stencil identity',
    reference: '신규 제안',
    display: 'JOOBI',
    font: styles.fontBlackOps,
    card: styles.cardStencil,
    mark: styles.markStencil,
    note: '고유하지만 호불호가 선명한 형',
    accentDot: false,
  },
  {
    label: 'Precision canvas', reference: 'Cursor 참고', display: 'JOOBI', font: styles.fontInstrument,
    card: styles.cardCursor, mark: styles.markCursor, note: '작업 도구처럼 정확하고 절제된 인상', accentDot: false,
  },
  {
    label: 'Answer engine', reference: 'Perplexity 참고', display: 'joobi', font: styles.fontManrope,
    card: styles.cardPerplexity, mark: styles.markPerplexity, note: '질문에서 답으로 바로 이어지는 구조', accentDot: false,
  },
  {
    label: 'Research minimal', reference: 'OpenAI 참고', display: 'JOOBI', font: styles.fontSora,
    card: styles.cardOpenAi, mark: styles.markOpenAi, note: '여백과 타이포만으로 만든 연구소형', accentDot: false,
  },
  {
    label: 'Warm intelligence', reference: 'Anthropic 참고', display: 'Joobi', font: styles.fontFraunces,
    card: styles.cardAnthropic, mark: styles.markAnthropic, note: '지적이지만 차갑지 않은 AI 비서', accentDot: false,
  },
  {
    label: 'Paper utility', reference: 'Notion 참고', display: 'JOOBI', font: styles.fontArchivo,
    card: styles.cardNotion, mark: styles.markNotion, note: '메모장처럼 익숙한 투자 작업 공간', accentDot: false,
  },
  {
    label: 'Modular color', reference: 'Figma 참고', display: 'JOO\nBI', font: styles.fontSyne,
    card: styles.cardFigma, mark: styles.markFigma, note: '색과 모듈로 기억되는 창작 도구형', accentDot: false,
  },
  {
    label: 'Creator gradient', reference: 'Canva 참고', display: 'joobi', font: styles.fontUrbanist,
    card: styles.cardCanva, mark: styles.markCanva, note: '쉽고 밝은 대중형 크리에이터 감성', accentDot: false,
  },
  {
    label: 'Crypto clarity', reference: 'Coinbase 참고', display: 'JOOBI', font: styles.fontOutfit,
    card: styles.cardCoinbase, mark: styles.markCoinbase, note: '금융의 복잡함을 단순하게 정리', accentDot: false,
  },
  {
    label: 'Electric market', reference: 'Robinhood 참고', display: 'joobi', font: styles.fontLexend,
    card: styles.cardRobinhood, mark: styles.markRobinhood, note: '젊고 빠른 시장 참여자의 에너지', accentDot: false,
  },
  {
    label: 'Bold green', reference: 'Wise 참고', display: 'JOOBI', font: styles.fontArchivo,
    card: styles.cardWise, mark: styles.markWise, note: '한눈에 읽히는 대담한 금융 서비스', accentDot: false,
  },
  {
    label: 'Coral bank', reference: 'Monzo 참고', display: 'joobi', font: styles.fontBricolage,
    card: styles.cardMonzo, mark: styles.markMonzo, note: '친근한 색과 각진 구조의 대비', accentDot: false,
  },
  {
    label: 'Editorial bank', reference: 'Mercury 참고', display: 'Joobi', font: styles.fontPlayfair,
    card: styles.cardMercury, mark: styles.markMercury, note: '잡지처럼 차분한 프리미엄 금융', accentDot: false,
  },
  {
    label: 'Enterprise velocity', reference: 'Brex 참고', display: 'JOOBI', font: styles.fontSora,
    card: styles.cardBrex, mark: styles.markBrex, note: '성장과 속도를 강조한 기업형', accentDot: false,
  },
  {
    label: 'Fintech pattern', reference: 'Plaid 참고', display: 'JOO/BI', font: styles.fontSpace,
    card: styles.cardPlaid, mark: styles.markPlaid, note: '데이터 연결을 패턴으로 표현한 구조', accentDot: false,
  },
  {
    label: 'Speed luxe', reference: 'Superhuman 참고', display: 'Joobi', font: styles.fontDmSerif,
    card: styles.cardSuperhuman, mark: styles.markSuperhuman, note: '빠른 제품에 고급스러운 결을 더한 형', accentDot: false,
  },
  {
    label: 'Product focus', reference: 'Apple 참고', display: 'JOOBI', font: styles.fontInstrument,
    card: styles.cardApple, mark: styles.markApple, note: '제품과 이름만 남긴 극단적 미니멀', accentDot: false,
  },
  {
    label: 'Audio pulse', reference: 'Spotify 참고', display: 'joobi', font: styles.fontArchivo,
    card: styles.cardSpotify, mark: styles.markSpotify, note: '매일 다시 찾게 만드는 리듬과 활력', accentDot: false,
  },
  {
    label: 'Community playful', reference: 'Discord 참고', display: 'JOOBI', font: styles.fontRighteous,
    card: styles.cardDiscord, mark: styles.markDiscord, note: '캐릭터가 강한 커뮤니티 친화형', accentDot: false,
  },
  {
    label: 'Color blocks', reference: 'Slack 참고', display: 'JOOBI', font: styles.fontManrope,
    card: styles.cardSlack, mark: styles.markSlack, note: '여러 정보가 모여도 명료한 협업형', accentDot: false,
  },
  {
    label: 'Athletic motion', reference: 'Nike 참고', display: 'JOOBI', font: styles.fontUnbounded,
    card: styles.cardNike, mark: styles.markNike, note: '앞으로 치고 나가는 강한 운동감', accentDot: false,
  },
  {
    label: 'Apothecary editorial', reference: 'Aesop 참고', display: 'Joobi', font: styles.fontCormorant,
    card: styles.cardAesop, mark: styles.markAesop, note: '절제된 문장과 재료감이 있는 브랜드', accentDot: false,
  },
  {
    label: 'Dot matrix', reference: 'Nothing 참고', display: 'JOOBI', font: styles.fontChakra,
    card: styles.cardNothing, mark: styles.markNothing, note: '투명한 기술과 도트 그래픽의 결합', accentDot: false,
  },
  {
    label: 'Industrial label', reference: 'Teenage Engineering 참고', display: 'joobi_01', font: styles.fontChakra,
    card: styles.cardTeenage, mark: styles.markTeenage, note: '작은 기기에 각인된 산업용 레이블', accentDot: false,
  },
  {
    label: 'Scandinavian signal', reference: 'Polestar 참고', display: 'JOOBI', font: styles.fontMontserratAlt,
    card: styles.cardPolestar, mark: styles.markPolestar, note: '날카롭고 조용한 북유럽 제품형', accentDot: false,
  },
  {
    label: 'Commerce pop', reference: 'Shopify 참고', display: 'joobi', font: styles.fontBricolage,
    card: styles.cardShopify, mark: styles.markShopify, note: '사업을 시작하게 만드는 낙관적 인상', accentDot: false,
  },
  {
    label: 'Web creator', reference: 'Webflow 참고', display: 'JOOBI', font: styles.fontSyne,
    card: styles.cardWebflow, mark: styles.markWebflow, note: '인터넷 제품다운 디지털 조형', accentDot: false,
  },
  {
    label: 'Human rounded', reference: 'Airbnb 참고', display: 'joobi', font: styles.fontUrbanist,
    card: styles.cardAirbnb, mark: styles.markAirbnb, note: '사람 중심의 부드럽고 열린 인상', accentDot: false,
  },
  {
    label: 'Voice waveform', reference: 'ElevenLabs 참고', display: 'JOOBI', font: styles.fontSpace,
    card: styles.cardElevenLabs, mark: styles.markElevenLabs, note: '대화형 비서의 목소리를 시각화', accentDot: false,
  },
  {
    label: 'Dream gradient', reference: 'Luma 참고', display: 'Joobi', font: styles.fontDmSerif,
    card: styles.cardLuma, mark: styles.markLuma, note: '미래적이면서 감성적인 생성형 AI', accentDot: false,
  },
  {
    label: 'Chromatic browser', reference: 'Arc 참고', display: 'joobi', font: styles.fontOutfit,
    card: styles.cardArc, mark: styles.markArc, note: '개인화와 색을 전면에 둔 소비자형', accentDot: false,
  },
  {
    label: 'Position map', reference: '14번 위치 실험', display: 'JOO BI', font: styles.fontLexend,
    card: styles.cardPositionMap, mark: styles.positionMap, note: '손그림의 단어별 대응 관계를 그대로 정돈', accentDot: false, placement: true,
  },
  {
    label: 'Split horizon', reference: '14번 위치 실험', display: 'JOO BI', font: styles.fontLexend,
    card: styles.cardSplitHorizon, mark: styles.splitHorizon, note: '두 이름을 양끝에 두고 설명을 한 줄로 연결', accentDot: false, placement: true,
  },
  {
    label: 'Vertical index', reference: '14번 위치 실험', display: 'JOO BI', font: styles.fontLexend,
    card: styles.cardVerticalIndex, mark: styles.verticalIndex, note: 'JOO와 BI를 세로 정보 체계처럼 구분', accentDot: false, placement: true,
  },
  {
    label: 'Editorial scale', reference: '14번 위치 실험', display: 'JOO BI', font: styles.fontLexend,
    card: styles.cardEditorialScale, mark: styles.editorialScale, note: 'JOO를 주인공으로, BI를 서명처럼 배치', accentDot: false, placement: true,
  },
  {
    label: 'Linked meaning', reference: '14번 위치 실험', display: 'JOO BI', font: styles.fontLexend,
    card: styles.cardLinkedMeaning, mark: styles.linkedMeaning, note: '주식과 비서의 의미를 선으로 이어 만든 락업', accentDot: false, placement: true,
  },
] as const;

export const metadata = {
  title: 'JOOBI 영문 워드마크 방향 비교',
  robots: { index: false, follow: false },
};

export default function BrandPreviewPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>JOOBI BRAND DIRECTION</p>
            <h1 className={styles.title}>영문 워드마크 55가지 방향</h1>
          </div>
          <p className={styles.description}>
            기존 50안에 14번을 기준으로 만든 JOO·BI 위치 실험 5안을 더했어요. 번호로 고르거나 서로 섞어도 좋아요.
          </p>
        </header>

        <div className={styles.grid}>
          {concepts.map((concept, index) => (
            <section className={`${styles.card} ${concept.card}`} key={concept.label}>
              <div className={styles.cardHeader}>
                <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.label}>{concept.label}</span>
                <span className={styles.reference}>{concept.reference}</span>
              </div>

              {'semanticSplit' in concept ? (
                <div className={styles.brandStage}>
                  <Image className={styles.icon} src="/icon-192.png" alt="" width={46} height={46} />
                  <div className={styles.calmSemanticLockup} aria-label="JOO BI, 나만의 주식 비서">
                    <span className={`${styles.calmSemanticWord} ${styles.calmSemanticJoo} ${concept.font} ${concept.mark}`}>JOO</span>
                    <span className={`${styles.calmSemanticWord} ${styles.calmSemanticBi} ${concept.font} ${concept.mark}`}>BI</span>
                    <span className={`${styles.calmSemanticMeaning} ${styles.calmSemanticMine}`}>나만의</span>
                    <span className={`${styles.calmSemanticMeaning} ${styles.calmSemanticStock}`}>주식</span>
                    <span className={`${styles.calmSemanticMeaning} ${styles.calmSemanticSecretary}`}>비서</span>
                  </div>
                </div>
              ) : 'placement' in concept ? (
                <div className={`${styles.placementStage} ${concept.mark}`}>
                  <span className={`${styles.placementJoo} ${concept.font}`}>JOO</span>
                  <span className={`${styles.placementBi} ${concept.font}`}>BI</span>
                  <div className={styles.placementTagline} aria-label="나만의 주식 비서">
                    <span className={styles.placementMine}>나만의</span>
                    <span className={styles.placementStock}>주식</span>
                    <span className={styles.placementSecretary}>비서</span>
                  </div>
                </div>
              ) : (
                <div className={styles.brandStage}>
                  <Image className={styles.icon} src="/icon-192.png" alt="" width={46} height={46} />
                  <div className={styles.lockup}>
                    <div className={`${styles.wordmark} ${concept.font} ${concept.mark}`}>
                      {concept.accentDot ? (
                        <>JOO<span className={styles.accentDot}>·</span>BI</>
                      ) : concept.display}
                    </div>
                    <div className={styles.tagline}>나만의 주식비서</div>
                  </div>
                </div>
              )}

              <p className={styles.note}>{concept.note}</p>
            </section>
          ))}
        </div>

        <p className={styles.footerNote}>현재 로고 아이콘은 그대로 두고 워드마크와 브랜드 태도만 비교한 화면이에요.</p>
      </div>
    </main>
  );
}
