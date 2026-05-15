import { ImageResponse } from 'next/og';

// 9인 패널 BLOCKER #5 — OG 이미지 동적 생성
// 카톡·X·Slack 공유 시 회색 박스 대신 브랜드 카드 노출
// (그로스 패널: K-factor 무료 채널의 핵심)

export const runtime = 'edge';
export const alt = '주비 — 내 주식 쉽게 읽어주는 AI 비서';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #3182F6 0%, #1B64DA 100%)',
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
          JUBI
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
          내 주식, 쉽게 읽어주는
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
          AI 주식 비서
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
          <span>📊 시세</span>
          <span>🎯 AI 촉</span>
          <span>🧑‍🏫 멘토 6명</span>
          <span>🏦 증권사 통합</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
