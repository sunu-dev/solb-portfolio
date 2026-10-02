import Link from 'next/link';
import JoobiLockup from '@/components/brand/JoobiLockup';
import styles from './page.module.css';

export const metadata = {
  title: '주비 — 내 주식과 시장을 챙기는 개인 주식비서',
  description: '보유·관심 종목의 변화와 주요 경제 발표를 한곳에 모았어요. 어려운 용어와 시장에 미치는 영향도 함께 설명해드려요.',
};

const FEATURES = [
  {
    title: '내 종목의 변화',
    description: '보유·관심 종목의 시세와 손익, 관련 뉴스를 모아 확인해요.',
  },
  {
    title: '주요 발표와 결과',
    description: '예정된 경제 일정과 확인된 발표 결과를 구분하고, 시장에서 살펴볼 점을 정리해요.',
  },
  {
    title: '이해를 돕는 설명',
    description: '낯선 용어의 뜻과 금리·환율·기업 실적이 투자에 이어지는 과정을 설명해요.',
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="주비 홈">
          <JoobiLockup variant="header" />
        </Link>
        <Link href="/?login=1" className={styles.login}>로그인</Link>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <p className={styles.eyebrow}>개인 주식비서, 주비</p>
          <h1 id="landing-title" className={`${styles.title} reading-title`}>
            <span className="reading-phrase">내 주식의 변화,</span>{' '}
            <span className="reading-phrase">이유까지 살펴보세요.</span>
          </h1>
          <p className={`${styles.description} reading-copy`}>
            보유·관심 종목의 변화와 주요 경제 발표를 한곳에 모았어요.
            어려운 용어와 시장에 미치는 영향도 함께 풀어드려요.
          </p>
          <div className={styles.actions}>
            <Link href="/?view=insights" className={styles.primary}>
              주비 리포트 보기 <span aria-hidden="true">→</span>
            </Link>
            <Link href="/" className={styles.secondary}>내 주식 보러 가기</Link>
          </div>
        </section>

        <section className={styles.featuresSection} aria-labelledby="features-title">
          <h2 id="features-title" className={`${styles.sectionTitle} reading-title`}>
            내 종목부터 주요 발표까지
          </h2>
          <div className={styles.features}>
            {FEATURES.map(feature => (
              <article key={feature.title} className={styles.feature}>
                <h3 className="reading-title">{feature.title}</h3>
                <p className="reading-copy">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>주비</p>
          <p className="reading-copy">내 주식과 시장을 챙기는 개인 주식비서</p>
        </div>
        <nav aria-label="서비스 정책" className={styles.footerLinks}>
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
        </nav>
      </footer>
    </div>
  );
}
