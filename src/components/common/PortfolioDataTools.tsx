'use client';

import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { Download, FileJson, RotateCcw, Upload } from 'lucide-react';
import CsvImportModal from '@/components/portfolio/CsvImportModal';
import { usePortfolioStore } from '@/store/portfolioStore';
import {
  buildPortfolioCsv,
  buildPortfolioJson,
  parsePortfolioBackupJson,
} from '@/utils/portfolioExport';

function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function PortfolioDataTools() {
  const stocks = usePortfolioStore((state) => state.stocks);
  const dailySnapshots = usePortfolioStore((state) => state.dailySnapshots);
  const portfolioImportHistory = usePortfolioStore((state) => state.portfolioImportHistory);
  const syncStatus = usePortfolioStore((state) => state.portfolioSyncStatus);
  const cloudLoadStatus = usePortfolioStore((state) => state.portfolioCloudLoadStatus);
  const restorePortfolioBackup = usePortfolioStore((state) => state.restorePortfolioBackup);
  const [showImport, setShowImport] = useState(false);
  const [message, setMessage] = useState('');
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const closeImport = useCallback(() => setShowImport(false), []);
  const mutationBlocked = cloudLoadStatus === 'loading'
    || cloudLoadStatus === 'error'
    || syncStatus === 'conflict'
    || syncStatus === 'storage-error';

  const handleBackupRestore = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (mutationBlocked) {
      setMessage('클라우드 기록 상태를 먼저 확인한 뒤 복원해주세요.');
      return;
    }
    try {
      const parsed = parsePortfolioBackupJson(await file.text());
      const holdingCount = Object.values(parsed.payload.stocks)
        .reduce((sum, rows) => sum + rows.length, 0);
      const confirmed = window.confirm(
        `종목 ${holdingCount}개, 장기 스냅샷 ${parsed.payload.snapshots.length}개, 복구 지점 ${parsed.payload.history.length}개를 확인했어요.\n`
        + '현재 종목은 복구 지점으로 남기고, 과거 기록은 삭제하지 않고 합쳐요. 계속할까요?',
      );
      if (!confirmed) return;
      restorePortfolioBackup(parsed.payload);
      setMessage(
        parsed.sourceSchema === 'joobi-portfolio-export-v1'
          ? '구버전 종목 기록을 이 기기에 복원했어요. 기존 장기 기록은 그대로 유지하고 동기화를 이어가요.'
          : '종목과 장기 기록을 이 기기에 복원했고 클라우드 동기화를 이어가요.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '기록 파일을 복원하지 못했어요.');
    }
  }, [mutationBlocked, restorePortfolioBackup]);

  return (
    <>
      <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
        <div style={{ color: 'var(--text-primary, #191F28)', fontSize: 14, fontWeight: 600 }}>
          포트폴리오 데이터
        </div>
        <div style={{ marginTop: 4, marginBottom: 12, color: 'var(--text-secondary, #8B95A1)', fontSize: 12, lineHeight: 1.6 }}>
          종목은 CSV로 옮기고, 종목·일일 스냅샷·복구 지점은 JSON으로 함께 보관하거나 복원할 수 있어요. 파일은 이 기기에서 만들고 읽어요.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={() => downloadText(
              buildPortfolioCsv(stocks),
              `joobi-portfolio-${todayStamp()}.csv`,
              'text/csv;charset=utf-8',
            )}
            style={{
              minHeight: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 10,
              border: '1px solid var(--border-strong, #E5E8EB)',
              background: 'var(--surface, #FFFFFF)',
              color: 'var(--text-secondary, #4E5968)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={15} aria-hidden="true" />
            CSV 저장
          </button>
          <button
            type="button"
            disabled={mutationBlocked}
            onClick={() => setShowImport(true)}
            style={{
              minHeight: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 10,
              border: '1px solid rgba(14,124,123,0.25)',
              background: 'var(--brand-primary-bg, rgba(14,124,123,0.07))',
              color: 'var(--brand-primary, #0E7C7B)',
              fontSize: 12,
              fontWeight: 700,
              cursor: mutationBlocked ? 'not-allowed' : 'pointer',
              opacity: mutationBlocked ? 0.5 : 1,
            }}
          >
            <Upload size={15} aria-hidden="true" />
            CSV 가져오기
          </button>
        </div>

        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={() => downloadText(
              buildPortfolioJson(stocks, dailySnapshots, portfolioImportHistory),
              `joobi-records-${todayStamp()}.json`,
              'application/json;charset=utf-8',
            )}
            style={{
              minHeight: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 10,
              border: 0,
              background: 'var(--bg-subtle, #F2F4F6)',
              color: 'var(--text-secondary, #4E5968)',
              fontSize: 12,
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            <FileJson size={14} aria-hidden="true" />
            기록 JSON 저장
          </button>
          <button
            type="button"
            disabled={mutationBlocked}
            onClick={() => jsonInputRef.current?.click()}
            style={{
              minHeight: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 10,
              border: '1px solid var(--border-strong, #E5E8EB)',
              background: 'var(--surface, #FFFFFF)',
              color: 'var(--text-secondary, #4E5968)',
              fontSize: 12,
              fontWeight: 650,
              cursor: mutationBlocked ? 'not-allowed' : 'pointer',
              opacity: mutationBlocked ? 0.5 : 1,
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            기록 JSON 복원
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleBackupRestore}
            style={{ display: 'none' }}
          />
        </div>

        {message && (
          <div aria-live="polite" style={{ marginTop: 9, color: 'var(--text-secondary, #4E5968)', fontSize: 11, lineHeight: 1.55 }}>
            {message}
          </div>
        )}
      </div>

      {showImport && <CsvImportModal onClose={closeImport} />}
    </>
  );
}
