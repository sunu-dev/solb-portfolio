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
  // Short-specific
  const [targetSell, setTargetSell] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  // Long-specific
  const [buyZones, setBuyZones] = useState('');
  const [weight, setWeight] = useState('');
  // Watch-specific
  const [buyBelow, setBuyBelow] = useState('');

  const isOpen = editingCat !== '' && editingIdx >= 0;
  const stock = isOpen ? stocks[editingCat as keyof typeof stocks]?.[editingIdx] : null;
  const kr = stock ? (STOCK_KR[stock.symbol] || stock.symbol) : '';

  // Populate form when stock changes
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
  }, [stock]);

  const close = () => {
    setEditingCat('');
    setEditingIdx(-1);
  };

  const save = () => {
    if (!editingCat || editingIdx < 0) return;

    const data: Record<string, unknown> = {
      avgCost: parseFloat(avgCost) || 0,
      shares: parseInt(shares) || 0,
      targetReturn: parseFloat(targetReturn) || 0,
    };

    if (editingCat === 'short') {
      data.targetSell = parseFloat(targetSell) || 0;
      data.stopLoss = parseFloat(stopLoss) || 0;
    } else if (editingCat === 'long') {
      data.buyZones = buyZones.split(',').map(Number).filter(n => n > 0);
      data.weight = parseInt(weight) || 0;
    } else {
      data.buyBelow = parseFloat(buyBelow) || 0;
    }

    updateStock(editingCat as 'short' | 'long' | 'watch', editingIdx, data);
    close();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={close} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-[440px] mx-auto bg-white rounded-[14px] z-50 p-5 animate-fade-in">
        <h3 className="text-[16px] font-bold text-[#191F28] mb-4">
          {stock?.symbol} {kr} 설정
        </h3>

        <div className="space-y-3">
          {/* Common fields */}
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">평균 매수 단가 ($)</label>
            <input
              type="number"
              step="0.01"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">보유 수량 (주)</label>
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">목표 수익률 (%)</label>
            <input
              type="number"
              value={targetReturn}
              onChange={(e) => setTargetReturn(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
            />
          </div>

          {/* Category-specific fields */}
          {editingCat === 'short' && (
            <>
              <div>
                <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">목표가 ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={targetSell}
                  onChange={(e) => setTargetSell(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">손절가 ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
                />
              </div>
            </>
          )}

          {editingCat === 'long' && (
            <>
              <div>
                <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">매수 구간 (쉼표 구분, 예: 430,404,380)</label>
                <input
                  type="text"
                  value={buyZones}
                  onChange={(e) => setBuyZones(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">비중 (%)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
                />
              </div>
            </>
          )}

          {editingCat === 'watch' && (
            <div>
              <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">매수 목표가 ($)</label>
              <input
                type="number"
                step="0.01"
                value={buyBelow}
                onChange={(e) => setBuyBelow(e.target.value)}
                className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
              />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={close}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB] transition-colors"
          >
            취소
          </button>
          <button
            onClick={save}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </>
  );
}
