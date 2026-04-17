import Link from 'next/link';

export const metadata = {
  title: '주비 — 폭풍우에도 흔들리지 않는 내 주식 비서',
  description: '내 주식을 쉽게 읽어주는 AI 투자 정보 비서. 6가지 관점의 종목 분석, 실시간 시세, 스마트 알림.',
};

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #FFFFFF)',
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
          주비
        </div>

        {/* Main headline */}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: 'var(--text-primary, #191F28)',
            lineHeight: 1.35,
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          폭풍우에도 흔들리지 않는
          <br />
          내 주식 비서
        </h1>

        <p
          style={{
            fontSize: 16,
            color: '#8B95A1',
            lineHeight: 1.6,
            marginBottom: 48,
          }}
        >
          차트 몰라도 괜찮아요. 주비가 읽어드릴게요.
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
            { label: '시세', text: '실시간 가격 + 원화 환산' },
            { label: 'AI', text: 'AI가 차트를 한국어로 읽어줘요' },
            { label: '알림', text: '손절/목표 자동 알림' },
            { label: '로그인', text: 'Google/카카오 로그인' },
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
              <span style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#F0F4FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#3182F6',
              }}>{item.label.slice(0, 2)}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
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
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 32px',
              background: 'transparent',
              color: '#8B95A1',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 12,
              textDecoration: 'none',
              border: '1px solid #E5E8EB',
              transition: 'all 0.2s ease',
            }}
          >
            가입 없이 둘러보기 →
          </Link>
        </div>

        {/* Social proof */}
        <p
          style={{
            marginTop: 32,
            fontSize: 13,
            color: '#B0B8C1',
            lineHeight: 1.7,
          }}
        >
          삼성전자, NVDA, AAPL 등 인기 종목을 바로 추가해보세요
        </p>
      </div>
    </div>
  );
}
