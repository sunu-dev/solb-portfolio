import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Geist } from "next/font/google";
import localFont from 'next/font/local';
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const joobiWordmark = localFont({
  src: '../../public/fonts/brand/joobi-single-day-regular.ttf',
  weight: '400',
  variable: '--font-wordmark',
  display: 'swap',
  fallback: ['Pretendard', 'sans-serif'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://solb-portfolio.vercel.app'),
  title: '주비 — 오늘 내 주식을 챙기는 개인 주식비서',
  description: '내 자산과 종목 변화, 시장 흐름, 알림을 한곳에서 정리하고 기록까지 안전하게 관리하는 개인 주식비서.',
  openGraph: {
    title: '주비 — 오늘 내 주식을 챙기는 개인 주식비서',
    description: '내 자산과 종목 변화, 시장 흐름, 챙길 일을 한곳에서 확인해요.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '주비',
  },
  twitter: {
    card: 'summary_large_image',
    title: '주비 — 오늘 내 주식을 챙기는 개인 주식비서',
    description: '내 자산과 종목 변화, 시장 흐름, 챙길 일을 한곳에서 확인해요.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={cn("h-full antialiased", "font-sans", geist.variable, joobiWordmark.variable)} style={{ colorScheme: 'light' }}>
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
        {process.env.NODE_ENV === 'production' ? (
          <Script id="sw-register" strategy="afterInteractive">{`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function(err) {
                  console.warn('SW registration failed:', err);
                });
              });
            }
          `}</Script>
        ) : (
          <Script id="sw-dev-cleanup" strategy="beforeInteractive">{`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                return Promise.all(registrations.map(function(registration) { return registration.unregister(); }));
              }).then(function() {
                if ('caches' in window) {
                  return caches.keys().then(function(keys) {
                    return Promise.all(keys.map(function(key) { return caches.delete(key); }));
                  });
                }
              }).catch(function() {});
            }
          `}</Script>
        )}
      </body>
    </html>
  );
}
