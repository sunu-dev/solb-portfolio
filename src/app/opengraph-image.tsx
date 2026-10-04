import { ImageResponse } from 'next/og';

// 9인 패널 BLOCKER #5 — OG 이미지 동적 생성
// 카톡·X·Slack 공유 시 회색 박스 대신 브랜드 카드 노출
// (그로스 패널: K-factor 무료 채널의 핵심)

export const runtime = 'nodejs';
export const alt = '주비 — 오늘 내 주식을 챙기는 개인 주식비서';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#F8F9FA',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#191F28',
          fontFamily: 'sans-serif',
          padding: 60,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            opacity: 0.85,
            letterSpacing: '0.18em',
            marginBottom: 32,
          }}
        >
          JOOBI · 내 주식 비서
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 110,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            marginBottom: 28,
          }}
        >
          <svg width="105" height="105" viewBox="0 0 40 40" fill="none" style={{ marginRight: 24 }}><path d="M7 31 L15 20 L22 24 L33 10" stroke="#F04452" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="33" cy="10" r="3.2" fill="#F04452" /></svg>주비
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.4,
            opacity: 0.95,
            marginBottom: 16,
          }}
        >
          시장의 변화부터 내 주식까지,
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.4,
            opacity: 0.95,
          }}
        >
          이해하는 투자의 시작
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            display: 'flex',
            gap: 32,
            fontSize: 18,
            opacity: 0.75,
          }}
        >
          <span>내 종목 변화</span>
          <span>시장 소식과 연결</span>
          <span>쉬운 용어 설명</span>
          <span>다음에 확인할 일정</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
