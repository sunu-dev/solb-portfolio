'use client';
import { useState } from 'react';
import { Bookmark, Check } from 'lucide-react';
import { financialTerm } from '@/lib/financialTerms';
import { usePersonalDictionary } from './PersonalLearningProvider';
import styles from './LearningDesk.module.css';
import theme from './DictionaryTheme.module.css';
import { DICTIONARY_LIMIT } from '@/lib/personalDictionary';
export default function SaveTermButton({ termId, symbol, compact = false, notebook = false }: { termId: string; symbol?: string; compact?: boolean; notebook?: boolean }) {
  const { owner, entries, ready, error: loadError, save } = usePersonalDictionary();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const term = financialTerm(termId);
  if (!term) return null;
  const saved = entries.some(entry => entry.termId === termId);
  return <div className={notebook ? `${theme.theme} ${theme.save}` : styles.saveTerm}>
    <button type="button" aria-label={compact ? `${term.title.split(' · ')[0]} ${saved ? '저장됨' : '사전에 저장'}` : undefined} disabled={!ready || saved || pending} className={notebook ? theme.button : styles.secondary} onClick={async () => {
      setError('');
      setPending(true);
      let context = symbol;
      if (!context) context = new URLSearchParams(window.location.search).get('stock') ?? undefined;
      setError(await save({ id: `term:${termId}`, termId, title: term.title, note: '', symbol: context, savedAt: new Date().toISOString(), familiarity: 'new' }) ? '' : entries.length >= DICTIONARY_LIMIT ? `사전에는 ${DICTIONARY_LIMIT}개까지 저장할 수 있어요.` : '저장을 확인하지 못했어요. 사전을 다시 불러와 확인해 주세요.');
      setPending(false);
    }}>{saved ? <Check size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}{saved ? (compact ? '저장됨' : '내 주식사전에 저장됨') : pending ? '저장 중' : compact ? '저장' : '내 주식사전에 저장'}</button>
    {!compact && <small>{owner === 'guest' ? '비로그인 상태에서는 이 브라우저에만 저장돼요.' : '내 계정에 저장해 다른 기기에서도 볼 수 있어요.'}</small>}
    {!ready && loadError && <p role="status">저장한 단어를 다시 불러온 뒤 저장할 수 있어요.</p>}
    {error && !saved && <p role="alert">{error}</p>}
  </div>;
}
