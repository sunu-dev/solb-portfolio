import { ImageResponse } from 'next/og';

// 9인 패널 BLOCKER #5 — OG 이미지 동적 생성
// 카톡·X·Slack 공유 시 회색 박스 대신 브랜드 카드 노출
// (그로스 패널: K-factor 무료 채널의 핵심)

export const runtime = 'edge';
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
          background: 'linear-gradient(135deg, #0E7C7B 0%, #0A6362 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
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
          JOOBI
        </div>
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            marginBottom: 28,
          }}
        >
          주비
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
          판단은 내가 하고,
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
          오늘의 변화와 챙길 일은 주비가 정리해요
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
          <span>내 자산</span>
          <span>오늘의 변화</span>
          <span>내 종목 소식</span>
          <span>안전한 기록</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
