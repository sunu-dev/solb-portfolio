'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { MacroEntry, StockNote } from '@/config/constants';

// 메모 감정 태그 (InvestmentNotes와 동일 세트 사용)
const MEMO_TAGS = [
  { emoji: '🤔', label: '분석 후' },
  { emoji: '😤', label: '충동' },
  { emoji: '🎯', label: '목표 달성' },
  { emoji: '📰', label: '뉴스 보고' },
  { emoji: '💡', label: '인사이트' },
];

export default function EditStockModal() {
  const {
    stocks, editingCat, editingIdx,
    setEditingCat, setEditingIdx, updateStock, moveStock,
    macroData,
  } = usePortfolioStore();

  const [avgCost, setAvgCost] = useState('');
  const [shares, setShares] = useState('');
  const [targetReturn, setTargetReturn] = useState('');
  const [targetProfitUSD, setTargetProfitUSD] = useState('');
  const [targetProfitKRW, setTargetProfitKRW] = useState('');
  const [targetSell, setTargetSell] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [stopLossPct, setStopLossPct] = useState('');
  const [buyZones, setBuyZones] = useState('');
  const [weight, setWeight] = useState('');
  const [buyBelow, setBuyBelow] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [addBuyPrice, setAddBuyPrice] = useState('');
  const [addBuyShares, setAddBuyShares] = useState('');
  const [addBuyRate, setAddBuyRate] = useState('');
  const [mode, setMode] = useState<'basic' | 'detail'>('basic');

  // 메모 프롬프트 상태 (저장 직후 변경 감지 시 활성화)
  const [memoContext, setMemoContext] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');
  const [memoEmoji, setMemoEmoji] = useState('🤔');
  const [pendingSaveContext, setPendingSaveContext] = useState<{ cat: 'investing' | 'watching' | 'sold'; idx: number } | null>(null);

  // 현재 USD/KRW 환율 (macroData에서)
  const currentUsdKrw = Math.round((macroData['USD/KRW'] as MacroEntry | undefined)?.value || 1400);

  const isOpen = editingCat !== '' && editingIdx >= 0;
  const stock = isOpen ? stocks[editingCat as keyof typeof stocks]?.[editingIdx] : null;
  const kr = stock ? (STOCK_KR[stock.symbol] || stock.symbol) : '';
  const isKR = stock ? (stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ')) : false;
  const unit = isKR ? '₩' : '$';

  // Scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSaved(false);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!stock) return;
    setAvgCost(stock.avgCost ? String(stock.avgCost) : '');
    setShares(stock.shares ? String(stock.shares) : '');
    setTargetReturn(stock.targetReturn ? String(stock.targetReturn) : '');
    setTargetProfitUSD(stock.targetProfitUSD ? String(stock.targetProfitUSD) : '');
    setTargetProfitKRW(stock.targetProfitKRW ? String(stock.targetProfitKRW) : '');
    setTargetSell(stock.targetSell ? String(stock.targetSell) : '');
    setStopLoss(stock.stopLoss ? String(stock.stopLoss) : '');
    setStopLossPct(stock.stopLossPct ? String(stock.stopLossPct) : '');
    setBuyZones(stock.buyZones ? stock.buyZones.join(',') : '');
    setWeight(stock.weight ? String(stock.weight) : '');
    setBuyBelow(stock.buyBelow ? String(stock.buyBelow) : '');
    // purchaseRate: 저장된 값 우선, 없으면 현재 환율로 초기화 (신규 입력 편의)
    setPurchaseRate(stock.purchaseRate ? String(stock.purchaseRate) : String(currentUsdKrw));
    setAddBuyPrice('');
    setAddBuyShares('');
    setAddBuyRate(String(currentUsdKrw));
  }, [stock, currentUsdKrw]);

  const close = () => {
    setEditingCat('');
    setEditingIdx(-1);
  };

  // Compute new avg cost + weighted purchaseRate preview
  const oldCostNum = parseFloat(avgCost) || 0;
  const oldSharesNum = parseInt(shares) || 0;
  const addPriceNum = parseFloat(addBuyPrice) || 0;
  const addSharesNum = parseInt(addBuyShares) || 0;
  const addRateNum = parseFloat(addBuyRate) || currentUsdKrw;
  const newTotalShares = oldSharesNum + addSharesNum;
  const newAvgCost = newTotalShares > 0
    ? (oldCostNum * oldSharesNum + addPriceNum * addSharesNum) / newTotalShares
    : oldCostNum;
  const oldRateNum = parseFloat(purchaseRate) || currentUsdKrw;
  // 가중 평균 환율: (기존수량 × 기존환율 + 추가수량 × 추가환율) / 총수량
  const newWeightedRate = newTotalShares > 0
    ? Math.round((oldCostNum * oldSharesNum * oldRateNum + addPriceNum * addSharesNum * addRateNum) /
        (oldCostNum * oldSharesNum + addPriceNum * addSharesNum || 1))
    : oldRateNum;

  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!editingCat || editingIdx < 0 || !stock) return;

    let finalAvgCost = parseFloat(avgCost) || 0;
    let finalShares = parseInt(shares) || 0;
    let finalPurchaseRate = parseFloat(purchaseRate) || currentUsdKrw;

    // Recalculate if additional buy is provided
    if (addPriceNum > 0 && addSharesNum > 0) {
      finalShares = finalShares + addSharesNum;
      finalAvgCost = (finalAvgCost * (parseInt(shares) || 0) + addPriceNum * addSharesNum) / finalShares;
      finalPurchaseRate = newWeightedRate;
    }

    const data: Record<string, unknown> = {
      avgCost: finalAvgCost,
      shares: finalShares,
      targetReturn: parseFloat(targetReturn) || 0,
      targetProfitUSD: parseFloat(targetProfitUSD) || 0,
      targetProfitKRW: parseFloat(targetProfitKRW) || 0,
      purchaseRate: finalPurchaseRate,
    };

    if (editingCat === 'investing') {
      data.targetSell = parseFloat(targetSell) || 0;
      data.stopLoss = parseFloat(stopLoss) || 0;
      data.stopLossPct = parseFloat(stopLossPct) || 0;
      data.buyZones = buyZones.split(',').map(Number).filter(n => n > 0);
      data.weight = parseInt(weight) || 0;
    } else if (editingCat === 'watching') {
      data.buyBelow = parseFloat(buyBelow) || 0;
    }

    const catKey = editingCat as 'investing' | 'watching' | 'sold';
    updateStock(catKey, editingIdx, data);
    setSaved(true);

    // 변경 감지: 메모 프롬프트 트리거
    const sharesDelta = finalShares - (stock.shares || 0);
    const avgCostChanged = Math.abs(finalAvgCost - (stock.avgCost || 0)) > 0.01;
    const isFirstBuy = (stock.notes || []).length === 0
      && (stock.shares || 0) === 0
      && finalShares > 0
      && editingCat === 'investing';
    let context: string | null = null;

    if (isFirstBuy) {
      context = '첫 매수';
    } else if (addPriceNum > 0 && addSharesNum > 0) {
      context = `${addSharesNum}주 추가 매수`;
    } else if (sharesDelta !== 0) {
      context = sharesDelta > 0 ? `+${sharesDelta}주 매수` : `${Math.abs(sharesDelta)}주 매도`;
    } else if (avgCostChanged) {
      context = '평단 수정';
    }

    if (context) {
      setMemoContext(context);
      setMemoText('');
      setMemoEmoji('🤔');
      setPendingSaveContext({ cat: catKey, idx: editingIdx });
      // 메모 입력 대기 — close 안 함
    } else {
      setTimeout(() => close(), 600);
    }
  };

  // 메모 저장 (스킵/작성 공통)
  const saveMemoAndClose = (noteText?: string) => {
    if (!pendingSaveContext) {
      close();
      return;
    }
    const { cat, idx } = pendingSaveContext;
    const currentStock = stocks[cat]?.[idx];
    if (noteText && noteText.trim() && currentStock) {
      const newNote: StockNote = {
        text: `[${memoContext}] ${noteText.trim()}`,
        emoji: memoEmoji,
        date: new Date().toISOString() + '_' + Date.now(),
      };
      const updated = [...(currentStock.notes || []), newNote];
      updateStock(cat, idx, { notes: updated });
    }
    setMemoContext(null);
    setPendingSaveContext(null);
    close();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-50 backdrop-blur-xs" onClick={close} />

      {/* Modal — desktop: center, mobile: bottom sheet */}
      <div
        className="edit-stock-modal"
        style={{
          position: 'fixed',
          left: 16, right: 16,
          maxWidth: 480, margin: '0 auto',
          background: 'var(--surface, #FFFFFF)',
          zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${stock?.symbol || ''} 설정`}
      >
        <style>{`
          .edit-stock-modal {
            bottom: 0;
            border-radius: 20px 20px 0 0;
            max-height: 90vh;
          }
          @media (min-width: 769px) {
            .edit-stock-modal {
              top: 50%; bottom: auto;
              transform: translateY(-50%);
              border-radius: 20px;
              max-height: none;
            }
          }
        `}</style>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #F2F4F6' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
            {stock?.symbol} {kr !== stock?.symbol ? kr : ''} 설정
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginTop: 2 }}>
            {editingCat === 'watching' ? '목표 매수가를 설정하세요' : '매수 정보와 목표가를 설정하세요'}
          </div>
          {/* 기본/상세 탭 — 관심종목에서는 숨김 */}
          {editingCat !== 'watching' && (
            <div className="flex" style={{ gap: 4, marginTop: 12 }}>
              {(['basic', 'detail'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="cursor-pointer"
                  style={{
                    padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: mode === m ? 600 : 400,
                    background: mode === m ? 'var(--text-primary, #191F28)' : 'var(--bg-subtle, #F2F4F6)',
                    color: mode === m ? '#fff' : 'var(--text-secondary, #8B95A1)',
                    border: 'none',
                  }}
                >
                  {m === 'basic' ? '기본 (초보자)' : '상세'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', maxHeight: 'min(60vh, calc(100vh - 250px))', overflowY: 'auto' }}>
          {/* Category selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', display: 'block', marginBottom: 6 }}>분류</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { id: 'investing', label: '투자 중' },
                { id: 'watching', label: '관심 종목' },
                { id: 'sold', label: '매도 완료' },
              ] as const).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (editingCat === cat.id) return;
                    const fromCat = editingCat as 'investing' | 'watching' | 'sold';
                    const idx = editingIdx;
                    // moveStock 후 새 카테고리의 마지막 인덱스를 사용
                    const newIdx = (stocks[cat.id] || []).length; // 이동 전 길이 = 이동 후 마지막 인덱스
                    moveStock(fromCat, idx, cat.id);
                    setEditingCat(cat.id);
                    setEditingIdx(newIdx);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: editingCat === cat.id ? 700 : 500,
                    color: editingCat === cat.id ? '#3182F6' : '#8B95A1',
                    background: editingCat === cat.id ? 'rgba(49,130,246,0.08)' : '#F2F4F6',
                    border: editingCat === cat.id ? '1px solid rgba(49,130,246,0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 관심종목: buyBelow만 노출 */}
          {editingCat === 'watching' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', display: 'block', marginBottom: 6 }}>
                목표 매수가 ({unit})
                <span style={{ fontWeight: 400, color: 'var(--text-tertiary, #B0B8C1)' }}> — 이 가격 이하면 알림</span>
              </label>
              <input type="number" step="0.01" value={buyBelow} onChange={(e) => setBuyBelow(e.target.value)} placeholder="0.00"
                style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 18, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 8, lineHeight: 1.6 }}>
                💡 관심만 등록할 경우 비워두세요. 실제 매수 후엔 &quot;투자 중&quot;으로 이동하세요.
              </div>
            </div>
          )}

          {/* 투자 중 / 매도 완료: 평균 매수 단가 + 수량 + 환율 */}
          {editingCat !== 'watching' && (<>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', display: 'block', marginBottom: 6 }}>평균 매수 단가 ({unit}) <span style={{ fontWeight: 400, color: 'var(--text-tertiary, #B0B8C1)' }}>— 종목을 산 가격</span></label>
              <input type="number" step="0.01" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} placeholder="0.00"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', display: 'block', marginBottom: 6 }}>보유 수량 (주) <span style={{ fontWeight: 400, color: 'var(--text-tertiary, #B0B8C1)' }}>— 갖고 있는 주식 수</span></label>
              <input type="number" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* 매수 환율 — 환차익 추적 */}
          {!isKR && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', display: 'block', marginBottom: 6 }}>
                매수 시 환율 (USD/KRW)
                <span style={{ fontWeight: 400, color: 'var(--text-tertiary, #B0B8C1)' }}> — 살 때 달러 환율 (환차익 계산용)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value)}
                  placeholder={String(currentUsdKrw)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                />
                {purchaseRate !== String(currentUsdKrw) && (
                  <button
                    onClick={() => setPurchaseRate(String(currentUsdKrw))}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#3182F6', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                  >현재 환율로</button>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 4 }}>
                현재 환율: {currentUsdKrw.toLocaleString()}원
              </div>
            </div>
          )}
          </>)}

          {mode === 'detail' && editingCat !== 'watching' && (<>

          {/* ── 목표 수익 알림 ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
              📈 목표 수익 알림
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 10 }}>
              설정한 조건 중 하나라도 달성하면 이메일로 알림을 보내드려요
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 5 }}>
                  수익률 달성 <span style={{ fontWeight: 400 }}>(%)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="number" value={targetReturn} onChange={(e) => setTargetReturn(e.target.value)} placeholder="10"
                    style={{ width: '100%', padding: '10px 30px 10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', pointerEvents: 'none' }}>%</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 5 }}>
                  목표가 달성 <span style={{ fontWeight: 400 }}>({unit})</span>
                </label>
                <input type="number" step="0.01" value={targetSell} onChange={(e) => setTargetSell(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {!isKR && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 5 }}>
                    수익금 달성 <span style={{ fontWeight: 400 }}>($)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" step="0.01" value={targetProfitUSD} onChange={(e) => setTargetProfitUSD(e.target.value)} placeholder="500"
                      style={{ width: '100%', padding: '10px 30px 10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', pointerEvents: 'none' }}>$</span>
                  </div>
                </div>
              )}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 5 }}>
                  수익금 달성 <span style={{ fontWeight: 400 }}>(₩)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="number" value={targetProfitKRW} onChange={(e) => setTargetProfitKRW(e.target.value)} placeholder="1000000"
                    style={{ width: '100%', padding: '10px 30px 10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', pointerEvents: 'none' }}>₩</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category-specific fields */}
          {editingCat === 'investing' && (
            <>
              {/* ── 손절 기준 ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
                  🛡️ 손절 기준 알림
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 5 }}>
                      손절가 <span style={{ fontWeight: 400 }}>({unit})</span>
                    </label>
                    <input type="number" step="0.01" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 5 }}>
                      손절률 <span style={{ fontWeight: 400 }}>(%)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#EF4452', fontWeight: 700, pointerEvents: 'none' }}>-</span>
                      <input type="number" value={stopLossPct} onChange={(e) => setStopLossPct(e.target.value)} placeholder="10"
                        style={{ width: '100%', padding: '10px 30px 10px 26px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', pointerEvents: 'none' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', display: 'block', marginBottom: 6 }}>매수 구간 (쉼표 구분)</label>
                <input type="text" value={buyZones} onChange={(e) => setBuyZones(e.target.value)} placeholder="430, 404, 380"
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', display: 'block', marginBottom: 6 }}>비중 (%)</label>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0"
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* 추가 매수 */}
              <div style={{ paddingTop: 16, borderTop: '1px solid #F2F4F6' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #191F28)' }}>추가 매수 기록</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 4 }}>매수가 ({unit})</label>
                    <input type="number" step="0.01" value={addBuyPrice} onChange={e => setAddBuyPrice(e.target.value)} placeholder="0.00"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 4 }}>수량</label>
                    <input type="number" value={addBuyShares} onChange={e => setAddBuyShares(e.target.value)} placeholder="0"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                {!isKR && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 4 }}>추가 매수 시 환율 (USD/KRW)</label>
                    <input type="number" value={addBuyRate} onChange={e => setAddBuyRate(e.target.value)} placeholder={String(currentUsdKrw)}
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
                {addBuyPrice && addBuyShares && addPriceNum > 0 && addSharesNum > 0 && (
                  <div style={{ fontSize: 12, color: '#3182F6', marginTop: 4 }}>
                    → 새 평균단가: {unit}{newAvgCost.toFixed(isKR ? 0 : 2)} / 총 {newTotalShares}주
                    {!isKR && ` / 평균환율 ${newWeightedRate.toLocaleString()}원`}
                  </div>
                )}
              </div>
            </>
          )}

          </>)}
          {mode === 'basic' && editingCat !== 'watching' && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', textAlign: 'center', padding: '8px 0', lineHeight: 1.6 }}>
              💡 &quot;상세&quot; 탭에서 목표 수익률, 손절가 등을 설정할 수 있어요
            </div>
          )}
        </div>

        {/* Memo prompt — 저장 후 변경 감지 시 노출 */}
        {memoContext && (
          <div
            role="dialog"
            aria-label="투자 메모 남기기"
            style={{
              padding: '18px 24px',
              borderTop: '1px solid var(--border-light, #F2F4F6)',
              background: 'var(--color-info-bg, rgba(49,130,246,0.06))',
              animation: 'memo-slide-in 0.3s ease-out',
            }}
          >
            <style>{`
              @keyframes memo-slide-in {
                from { opacity: 0; transform: translateY(-8px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 15 }}>{memoContext === '첫 매수' ? '🌱' : '✅'}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                {memoContext === '첫 매수'
                  ? '저장 완료 · 왜 처음 사셨나요?'
                  : '저장 완료 · 왜 이 결정을 했나요?'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 12, lineHeight: 1.5 }}>
              {memoContext === '첫 매수'
                ? '1년 뒤 주비가 다시 보여드릴게요. 한 줄이면 충분해요.'
                : `한 줄만 남겨도 나중에 복기에 큰 도움이 돼요 (${memoContext})`}
            </div>

            {/* 감정 태그 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              {MEMO_TAGS.map(tag => {
                const active = memoEmoji === tag.emoji;
                return (
                  <button
                    key={tag.emoji}
                    onClick={() => setMemoEmoji(tag.emoji)}
                    style={{
                      padding: '4px 9px', borderRadius: 14,
                      fontSize: 11,
                      background: active ? 'var(--color-info, #3182F6)' : 'var(--surface, #FFFFFF)',
                      color: active ? '#fff' : 'var(--text-secondary, #4E5968)',
                      border: `1px solid ${active ? 'var(--color-info, #3182F6)' : 'var(--border-light, #F2F4F6)'}`,
                      cursor: 'pointer',
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                );
              })}
            </div>

            {/* 메모 입력 */}
            <textarea
              value={memoText}
              onChange={e => setMemoText(e.target.value)}
              placeholder={memoContext === '첫 매수'
                ? '예: AI 가속화 트렌드 베팅 · 실적 가속화 + 가이던스 상향 · 장기 보유 의도'
                : '예: 실적 발표 전 분할 매수 · 목표가 도달해서 일부 익절 · 뉴스 보고 추가매수'}
              autoFocus
              style={{
                width: '100%', minHeight: 60, padding: '10px 12px',
                borderRadius: 10, border: '1px solid var(--border-light, #F2F4F6)',
                background: 'var(--surface, #FFFFFF)', fontSize: 13,
                color: 'var(--text-primary, #191F28)', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => saveMemoAndClose()}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', background: 'var(--surface, #FFFFFF)', border: '1px solid var(--border-light, #F2F4F6)', cursor: 'pointer' }}
              >
                다음에
              </button>
              <button
                onClick={() => saveMemoAndClose(memoText)}
                disabled={!memoText.trim()}
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: memoText.trim() ? 'var(--color-info, #3182F6)' : 'var(--text-tertiary, #B0B8C1)', border: 'none', cursor: memoText.trim() ? 'pointer' : 'default' }}
              >
                메모 남기기
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F2F4F6', background: 'var(--bg-subtle, #F9FAFB)', display: 'flex', gap: 12 }}>
          <button onClick={close}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', background: 'var(--surface, #FFFFFF)', border: '1px solid var(--border-strong, #E5E8EB)', cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={save}
            disabled={saved}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#FFFFFF', background: saved ? '#20C997' : '#3182F6', border: 'none', cursor: saved ? 'default' : 'pointer', transition: 'background 0.2s' }}>
            {saved ? '저장됨 ✓' : '저장'}
          </button>
        </div>
      </div>
    </>
  );
}
