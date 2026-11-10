'use client';

import appUI from '../ui/AppUI.module.css';
import readingUI from '../ui/ReadingUI.module.css';

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
          <summary className={readingUI.disclosure} >데이터 출처·조회시각 보기</summary>
          <div style={{ marginTop: 4, paddingLeft: 8 }}>
            {meta.sourceDetails.map(sourceItem => (
              <div key={`${sourceItem.name}:${sourceItem.provider}`}>
                {sourceItem.name} · {sourceItem.url && /^https:\/\//.test(sourceItem.url)
                  ? <a href={sourceItem.url} target="_blank" rel="noopener noreferrer">{sourceItem.provider} ↗<span className="sr-only"> (새 창)</span></a>
                  : sourceItem.provider} · {/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(sourceItem.retrievedAt)
                  ? sourceItem.retrievedAt.replaceAll('-', '. ')
                  : new Date(sourceItem.retrievedAt).toLocaleString('ko-KR')}{sourceItem.note ? ` · ${sourceItem.note}` : ''}
              </div>
            ))}
          </div>
        </details>
      ) : <div>출처 {meta.dataSources.join(' · ')}</div>}
      <button className={appUI.textButton} onClick={reportError} disabled={reported} style={{ marginTop: 4 }}>
        {reported ? '오류 신고가 접수됐어요' : '내용 오류 신고'}
      </button>
    </div>
  );
}
