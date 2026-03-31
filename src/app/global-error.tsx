'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: '#FFFFFF',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛈️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          서비스에 문제가 발생했어요
        </h1>
        <p style={{ fontSize: 14, color: '#8B95A1', marginBottom: 24, textAlign: 'center' }}>
          새로고침하거나 잠시 후 다시 시도해주세요.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            background: '#3182F6',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          새로고침
        </button>
      </body>
    </html>
  );
}
