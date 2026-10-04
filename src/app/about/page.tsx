import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Layers3 } from 'lucide-react';
import JoobiLockup from '@/components/brand/JoobiLockup';
import styles from './page.module.css';

const title = '주비 소개 — 내 주식을 이해하는 개인 주식비서';
const description = '내 종목의 변화, 주요 경제 발표, 어려운 투자 용어까지. 주식이 처음이어도 시장과 내 투자를 차근차근 이해하도록 주비가 함께해요.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://joobi.kr/about' },
  openGraph: {
    title,
    description,
    url: 'https://joobi.kr/about',
    type: 'website',
    locale: 'ko_KR',
    siteName: '주비',
    images: [{ url: 'https://joobi.kr/opengraph-image', width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['https://joobi.kr/opengraph-image'],
  },
};

const questions = [
  {
    question: '주식을 처음 시작했는데 쓸 수 있나요?',
    answer: '네. 종목 코드나 경제 용어를 미리 알 필요 없어요. 회사 이름으로 종목을 찾고, 낯선 발표는 용어의 뜻부터 차근차근 읽을 수 있어요. 먼저 샘플 화면으로 둘러봐도 좋아요.',
  },
  {
    question: '증권사 계좌를 연결해야 하나요?',
    answer: '계좌를 연결하지 않아도 돼요. 보유·관심 종목을 직접 등록해 확인하는 방식이에요. 주식을 사고파는 거래는 이용 중인 증권사에서 진행해요.',
  },
  {
    question: '모든 뉴스가 내 종목에 미치는 영향을 분석하나요?',
    answer: '현재는 주요 경제 발표의 의미와 영향이 전달되는 과정, 금리·물가·환율·실적의 배경 설명을 제공해요. 등록한 종목과 함께 살펴볼 수 있지만, 모든 뉴스의 원인이나 특정 종목의 수혜·피해를 자동으로 판정하지는 않아요.',
  },
  {
    question: '지금 가입할 수 있나요?',
    answer: '현재 소수 인원으로 무료 베타를 운영하고 있어요. 가입에는 초대 코드가 필요해요. 코드를 받기 전에도 주비 리포트와 샘플 화면을 둘러볼 수 있어요.',
  },
];

function PreviewLabel() {
  return <span className={styles.previewLabel}>설명용 예시</span>;
}

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <a href="#about-main" className={styles.skipLink}>본문으로 바로가기</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="주비 홈">
            <JoobiLockup variant="header" />
          </Link>
          <nav aria-label="서비스 소개" className={styles.headerNav}>
            <a href="#experience" className={styles.navLink}>주비가 하는 일</a>
            <a href="#getting-started" className={styles.navLink}>이용 안내</a>
            <Link href="/?view=insights" className={styles.headerAction}>주비 열기 <ArrowRight size={16} aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main id="about-main">
        <section className={`${styles.container} ${styles.hero}`} aria-labelledby="about-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.brandDot} aria-hidden="true" /> 개인 주식비서, 주비</p>
            <h1 id="about-title" className={styles.title}>
              <span>내 주식이 궁금할 때,</span>
              <span>주비에게.</span>
            </h1>
            <p className={styles.heroDescription}>가격은 알겠는데, 무슨 뜻인지 모르겠다면.<br className={styles.desktopBreak} /> 내 종목의 변화와 시장 소식을 함께 살펴보고,<br className={styles.desktopBreak} /> 이해하는 데 필요한 설명을 만나보세요.</p>
            <div className={styles.actions}>
              <Link href="/?view=insights" className={styles.primary}>주비 리포트 보기 <ArrowRight size={19} aria-hidden="true" /></Link>
              <Link href="/" className={styles.secondary}>샘플로 둘러보기</Link>
            </div>
            <p className={styles.actionNote}>로그인 전에 둘러볼 수 있어요.</p>
          </div>

          <figure className={styles.heroVisual} aria-label="용어의 뜻에서 기업에 전해지는 영향까지 살펴보는 주비 리포트 예시">
            <div className={styles.reportPreview}>
              <div className={styles.previewHeader}>
                <span className={styles.previewBrand}><BookOpen size={18} aria-hidden="true" /> 주비 리포트</span>
                <PreviewLabel />
              </div>
              <p className={styles.reportKicker}>오늘 궁금한 이야기</p>
              <h2 className={styles.reportTitle}>금리 소식이<br />내 주식과 무슨 상관일까요?</h2>
              <p className={styles.reportIntro}>금리는 돈을 빌리는 비용이에요.<br />기업이 부담하는 이자에도 영향을 줘요.</p>
              <div className={styles.connectionPreview}>
                <div><span className={styles.connectionNumber}>01</span><span>금리가 달라지면</span></div>
                <ArrowDown className={styles.connectionArrow} size={16} aria-hidden="true" />
                <div><span className={styles.connectionNumber}>02</span><span>기업의 이자 부담과 투자 계획에 영향</span></div>
                <ArrowDown className={styles.connectionArrow} size={16} aria-hidden="true" />
                <div className={styles.connectionLast}><span className={styles.connectionNumber}>03</span><span>앞으로 벌어들일 이익의 기대도 변화</span></div>
              </div>
              <div className={styles.conditionNote}><span>함께 볼 점</span><p>기업의 빚 규모와 시장의 예상에 따라 영향은 달라져요.</p></div>
            </div>
            <figcaption>서비스의 설명 방식을 보여주는 예시예요.</figcaption>
          </figure>
        </section>

        <section id="experience" className={styles.experience} aria-labelledby="experience-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>이해가 쌓이는 투자</p>
              <h2 id="experience-title">무슨 뜻인지부터,<br />내 투자에서 볼 것까지.</h2>
              <p>궁금한 순간에 필요한 만큼.<br />어려운 이야기의 앞뒤를 연결해드려요.</p>
            </div>

            <div className={styles.valueGrid}>
              <article className={styles.valueItem}>
                <span className={styles.valueNumber}>01</span>
                <h3>말뜻부터 쉽게</h3>
                <p>물가, 금리, 주당순이익.<br />약어 속에 숨은 뜻을 익숙한 말로 풀어요.</p>
              </article>
              <article className={styles.valueItem}>
                <span className={styles.valueNumber}>02</span>
                <h3>영향은 차근차근</h3>
                <p>시장 변화가 기업의 매출과 비용에<br className={styles.desktopBreak} /> 전해지는 과정을 함께 살펴봐요.</p>
              </article>
              <article className={styles.valueItem}>
                <span className={styles.valueNumber}>03</span>
                <h3>다음에 볼 것까지</h3>
                <p>기업마다 달라질 조건을 짚고,<br className={styles.desktopBreak} /> 관련 발표와 확인할 내용을 이어서 봐요.</p>
              </article>
            </div>
            <Link href="/?view=insights&guide=rates" className={styles.textLink}>금리 해설 직접 읽어보기 <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </section>

        <section className={`${styles.container} ${styles.featureSection}`} aria-labelledby="portfolio-title">
          <div className={styles.featureCopy}>
            <p className={styles.featureLabel}><Layers3 size={19} aria-hidden="true" /> 내 주식</p>
            <h2 id="portfolio-title">흩어진 내 종목을<br />한곳에서.</h2>
            <p>보유한 주식과 관심 있는 회사를 모아보세요. 시세와 손익, 관련 뉴스를 오가며 지금 내 투자에 어떤 변화가 있는지 살펴볼 수 있어요.</p>
            <ul className={styles.featureList}>
              <li><Check size={18} aria-hidden="true" /> 한국·미국 종목을 회사 이름으로 검색</li>
              <li><Check size={18} aria-hidden="true" /> 보유·관심 종목과 손익을 한눈에</li>
              <li><Check size={18} aria-hidden="true" /> 관련 뉴스와 종목 상세로 자연스럽게</li>
            </ul>
            <Link href="/" className={styles.textLink}>내 주식 화면 둘러보기 <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <figure className={styles.portfolioVisual}>
            <div className={styles.portfolioPreview}>
              <div className={styles.previewHeader}><strong>내 주식</strong><PreviewLabel /></div>
              <div className={styles.portfolioTabs}><span className={styles.activePreviewTab}>보유 종목</span><span>관심 종목</span></div>
              <div className={styles.stockRow}><span className={styles.companyIcon}>삼</span><div><strong>삼성전자</strong><span>한국 · 원화</span></div><span className={styles.holdingLabel}>보유</span></div>
              <div className={styles.stockRow}><span className={styles.companyIcon}>애</span><div><strong>애플</strong><span>미국 · 달러</span></div><span className={styles.holdingLabel}>보유</span></div>
              <div className={styles.stockRow}><span className={styles.companyIcon}>엔</span><div><strong>엔비디아</strong><span>미국 · 달러</span></div><span className={styles.holdingLabel}>보유</span></div>
              <div className={styles.portfolioFootnote}><BookOpen size={18} aria-hidden="true" /><p>종목을 살펴보다 궁금해진 용어도<br />하나씩 알아갈 수 있어요.</p></div>
            </div>
            <figcaption>구성을 간추린 예시로, 종목 추천이 아니에요.</figcaption>
          </figure>
        </section>

        <section className={`${styles.container} ${styles.featureSection} ${styles.calendarSection}`} aria-labelledby="calendar-title">
          <div className={styles.featureCopy}>
            <p className={styles.featureLabel}><CalendarDays size={19} aria-hidden="true" /> 경제 일정과 해설</p>
            <h2 id="calendar-title">발표 전에도,<br />발표 후에도.</h2>
            <p>한국 시간으로 주요 일정을 챙기고, 발표가 나오면 확인된 결과와 의미를 함께 읽어요. 숫자만 확인하고 끝나지 않도록 필요한 배경 설명도 이어져요.</p>
            <ul className={styles.featureList}>
              <li><Check size={18} aria-hidden="true" /> 예정된 일정과 발표 결과를 구분</li>
              <li><Check size={18} aria-hidden="true" /> 용어의 뜻과 시장에 전해지는 과정</li>
              <li><Check size={18} aria-hidden="true" /> 출처와 함께 확인하는 배경 설명</li>
            </ul>
            <Link href="/?view=insights" className={styles.textLink}>지금 발표된 소식 보기 <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <figure className={styles.calendarVisual}>
            <div className={styles.calendarPreview}>
              <div className={styles.previewHeader}><strong>경제 일정</strong><PreviewLabel /></div>
              <div className={styles.eventRow}><span className={styles.eventStatus}>발표 전</span><div><h3>무엇을 발표하나요?</h3><p>미국 소비자물가지수</p><span>가계가 사는 상품과 서비스의 가격 변화예요.</span></div></div>
              <div className={styles.eventRow}><span className={styles.eventStatus}>발표 후</span><div><h3>어떻게 달라졌나요?</h3><p>발표 결과와 이전 수치를 함께</p><span>물가의 오름세가 강해졌는지, 약해졌는지 살펴봐요.</span></div></div>
              <div className={styles.eventRow}><span className={styles.eventStatus}>이어서</span><div><h3>무엇을 더 볼까요?</h3><p>금리와 기업의 비용에 미칠 영향</p><span>시장 예상과 기업별 차이도 함께 확인해요.</span></div></div>
            </div>
            <figcaption>실제 발표 결과가 아닌, 이용 흐름을 설명하는 예시예요.</figcaption>
          </figure>
        </section>

        <section id="getting-started" className={styles.startSection} aria-labelledby="start-title">
          <div className={`${styles.container} ${styles.startInner}`}>
            <div className={styles.startCopy}>
              <p className={styles.eyebrow}>천천히, 직접 써보세요</p>
              <h2 id="start-title">첫 시작은<br />궁금한 소식 하나면 돼요.</h2>
              <p>리포트를 읽고, 샘플로 내 주식 화면을 둘러보세요.<br className={styles.desktopBreak} /> 지금은 초대 코드를 받은 분부터 무료 베타에 참여할 수 있어요.</p>
              <div className={styles.actions}>
                <Link href="/?view=insights" className={styles.primary}>주비 리포트 보기 <ArrowRight size={19} aria-hidden="true" /></Link>
                <Link href="/?login=1" className={styles.secondary}>초대 코드로 시작하기</Link>
              </div>
            </div>
            <div className={styles.faq}>
              <h3>시작 전에 궁금한 점</h3>
              {questions.map(({ question, answer }) => (
                <details key={question} className={styles.faqItem}>
                  <summary>{question}<ChevronDown size={19} aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className={`${styles.container} ${styles.footer}`}>
        <div className={styles.footerTop}>
          <div><JoobiLockup variant="header" /><p>내 주식을 이해하는 개인 주식비서</p></div>
          <nav aria-label="서비스 안내" className={styles.footerLinks}>
            <Link href="/help">이용 도움말</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
          </nav>
        </div>
        <p className={styles.footerNote}>주비는 투자 정보를 이해하도록 돕는 서비스예요. 정보의 기준 시점과 출처를 확인하고, 투자 판단은 신중하게 해주세요.</p>
      </footer>
    </div>
  );
}
