'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { resolveUsdKrw } from '@/utils/koreanNumber';
import { usePortfolioStore } from '@/store/portfolioStore';
import JoobiLockup from '@/components/brand/JoobiLockup';
import { buildPortfolioShareSummary } from '@/lib/portfolioShare';

const APP_URL = 'https://joobi.kr';
const buttonStyle: CSSProperties = { flex: '1 1 80px', minHeight: 44, padding: '10px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' };
const labelStyle: CSSProperties = { fontSize: 12, color: 'var(--text-body)', lineHeight: 1.6 };
const valueStyle: CSSProperties = { margin: '5px 0 0', fontSize: 19, fontWeight: 700 };

export default function ShareCard() {
  const investingStocks = usePortfolioStore(state => state.stocks.investing);
  const macroData = usePortfolioStore(state => state.macroData);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initKakao = () => {
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (window.Kakao && key && !window.Kakao.isInitialized()) window.Kakao.init(key);
      if (window.Kakao?.isInitialized()) { setKakaoReady(true); return true; }
      return false;
    };
    if (initKakao()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (initKakao() || attempts >= 20) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const summary = buildPortfolioShareSummary(investingStocks, macroData, resolveUsdKrw(macroData));
  const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const shareTitle = summary.isSample ? '주비 샘플 포트폴리오 · 가상 보유 예시' : '주비 포트폴리오';
  const canShare = summary.totalPnlPct !== null;
  const returnText = summary.totalPnlPct === null ? '시세 확인 중' : `${summary.totalPnlPct > 0 ? '+' : ''}${summary.totalPnlPct.toFixed(1)}%`;
  const coverage = summary.missingQuoteCount > 0
    ? `전체 ${summary.holdingCount}종목 중 시세가 확인된 ${summary.quotedHoldingCount}종목 기준`
    : `시세가 확인된 ${summary.quotedHoldingCount}종목 기준`;
  const shareDescription = `${returnText} · 평가이익 종목 ${summary.gainRatio ?? 0}% · ${coverage} · 원화 환산`;
  const shareText = `${shareTitle}\n${dateStr}\n${shareDescription}${summary.isSample ? '\n실제 투자 성과가 아닌 체험용 가상 보유 예시예요.' : ''}`;
  const params = new URLSearchParams({ return: (summary.totalPnlPct ?? 0).toFixed(1), gainRatio: String(summary.gainRatio ?? 0), holdings: String(summary.quotedHoldingCount), sample: summary.isSample ? '1' : '0', partial: summary.missingQuoteCount > 0 ? '1' : '0' });
  const ogImageUrl = `${APP_URL}/api/og?${params.toString()}`;

  if (summary.holdingCount === 0) return null;

  const handleKakaoShare = () => {
    if (!canShare || !window.Kakao?.Share) return;
    setShareError('');
    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: { title: shareTitle, description: shareDescription, imageUrl: ogImageUrl, link: { mobileWebUrl: APP_URL, webUrl: APP_URL } },
        buttons: [{ title: '주비 둘러보기', link: { mobileWebUrl: `${APP_URL}/about`, webUrl: `${APP_URL}/about` } }],
      });
    } catch {
      setShareError('카카오톡 공유를 열지 못했어요. 아래 공유하기를 이용해주세요.');
    }
  };

  const handleGeneralShare = async () => {
    if (!canShare) return;
    setShareError('');
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: APP_URL });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n\n${APP_URL}`);
        setCopied(true);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareError('공유를 열지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  if (!isOpen) {
    return <button onClick={() => setIsOpen(true)} style={{ ...buttonStyle, width: '100%', minHeight: 48, padding: '12px 16px', background: 'var(--pill-active-bg)', color: 'var(--pill-active-fg)', fontSize: 14, marginTop: 8 }}>{summary.isSample ? '샘플 공유 카드 미리보기' : '내 포트폴리오 공유 카드 보기'}</button>;
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '26px 22px', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}><JoobiLockup variant="header" /><span style={labelStyle}>{summary.isSample ? '샘플 · 가상 보유' : '내 포트폴리오'}</span></div>
        {summary.isSample && <p style={{ margin: '0 0 20px', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-subtle)', ...labelStyle }}>체험을 위해 만든 보유 예시예요. 실제 투자 성과가 아니에요.</p>}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...labelStyle, fontSize: 13, marginBottom: 8 }}>현재 평가수익률 · 원화 기준</div>
          <div style={{ fontSize: canShare ? 36 : 22, fontWeight: 750, color: summary.totalPnlPct === null || summary.totalPnlPct === 0 ? 'var(--text-primary)' : summary.totalPnlPct > 0 ? 'var(--color-gain)' : 'var(--color-loss)', lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>{returnText}</div>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, margin: '0 0 20px' }}>
          <div><dt style={labelStyle}>평가이익 종목 비율</dt><dd style={valueStyle}>{summary.gainRatio === null ? '—' : `${summary.gainRatio}%`}</dd></div>
          <div><dt style={labelStyle}>평가이익인 종목</dt><dd style={valueStyle}>{summary.gainCount} / {summary.quotedHoldingCount}개</dd></div>
        </dl>
        <p style={{ margin: '0 0 8px', ...labelStyle }}>등록한 매수가와 확인된 시세·환율로 계산해요. 거래를 마친 수익이나 매매 성공률을 뜻하지 않아요.</p>
        <p style={{ margin: 0, ...labelStyle, fontSize: 11 }}>{coverage}{summary.sampleExcluded ? ' · 샘플 종목 제외' : ''}<br />조회일 {dateStr}</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button onClick={() => setIsOpen(false)} style={{ ...buttonStyle, color: 'var(--text-body)', background: 'var(--bg-subtle)' }}>닫기</button>
        {kakaoReady && <button disabled={!canShare} onClick={handleKakaoShare} style={{ ...buttonStyle, color: '#191F28', background: '#FEE500', cursor: canShare ? 'pointer' : 'not-allowed', opacity: canShare ? 1 : 0.5 }}>카카오톡</button>}
        <button disabled={!canShare} onClick={handleGeneralShare} style={{ ...buttonStyle, color: 'var(--on-brand-fg)', background: 'var(--brand-fill)', cursor: canShare ? 'pointer' : 'not-allowed', opacity: canShare ? 1 : 0.5 }}>{copied ? '복사했어요' : '공유하기'}</button>
      </div>
      {shareError && <p role="status" style={{ margin: '10px 0 0', ...labelStyle, fontSize: 13 }}>{shareError}</p>}
    </div>
  );
}
