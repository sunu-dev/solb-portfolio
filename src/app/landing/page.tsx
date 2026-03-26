import Link from 'next/link';

export const metadata = {
  title: 'SOLB PORTFOLIO - 내 주식, 쉽게 읽어주는 투자 비서',
  description: '주식 초보자를 위한 AI 포트폴리오 대시보드. 실시간 가격, AI 분석, 스마트 알림.',
};

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#3182F6',
            letterSpacing: '0.12em',
            marginBottom: 48,
          }}
        >
          SOLB PORTFOLIO
        </div>

        {/* Main headline */}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: '#191F28',
            lineHeight: 1.35,
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          내 주식, 쉽게 읽어주는
          <br />
          투자 비서
        </h1>

        <p
          style={{
            fontSize: 16,
            color: '#8B95A1',
            lineHeight: 1.6,
            marginBottom: 48,
          }}
        >
          차트 몰라도 괜찮아요. 솔브가 읽어드릴게요.
        </p>

        {/* Feature list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            marginBottom: 48,
            textAlign: 'left',
            maxWidth: 400,
            margin: '0 auto 48px',
          }}
        >
          {[
            { icon: '\u{1F4B0}', text: '실시간 가격 + 원화 환산' },
            { icon: '\u{1F916}', text: 'AI가 차트를 한국어로 읽어줘요' },
            { icon: '\u{1F514}', text: '손절/목표 자동 알림' },
            { icon: '\u{1F511}', text: 'Google/카카오 로그인' },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: 16,
                color: '#333D4B',
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0, width: 32, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* CTA button */}
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '16px 48px',
            background: '#3182F6',
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: 700,
            borderRadius: 14,
            textDecoration: 'none',
            transition: 'background 0.2s ease',
            boxShadow: '0 4px 16px rgba(49, 130, 246, 0.3)',
          }}
        >
          무료로 시작하기
        </Link>

        {/* Tagline */}
        <p
          style={{
            marginTop: 48,
            fontSize: 15,
            color: '#B0B8C1',
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}
        >
          &ldquo;차트 몰라도 괜찮아요.
          <br />
          솔브가 읽어드릴게요.&rdquo;
        </p>
      </div>
    </div>
  );
}
