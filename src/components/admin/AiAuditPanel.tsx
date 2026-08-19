'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuditRow {
  id: number;
  created_at: string;
  feature: string;
  symbol: string | null;
  output: unknown;
  source_snapshot: unknown;
  flags: string[];
  severity: 'none' | 'review' | 'high';
  reviewed_at: string | null;
  review_note: string | null;
}

interface AuditData {
  available: boolean;
  message?: string;
  sampleRate?: number;
  rows: AuditRow[];
  summary?: { total: number; high: number; review: number; unreviewed: number };
  coverage?: Array<{
    feature: string;
    label: string;
    target: number;
    total: number;
    reviewed: number;
    remaining: number;
    progressPercent: number;
    ready: boolean;
  }>;
}

const severityColor = { none: '#16A34A', review: '#FF9500', high: '#EF4452' };
const severityLabel = { none: '정상', review: '검토', high: '높음' };

async function fetchAudits(severity: string): Promise<AuditData> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/admin/ai-audit?severity=${severity}`, {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
  });
  return await res.json() as AuditData;
}

export default function AiAuditPanel() {
  const [data, setData] = useState<AuditData | null>(null);
  const [severity, setSeverity] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    let ignore = false;
    void fetchAudits(severity).then(result => {
      if (ignore) return;
      setData(result);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [severity]);

  async function markReviewed(id: number) {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/admin/ai-audit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ id }),
    });
    setData(await fetchAudits(severity));
  }

  async function exportAuditPackage() {
    setExporting(true);
    setExportError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/ai-audit?export=1', {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!res.ok) throw new Error(`export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `joobi-ai-audit-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setExportError('검토 자료를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#8B95A1' }}>AI 감사 표본 로딩 중...</div>;
  if (!data?.available) return <div style={{ padding: 16, background: '#FFF8E8', borderRadius: 12, color: '#8A5A00', fontSize: 13 }}>{data?.message}</div>;

  const summary = data.summary || { total: 0, high: 0, review: 0, unreviewed: 0 };
  return (
    <div>
      <div style={{ padding: 14, marginBottom: 16, background: '#F8F9FA', borderRadius: 12, fontSize: 12, color: '#4E5968' }}>
        출력 표본율 <strong>{((data.sampleRate || 0) * 100).toFixed(1)}%</strong> · 사용자 ID, 프롬프트, 보유수량, 평단, 메모는 저장하지 않아요.
        {(data.sampleRate || 0) === 0 ? <div style={{ marginTop: 6, color: '#8A5A00', fontWeight: 700 }}>현재 표본 수집이 중지되어 있어요. 로컬 또는 승인된 환경에서 표본율을 설정해주세요.</div> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[['표본', summary.total, '#3182F6'], ['높은 위험', summary.high, '#EF4452'], ['수동 검토', summary.review, '#FF9500'], ['미검토', summary.unreviewed, '#191F28']].map(([label, value, color]) => (
          <div key={String(label)} style={{ padding: 16, background: '#fff', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: '#8B95A1' }}>{label}</div>
            <div style={{ marginTop: 5, fontSize: 22, fontWeight: 700, color: String(color) }}>{String(value)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 16 }}>
        {(data.coverage || []).map(item => (
          <div key={item.feature} style={{ padding: 16, background: '#fff', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
              <strong style={{ color: '#191F28' }}>{item.label} 표본 준비도</strong>
              <span style={{ color: item.ready ? '#16A34A' : '#3182F6', fontWeight: 700 }}>{item.total} / {item.target}건</span>
            </div>
            <div style={{ height: 6, marginTop: 10, background: '#E5E8EB', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${item.progressPercent}%`, height: '100%', background: item.ready ? '#16A34A' : '#3182F6' }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#8B95A1' }}>
              {item.ready ? `목표 수집 완료 · 수동 검토 ${item.reviewed}건` : `목표까지 ${item.remaining}건 · 수동 검토 ${item.reviewed}건`}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'high', 'review', 'none'].map(value => (
            <button key={value} onClick={() => { setLoading(true); setSeverity(value); }} style={{ padding: '6px 12px', border: 0, borderRadius: 16, cursor: 'pointer', background: severity === value ? 'var(--pill-active-bg, #191F28)' : 'var(--bg-subtle, #F2F4F6)', color: severity === value ? 'var(--text-inverse, #fff)' : '#4E5968' }}>
              {value === 'all' ? '전체' : severityLabel[value as keyof typeof severityLabel]}
            </button>
          ))}
        </div>
        <button onClick={exportAuditPackage} disabled={exporting || summary.total === 0} style={{ padding: '7px 12px', border: '1px solid var(--border-light, #E5E8EB)', borderRadius: 8, background: '#fff', color: '#4E5968', cursor: exporting || summary.total === 0 ? 'not-allowed' : 'pointer', opacity: exporting || summary.total === 0 ? 0.5 : 1, fontSize: 12, fontWeight: 700 }}>
          {exporting ? '검토 자료 준비 중...' : '검토 자료 JSON 저장'}
        </button>
      </div>
      {exportError ? <div role="alert" style={{ marginBottom: 12, color: '#EF4452', fontSize: 12 }}>{exportError}</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.rows.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#8B95A1' }}>표본이 없어요.</div> : data.rows.map(row => (
          <div key={row.id} style={{ padding: 14, background: '#fff', border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: severityColor[row.severity], fontWeight: 700, fontSize: 12 }}>{severityLabel[row.severity]}</span>
              <strong style={{ fontSize: 12 }}>{row.feature}</strong>
              {row.symbol ? <code style={{ fontSize: 11 }}>{row.symbol}</code> : null}
              {row.flags.map(flag => <span key={flag} style={{ padding: '2px 6px', background: '#FFF5F5', color: '#EF4452', borderRadius: 5, fontSize: 10 }}>{flag}</span>)}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8B95A1' }}>{new Date(row.created_at).toLocaleString('ko-KR')}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setExpanded(expanded === row.id ? null : row.id)} style={{ border: 0, padding: '5px 9px', borderRadius: 7, cursor: 'pointer' }}>{expanded === row.id ? '접기' : '출력 보기'}</button>
              {!row.reviewed_at ? <button onClick={() => markReviewed(row.id)} style={{ border: 0, padding: '5px 9px', borderRadius: 7, cursor: 'pointer', background: '#3182F6', color: '#fff' }}>검토 완료</button> : <span style={{ fontSize: 11, color: '#16A34A', alignSelf: 'center' }}>검토됨</span>}
            </div>
            {expanded === row.id ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ marginBottom: 5, fontSize: 11, fontWeight: 700, color: '#4E5968' }}>공개 데이터 기준값</div>
                  <pre style={{ padding: 12, background: '#F8F9FA', borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: 11 }}>{JSON.stringify(row.source_snapshot, null, 2)}</pre>
                </div>
                <div>
                  <div style={{ marginBottom: 5, fontSize: 11, fontWeight: 700, color: '#4E5968' }}>사용자 노출 AI 출력</div>
                  <pre style={{ padding: 12, background: '#F8F9FA', borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: 11 }}>{JSON.stringify(row.output, null, 2)}</pre>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
