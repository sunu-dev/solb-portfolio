'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';

export default function EditStockModal() {
  const {
    stocks, editingCat, editingIdx,
    setEditingCat, setEditingIdx, updateStock,
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

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-[480px] mx-auto bg-white rounded-2xl z-50 shadow-xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#F2F4F6]">
          <h3 className="text-[18px] font-bold text-[#191F28]">
            {stock?.symbol} {kr !== stock?.symbol ? kr : ''} 설정
          </h3>
          <p className="text-[12px] text-[#8B95A1] mt-0.5">매수 정보와 목표가를 설정하세요</p>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">평균 매수 단가 ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all tabular-nums"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">보유 수량 (주)</label>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all tabular-nums"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">목표 수익률 (%)</label>
              <input
                type="number"
                value={targetReturn}
                onChange={(e) => setTargetReturn(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all tabular-nums"
                placeholder="0"
              />
            </div>

            {/* Category-specific fields */}
            {editingCat === 'investing' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">목표가 ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={targetSell}
                      onChange={(e) => setTargetSell(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">손절가 ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">매수 구간 (쉼표 구분)</label>
                  <input
                    type="text"
                    value={buyZones}
                    onChange={(e) => setBuyZones(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all"
                    placeholder="430, 404, 380"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">비중 (%)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all tabular-nums"
                    placeholder="0"
                  />
                </div>
              </>
            )}

            {/* 추가 매수 (investing only) */}
            {editingCat === 'investing' && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #F2F4F6' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#191F28' }}>추가 매수 기록</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>매수가 ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={addBuyPrice}
                      onChange={e => setAddBuyPrice(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 14 }}
                      placeholder="0.00"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: '#8B95A1', display: 'block', marginBottom: 4 }}>수량</label>
                    <input
                      type="number"
                      value={addBuyShares}
                      onChange={e => setAddBuyShares(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 14 }}
                      placeholder="0"
                    />
                  </div>
                </div>
                {addBuyPrice && addBuyShares && addPriceNum > 0 && addSharesNum > 0 && (
                  <div style={{ fontSize: 12, color: '#3182F6', marginTop: 8 }}>
                    → 새 평균단가: ${newAvgCost.toFixed(2)} / 총 {newTotalShares}주
                  </div>
                )}
              </div>
            )}

            {editingCat === 'watching' && (
              <div>
                <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">매수 목표가 ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={buyBelow}
                  onChange={(e) => setBuyBelow(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all tabular-nums"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F2F4F6] bg-[#F9FAFB] flex gap-3">
          <button
            onClick={close}
            className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold text-[#4E5968] bg-white ring-1 ring-black/[0.06] hover:bg-[#F2F4F6] transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={save}
            className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] transition-colors cursor-pointer"
          >
            저장
          </button>
        </div>
      </div>
    </>
  );
}
