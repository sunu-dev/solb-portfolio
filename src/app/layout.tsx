import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL('https://solb-portfolio.vercel.app'),
  title: '주비 — 내 주식 쉽게 읽어주는 AI 비서',
  description: '내 주식 포트폴리오를 한 줄로 요약. AI 촉(관찰 후보)·멘토 6명 분석·증권사 통합 평단가. 베타 무료.',
  openGraph: {
    title: '주비 — 내 주식 쉽게 읽어주는 AI 비서',
    description: '내 주식 포트폴리오를 한 줄로 요약. AI 촉·멘토 6명·증권사 통합. 베타 무료.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '주비',
  },
  twitter: {
    card: 'summary_large_image',
    title: '주비 — 내 주식 쉽게 읽어주는 AI 비서',
    description: '내 주식 포트폴리오를 한 줄로 요약. AI 촉·멘토 6명·증권사 통합. 베타 무료.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={cn("h-full antialiased", "font-sans", geist.variable)} style={{ colorScheme: 'light' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#0E7C7B" />
        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="주비" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="min-h-full bg-[#F2F4F6]">
        {children}
        <Analytics />
        <SpeedInsights />
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="afterInteractive"
        />
        {/* PWA Service Worker 등록 */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(err) {
                console.warn('SW registration failed:', err);
              });
            });
          }
        `}</Script>
      </body>
    </html>
  );
}
