'use client';

import { useCallback, useRef, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { OcrStock } from '@/app/api/portfolio/ocr/route';

interface Props {
  onClose: () => void;
}

type Step = 'upload' | 'loading' | 'review' | 'done';
type TargetCat = 'investing' | 'watching';

// 편집 가능한 OCR 데이터
interface EditableStock extends OcrStock {
  editAvgCost: string;
  editShares: string;
  isComplete: boolean;
}

export default function OcrImportModal({ onClose }: Props) {
  const addStock = usePortfolioStore(s => s.addStock);
  const stocks = usePortfolioStore(s => s.stocks);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [ocrStocks, setOcrStocks] = useState<EditableStock[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(0);
  const [appliedWatching, setAppliedWatching] = useState(0);
  const [skippedDup, setSkippedDup] = useState(0);
  const [targetCat, setTargetCat] = useState<TargetCat>('investing');
  const fileRef = useRef<HTMLInputElement>(null);

  const existingSymbols = new Set([
    ...(stocks.investing || []).map(s => s.symbol.toUpperCase()),
    ...(stocks.watching || []).map(s => s.symbol.toUpperCase()),
    ...(stocks.sold || []).map(s => s.symbol.toUpperCase()),
  ]);

  const isDuplicate = (symbol: string) => existingSymbols.has(symbol.toUpperCase());

  const processFile = async (file: File) => {
    setError('');
    setPreview(URL.createObjectURL(file));
    setStep('loading');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/portfolio/ocr', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '분석 실패');
        setStep('upload');
        return;
      }

      // EditableStock으로 변환
      const editable: EditableStock[] = (data.stocks as OcrStock[]).map(s => ({
        ...s,
        editAvgCost: s.avgCost !== null ? String(s.avgCost) : '',
        editShares: s.shares !== null ? String(s.shares) : '',
        isComplete: s.avgCost !== null && s.avgCost > 0 && s.shares !== null && s.shares > 0,
      }));

      setOcrStocks(editable);
      setSource(data.source);
      const nonDupIndices = new Set(
        editable.map((_, i) => i).filter(i => !isDuplicate(editable[i].symbol))
      );
      setSelected(nonDupIndices);
      setStep('review');
    } catch {
      setError('네트워크 오류가 발생했어요.');
      setStep('upload');
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    processFile(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const updateField = (i: number, field: 'editAvgCost' | 'editShares', value: string) => {
    setOcrStocks(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      const cost = parseFloat(field === 'editAvgCost' ? value : next[i].editAvgCost) || 0;
      const shares = parseInt(field === 'editShares' ? value : next[i].editShares) || 0;
      next[i].isComplete = cost > 0 && shares > 0;
      return next;
    });
  };

  const applyToPortfolio = () => {
    let investCount = 0;
    let watchCount = 0;
    let dupCount = 0;

    ocrStocks.forEach((s, i) => {
      if (!selected.has(i)) return;
      if (isDuplicate(s.symbol)) { dupCount++; return; }

      const finalAvgCost = parseFloat(s.editAvgCost) || 0;
      const finalShares = parseInt(s.editShares) || 0;
      const hasPosition = finalAvgCost > 0 && finalShares > 0;

      // 완전한 데이터 → 선택한 카테고리, 불완전 → 관심종목
      const cat = hasPosition ? targetCat : 'watching';

      addStock(cat, {
        symbol: s.symbol.toUpperCase(),
        avgCost: finalAvgCost,
        shares: finalShares,
        targetReturn: hasPosition ? 10 : 0,
        purchaseRate: s.currency === 'USD' ? undefined : 0,
        buyBelow: !hasPosition ? 0 : undefined,
      });

      if (cat === 'investing') investCount++;
      else watchCount++;
    });

    setApplied(investCount);
    setAppliedWatching(watchCount);
    setSkippedDup(dupCount);
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setOcrStocks([]);
    setSelected(new Set());
    setError('');
    setSkippedDup(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const selectableCount = Array.from(selected).filter(i => !isDuplicate(ocrStocks[i]?.symbol)).length;
  const incompleteSelected = Array.from(selected).filter(i => {
    const s = ocrStocks[i];
    return s && !isDuplicate(s.symbol) && !s.isComplete;
  }).length;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* 헤더 */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#191F28' }}>스크린샷으로 가져오기</div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginTop: 3 }}>MTS/HTS 보유종목 화면 캡처 → 자동 입력</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#B0B8C1', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* STEP: upload */}
          {step === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#3182F6' : '#E5E8EB'}`,
                  borderRadius: 16, padding: '48px 24px', textAlign: 'center',
                  cursor: 'pointer', background: dragOver ? 'rgba(49,130,246,0.04)' : '#FAFAFA',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#191F28', marginBottom: 6 }}>보유종목 화면 스크린샷</div>
                <div style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.6 }}>
                  클릭하거나 파일을 드래그해서 업로드<br />JPG · PNG · WEBP · 최대 10MB
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,82,0.08)', borderRadius: 10, fontSize: 13, color: '#EF4452' }}>{error}</div>
              )}

              <div style={{ marginTop: 20, padding: '14px 16px', background: '#F8F9FA', borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 8 }}>지원 증권사</div>
                <div style={{ fontSize: 12, color: '#8B95A1', lineHeight: 1.8 }}>
                  키움 영웅문 · 삼성 mPOP · 미래에셋 m.ALL<br />
                  NH투자 · 한국투자 · 토스증권 · KB증권<br />
                  Interactive Brokers · 기타 모든 MTS/HTS
                </div>
              </div>
            </div>
          )}

          {/* STEP: loading */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {preview && (
                <img src={preview} alt="업로드된 이미지" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 12, marginBottom: 24, opacity: 0.6 }} />
              )}
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#191F28', marginBottom: 6 }}>AI가 종목 정보를 읽는 중...</div>
              <div style={{ fontSize: 13, color: '#8B95A1' }}>Gemini 2.5 Flash 분석 중 (5~10초)</div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3182F6', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.6 }} />
                ))}
              </div>
              <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div>
              {preview && (
                <img src={preview} alt="업로드된 이미지" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 12, marginBottom: 16, border: '1px solid #F2F4F6' }} />
              )}

              {/* 카테고리 선택 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {([['investing', '투자 중'], ['watching', '관심 종목']] as [TargetCat, string][]).map(([cat, label]) => (
                  <button key={cat} onClick={() => setTargetCat(cat)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: targetCat === cat ? '#191F28' : '#F2F4F6',
                      color: targetCat === cat ? '#fff' : '#4E5968',
                      border: 'none', cursor: 'pointer',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>{ocrStocks.length}개 종목 인식됨</span>
                  {source && source !== '알 수 없음' && (
                    <span style={{ fontSize: 12, color: '#8B95A1', marginLeft: 8 }}>{source}</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    const allNonDup = new Set(ocrStocks.map((_, i) => i).filter(i => !isDuplicate(ocrStocks[i].symbol)));
                    setSelected(selected.size === allNonDup.size ? new Set() : allNonDup);
                  }}
                  style={{ fontSize: 12, color: '#3182F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  {selectableCount === ocrStocks.filter(s => !isDuplicate(s.symbol)).length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ocrStocks.map((s, i) => {
                  const dup = isDuplicate(s.symbol);
                  const incomplete = !s.isComplete && !dup;
                  const isSelected = selected.has(i);

                  return (
                    <div
                      key={i}
                      style={{
                        padding: '12px 14px', borderRadius: 12,
                        border: `1.5px solid ${dup ? '#E5E8EB' : incomplete && isSelected ? '#FF9500' : isSelected ? '#3182F6' : '#E5E8EB'}`,
                        background: dup ? '#F8F9FA' : incomplete && isSelected ? 'rgba(255,149,0,0.04)' : isSelected ? 'rgba(49,130,246,0.04)' : '#fff',
                        opacity: dup ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {/* 상단: 체크 + 종목명 */}
                      <div
                        onClick={() => !dup && toggleSelect(i)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: dup ? 'default' : 'pointer' }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: 6,
                          background: dup ? '#E5E8EB' : isSelected ? '#3182F6' : '#F2F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {dup ? <span style={{ color: '#8B95A1', fontSize: 10 }}>—</span>
                            : isSelected && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: dup ? '#8B95A1' : '#191F28', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {s.name || s.symbol}
                            <span style={{ fontSize: 11, color: '#8B95A1', fontWeight: 400 }}>{s.symbol}</span>
                            {dup && <span style={{ fontSize: 10, color: '#FF9500', fontWeight: 600 }}>이미 보유</span>}
                            {incomplete && isSelected && <span style={{ fontSize: 10, color: '#FF9500', fontWeight: 600 }}>정보 부족</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: s.currency === 'USD' ? 'rgba(49,130,246,0.1)' : 'rgba(0,198,190,0.1)', color: s.currency === 'USD' ? '#3182F6' : '#00C6BE', fontWeight: 600 }}>
                          {s.currency}
                        </span>
                      </div>

                      {/* 하단: 데이터 (완전하면 텍스트, 불완전하면 입력 필드) */}
                      {!dup && (
                        <div style={{ marginTop: 8, marginLeft: 32 }}>
                          {s.isComplete ? (
                            <div style={{ fontSize: 12, color: '#4E5968' }}>
                              평단 {s.currency === 'KRW' ? `${Number(s.editAvgCost).toLocaleString()}원` : `$${Number(s.editAvgCost).toLocaleString()}`}
                              {' · '}
                              {Number(s.editShares).toLocaleString()}주
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 10, color: '#8B95A1', display: 'block', marginBottom: 2 }}>평균매수가</label>
                                <input
                                  type="number"
                                  placeholder={s.currency === 'KRW' ? '0' : '0.00'}
                                  value={s.editAvgCost}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => updateField(i, 'editAvgCost', e.target.value)}
                                  style={{
                                    width: '100%', padding: '6px 8px', fontSize: 13, fontWeight: 600,
                                    border: `1px solid ${s.editAvgCost ? '#E5E8EB' : '#FF9500'}`,
                                    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                                    background: '#fff',
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 10, color: '#8B95A1', display: 'block', marginBottom: 2 }}>보유수량</label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={s.editShares}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => updateField(i, 'editShares', e.target.value)}
                                  style={{
                                    width: '100%', padding: '6px 8px', fontSize: 13, fontWeight: 600,
                                    border: `1px solid ${s.editShares ? '#E5E8EB' : '#FF9500'}`,
                                    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                                    background: '#fff',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 불완전 종목 안내 */}
              {incompleteSelected > 0 && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,149,0,0.08)', borderRadius: 10, fontSize: 12, color: '#FF9500', lineHeight: 1.6 }}>
                  {incompleteSelected}개 종목의 평단/수량이 비어있어요.
                  값을 입력하지 않으면 <strong>관심 종목</strong>으로 추가됩니다.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={reset} style={{ flex: 1, padding: '12px 0', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', cursor: 'pointer' }}>
                  다시 촬영
                </button>
                <button
                  onClick={applyToPortfolio}
                  disabled={selectableCount === 0}
                  style={{ flex: 2, padding: '12px 0', background: selectableCount > 0 ? '#3182F6' : '#B0B8C1', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: selectableCount > 0 ? 'pointer' : 'not-allowed' }}
                >
                  {selectableCount}개 포트폴리오에 추가
                </button>
              </div>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>
                {applied + appliedWatching}개 종목 추가 완료
              </div>
              <div style={{ fontSize: 13, color: '#8B95A1', marginBottom: 24, lineHeight: 1.8 }}>
                {applied > 0 && <>투자 중 {applied}개<br /></>}
                {appliedWatching > 0 && <>관심 종목 {appliedWatching}개 (정보 미입력)<br /></>}
                {skippedDup > 0 && <>중복 {skippedDup}개 건너뜀<br /></>}
                포트폴리오에서 확인하고 필요하면 수정해주세요.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={reset} style={{ flex: 1, padding: '12px 0', background: '#F2F4F6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', cursor: 'pointer' }}>
                  더 가져오기
                </button>
                <button onClick={onClose} style={{ flex: 2, padding: '12px 0', background: '#191F28', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                  완료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
