import Image from 'next/image';
import Link from 'next/link';
import JoobiLockup from '@/components/brand/JoobiLockup';

export const metadata = {
  title: '주비 — 오늘 내 주식을 챙기는 개인 주식비서',
  description: '내 자산과 종목 변화, 시장 흐름, 알림을 한곳에서 정리하고 기록까지 안전하게 관리하는 개인 주식비서.',
};

const TRUST_POINTS = [
  {
    label: '오늘',
    title: '내 종목부터 한눈에',
    description: '자산·손익과 보유·관심 종목의 변화를 한곳에 모아 보여줘요.',
  },
  {
    label: '설명',
    title: '숫자와 맥락을 함께',
    description: '시장 흐름과 내 종목 소식, 챙길 알림을 연결해 정리해요.',
  },
  {
    label: '안전',
    title: '기록은 확인하고 반영',
    description: '가져온 변경을 먼저 비교하고, 이전 상태에는 복구 지점을 남겨요.',
  },
];

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '34px 20px 64px',
        overflow: 'hidden',
        position: 'relative',
        background: 'radial-gradient(circle at 80% 4%, rgba(14,124,123,0.12), transparent 32%), linear-gradient(180deg, #F8FFFE 0%, #FFFFFF 42%, #F7F9FA 100%)',
        fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', width: 360, height: 360, left: -230, top: 310, borderRadius: '50%', background: 'rgba(14,124,123,0.05)' }} />

      <div style={{ width: '100%', maxWidth: 980, margin: '0 auto', position: 'relative' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image
              src="/icon-192.png"
              alt=""
              width={38}
              height={38}
              priority
              style={{ width: 38, height: 38, borderRadius: 11 }}
            />
            <JoobiLockup variant="header" />
          </div>
          <Link
            href="/?login=1"
            style={{ minHeight: 40, padding: '9px 15px', display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(14,124,123,0.2)', borderRadius: 11, background: 'rgba(255,255,255,0.78)', color: 'var(--brand-primary, #0E7C7B)', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}
          >
            로그인
          </Link>
        </header>

        <section style={{ maxWidth: 760, margin: '78px auto 0', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', border: '1px solid rgba(14,124,123,0.16)', borderRadius: 999, background: 'rgba(255,255,255,0.74)', color: 'var(--brand-primary, #0E7C7B)', fontSize: 11, fontWeight: 800 }}>
            내 주식을 매일 챙기는 개인 주식비서
          </div>
          <h1 style={{ margin: '19px 0 0', color: 'var(--text-primary, #17211F)', fontSize: 'clamp(34px, 7vw, 58px)', lineHeight: 1.18, letterSpacing: '-0.045em', wordBreak: 'keep-all' }}>
            주식은 내가 판단하고,
            <br />
            오늘 챙길 일은 주비가 정리해요
          </h1>
          <p style={{ maxWidth: 590, margin: '21px auto 0', color: 'var(--text-secondary, #59656A)', fontSize: 'clamp(15px, 2.4vw, 18px)', lineHeight: 1.75, wordBreak: 'keep-all' }}>
            내 자산과 종목 변화, 시장 흐름, 알림을 한곳에서 확인해요.
            기록을 가져오거나 되돌릴 때도 안전하게 관리해요.
          </p>

          <div style={{ margin: '31px auto 0', display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/?login=1"
              style={{ minWidth: 190, minHeight: 52, padding: '14px 24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: 'var(--brand-primary, #0E7C7B)', color: '#FFFFFF', boxShadow: '0 12px 28px rgba(14,124,123,0.22)', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}
            >
              내 주식비서 시작
            </Link>
            <Link
              href="/?recordPreview=1"
              style={{ minWidth: 190, minHeight: 52, padding: '13px 22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light, #DDE4E3)', borderRadius: 14, background: 'rgba(255,255,255,0.84)', color: 'var(--text-primary, #273331)', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}
            >
              기록 안전 기능 보기
            </Link>
          </div>
          <p style={{ margin: '12px 0 0', color: 'var(--text-tertiary, #8B95A1)', fontSize: 11, lineHeight: 1.6 }}>
            체험에는 로그인도, 실제 계좌 데이터도 필요하지 않아요.
          </p>
        </section>

        <section
          aria-label="주비의 안전한 기록 가져오기 예시"
          style={{ maxWidth: 680, margin: '58px auto 0', padding: 18, border: '1px solid rgba(14,124,123,0.17)', borderRadius: 24, background: 'rgba(255,255,255,0.88)', boxShadow: '0 24px 70px rgba(24,48,44,0.11)', backdropFilter: 'blur(12px)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: 'var(--text-primary, #17211F)', fontSize: 15, fontWeight: 850 }}>
                가져오기도 주비답게 안전하게
              </div>
              <div style={{ marginTop: 4, color: 'var(--text-tertiary, #7B8785)', fontSize: 11 }}>
                개인 주식비서의 기록 관리 예시
              </div>
            </div>
            <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(52,199,89,0.1)', color: '#237B46', fontSize: 9, fontWeight: 850 }}>
              승인 전
            </span>
          </div>

          <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
            {[
              ['새 항목', '1'],
              ['변경', '1'],
              ['그대로', '1'],
            ].map(([label, count]) => (
              <div key={label} style={{ padding: '11px 6px', borderRadius: 12, background: '#F3F7F6', textAlign: 'center' }}>
                <div style={{ color: '#17211F', fontSize: 17, fontWeight: 850 }}>{count}</div>
                <div style={{ marginTop: 2, color: '#7B8785', fontSize: 10 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 9, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid rgba(14,124,123,0.4)', borderRadius: 13, background: 'rgba(14,124,123,0.055)', textAlign: 'left' }}>
            <span style={{ width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 7, background: 'var(--brand-primary, #0E7C7B)', color: 'white', fontSize: 12, fontWeight: 900 }}>✓</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', color: '#17211F', fontSize: 12 }}>수량이 달라진 기록 1개</strong>
              <span style={{ display: 'block', marginTop: 3, color: '#667270', fontSize: 10 }}>선택한 변경만 반영하고, 이전 상태는 자동 보관해요.</span>
            </span>
          </div>
        </section>

        <section style={{ maxWidth: 860, margin: '38px auto 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          {TRUST_POINTS.map((point) => (
            <article key={point.label} style={{ padding: 18, border: '1px solid #E7ECEB', borderRadius: 18, background: 'rgba(255,255,255,0.72)' }}>
              <div style={{ color: 'var(--brand-primary, #0E7C7B)', fontSize: 10, fontWeight: 900, letterSpacing: '0.08em' }}>
                {point.label}
              </div>
              <h2 style={{ margin: '8px 0 0', color: '#1F2B29', fontSize: 15 }}>
                {point.title}
              </h2>
              <p style={{ margin: '7px 0 0', color: '#6D7876', fontSize: 12, lineHeight: 1.65 }}>
                {point.description}
              </p>
            </article>
          ))}
        </section>

        <section style={{ maxWidth: 760, margin: '42px auto 0', padding: '21px 22px', borderRadius: 18, background: '#172B28', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 850 }}>지금은 개인정보를 지키는 방식을 우선합니다</div>
          <p style={{ margin: '7px 0 0', color: '#C5D3D0', fontSize: 11, lineHeight: 1.75 }}>
            CSV 원본 파일은 서버로 보내지 않고 브라우저에서 먼저 비교해요.
            증권사 화면 사진 가져오기는 개인정보 보호 기준을 충족한 환경에서만 제공합니다.
          </p>
        </section>

        <footer style={{ marginTop: 34, color: '#8B9694', fontSize: 10, lineHeight: 1.7, textAlign: 'center' }}>
          주비는 투자 판단이나 수익을 대신 약속하지 않습니다. 내 종목의 변화·알림·기록을 확인하고 관리하도록 돕습니다.
        </footer>
      </div>
    </main>
  );
}
