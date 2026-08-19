'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AiResultMeta as AiResultMetaValue } from '@/lib/aiResultMeta';

export default function AiResultMeta({ meta, source, symbol }: {
  meta?: AiResultMetaValue;
  source: 'ai-analysis' | 'ai-chok';
  symbol?: string;
}) {
  const [reported, setReported] = useState(false);
  if (!meta) return null;

  const reportError = async () => {
    if (reported) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      window.dispatchEvent(new CustomEvent('open-login'));
      return;
    }
    const res = await fetch('/api/ai-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        source,
        symbol,
        rating: -1,
        comment: 'content_error',
        context: {
          generatedAt: meta.generatedAt,
          dataSources: meta.dataSources,
          aiProvider: meta.aiProvider,
          aiModel: meta.aiModel,
        },
      }),
    });
    if (res.ok) setReported(true);
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-light, #E5E8EB)', fontSize: 10.5, color: 'var(--text-tertiary, #8B95A1)', lineHeight: 1.6 }}>
      <div>생성 {new Date(meta.generatedAt).toLocaleString('ko-KR')}</div>
      {meta.aiModel ? <div>AI {meta.aiProvider || 'provider'} · {meta.aiModel}</div> : null}
      {meta.sourceDetails?.length ? (
        <details style={{ marginTop: 3 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-secondary, #4E5968)' }}>데이터 출처·조회시각 보기</summary>
          <div style={{ marginTop: 4, paddingLeft: 8 }}>
            {meta.sourceDetails.map(sourceItem => (
              <div key={`${sourceItem.name}:${sourceItem.provider}`}>
                {sourceItem.name} · {sourceItem.provider} · {new Date(sourceItem.retrievedAt).toLocaleString('ko-KR')}{sourceItem.note ? ` · ${sourceItem.note}` : ''}
              </div>
            ))}
          </div>
        </details>
      ) : <div>출처 {meta.dataSources.join(' · ')}</div>}
      <button onClick={reportError} disabled={reported} style={{ marginTop: 4, padding: 0, border: 0, background: 'none', color: reported ? '#16A34A' : 'var(--text-secondary, #4E5968)', fontSize: 10.5, cursor: reported ? 'default' : 'pointer', textDecoration: reported ? 'none' : 'underline' }}>
        {reported ? '오류 신고가 접수됐어요' : '내용 오류 신고'}
      </button>
    </div>
  );
}
