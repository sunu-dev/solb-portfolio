'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';

export default function EditStockModal() {
  const {
    stocks, editingCat, editingIdx,
    setEditingCat, setEditingIdx, updateStock, moveStock,
  } = usePortfolioStore();

  const [avgCost, setAvgCost] = useState('');
  const [shares, setShares] = useState('');
  const [targetReturn, setTargetReturn] = useState('');
  const [targetSell, setTargetSell] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [buyZones, setBuyZones] = useState('');
  const [weight, setWeight] = useState('');
  const [buyBelow, setBuyBelow] = useState('');
  const [addBuyPrice, setAddBuyPrice] = useState('');
  const [addBuyShares, setAddBuyShares] = useState('');

  const isOpen = editingCat !== '' && editingIdx >= 0;
  const stock = isOpen ? stocks[editingCat as keyof typeof stocks]?.[editingIdx] : null;
  const kr = stock ? (STOCK_KR[stock.symbol] || stock.symbol) : '';

  // Scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
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
    setTargetSell(stock.targetSell ? String(stock.targetSell) : '');
    setStopLoss(stock.stopLoss ? String(stock.stopLoss) : '');
    setBuyZones(stock.buyZones ? stock.buyZones.join(',') : '');
    setWeight(stock.weight ? String(stock.weight) : '');
    setBuyBelow(stock.buyBelow ? String(stock.buyBelow) : '');
    setAddBuyPrice('');
    setAddBuyShares('');
  }, [stock]);

  const close = () => {
    setEditingCat('');
    setEditingIdx(-1);
  };

  // Compute new avg cost preview
  const oldCostNum = parseFloat(avgCost) || 0;
  const oldSharesNum = parseInt(shares) || 0;
  const addPriceNum = parseFloat(addBuyPrice) || 0;
  const addSharesNum = parseInt(addBuyShares) || 0;
  const newTotalShares = oldSharesNum + addSharesNum;
  const newAvgCost = newTotalShares > 0
    ? (oldCostNum * oldSharesNum + addPriceNum * addSharesNum) / newTotalShares
    : oldCostNum;

  const save = () => {
    if (!editingCat || editingIdx < 0) return;

    let finalAvgCost = parseFloat(avgCost) || 0;
    let finalShares = parseInt(shares) || 0;

    // Recalculate if additional buy is provided
    if (addPriceNum > 0 && addSharesNum > 0) {
      finalShares = finalShares + addSharesNum;
      finalAvgCost = (finalAvgCost * (parseInt(shares) || 0) + addPriceNum * addSharesNum) / finalShares;
    }

    const data: Record<string, unknown> = {
      avgCost: finalAvgCost,
      shares: finalShares,
      targetReturn: parseFloat(targetReturn) || 0,
    };

    if (editingCat === 'investing') {
      data.targetSell = parseFloat(targetSell) || 0;
      data.stopLoss = parseFloat(stopLoss) || 0;
      data.buyZones = buyZones.split(',').map(Number).filter(n => n > 0);
      data.weight = parseInt(weight) || 0;
    } else if (editingCat === 'watching') {
      data.buyBelow = parseFloat(buyBelow) || 0;
    }

    updateStock(editingCat as 'investing' | 'watching' | 'sold', editingIdx, data);
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
          background: '#FFFFFF',
          zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
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
          <div style={{ fontSize: 18, fontWeight: 700, color: '#191F28' }}>
            {stock?.symbol} {kr !== stock?.symbol ? kr : ''} 설정
          </div>
          <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 2 }}>매수 정보와 목표가를 설정하세요</div>
        </div>

        <div style={{ padding: '16px 24px', maxHeight: 'min(60vh, calc(100vh - 200px))', overflowY: 'auto' }}>
          {/* Category selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>분류</label>
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

          {/* Common fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>평균 매수 단가 ($)</label>
              <input type="number" step="0.01" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} placeholder="0.00"
                style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>보유 수량 (주)</label>
              <input type="number" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0"
                style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>목표 수익률 (%)</label>
            <input type="number" value={targetReturn} onChange={(e) => setTargetReturn(e.target.value)} placeholder="0"
              style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Category-specific fields */}
          {editingCat === 'investing' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>목표가 ($)</label>
                  <input type="number" step="0.01" value={targetSell} onChange={(e) => setTargetSell(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>손절가 ($)</label>
                  <input type="number" step="0.01" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>매수 구간 (쉼표 구분)</label>
                <input type="text" value={buyZones} onChange={(e) => setBuyZones(e.target.value)} placeholder="430, 404, 380"
                  style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>비중 (%)</label>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0"
                  style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* 추가 매수 */}
              <div style={{ paddingTop: 16, borderTop: '1px solid #F2F4F6' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#191F28' }}>추가 매수 기록</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>매수가 ($)</label>
                    <input type="number" step="0.01" value={addBuyPrice} onChange={e => setAddBuyPrice(e.target.value)} placeholder="0.00"
                      style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>수량</label>
                    <input type="number" value={addBuyShares} onChange={e => setAddBuyShares(e.target.value)} placeholder="0"
                      style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                {addBuyPrice && addBuyShares && addPriceNum > 0 && addSharesNum > 0 && (
                  <div style={{ fontSize: 12, color: '#3182F6', marginTop: 8 }}>
                    → 새 평균단가: ${newAvgCost.toFixed(2)} / 총 {newTotalShares}주
                  </div>
                )}
              </div>
            </>
          )}

          {editingCat === 'watching' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', display: 'block', marginBottom: 6 }}>매수 목표가 ($)</label>
              <input type="number" step="0.01" value={buyBelow} onChange={(e) => setBuyBelow(e.target.value)} placeholder="0.00"
                style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F2F4F6', background: '#F9FAFB', display: 'flex', gap: 12 }}>
          <button onClick={close}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', background: '#FFFFFF', border: '1px solid #E5E8EB', cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={save}
            style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer' }}>
            저장
          </button>
        </div>
      </div>
    </>
  );
}
