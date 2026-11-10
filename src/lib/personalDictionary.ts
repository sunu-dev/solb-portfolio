import { FINANCIAL_TERMS, financialTerm } from './financialTerms';

export const DICTIONARY_PREFIX = 'joobi_dictionary_v1:';
export const DICTIONARY_LIMIT = 300;
export type Familiarity = 'new' | 'confused' | 'familiar';
export interface DictionaryEntry {
  id: string;
  termId?: string;
  title: string;
  note: string;
  symbol?: string;
  savedAt: string;
  familiarity: Familiarity;
  reviewedAt?: string;
  revision?: number;
}
export const validSymbol = (value: unknown): value is string => typeof value === 'string' && /^[A-Z0-9^.=-]{1,32}$/.test(value);
const validDate = (value: unknown): value is string => typeof value === 'string' && value.length <= 30 && Number.isFinite(Date.parse(value));
export function parseDictionary(raw: string | null): DictionaryEntry[] {
  try {
    if (!raw || raw.length > 600_000) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.slice(0, DICTIONARY_LIMIT).flatMap(entry => {
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || entry.id.length > 200 || seen.has(entry.id)
        || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 160 || !validDate(entry.savedAt)) return [];
      const term = typeof entry.termId === 'string' ? financialTerm(entry.termId) : undefined;
      if (entry.termId && (!term || entry.id !== `term:${term.id}`)) return [];
      seen.add(entry.id);
      return [{ id: entry.id, ...(term ? { termId: term.id } : {}), title: term?.title ?? entry.title.trim(),
        note: typeof entry.note === 'string' ? entry.note.slice(0, 900) : '',
        ...(validSymbol(entry.symbol) ? { symbol: entry.symbol } : {}), savedAt: entry.savedAt,
        familiarity: ['confused', 'familiar'].includes(entry.familiarity) ? entry.familiarity as Familiarity : 'new',
        ...(validDate(entry.reviewedAt) ? { reviewedAt: entry.reviewedAt } : {}),
      }];
    });
  } catch { return []; }
}
export function saveDictionaryEntry(entries: DictionaryEntry[], entry: DictionaryEntry) {
  const previous = entries.find(item => item.id === entry.id);
  if (!previous && entries.length >= DICTIONARY_LIMIT) throw new Error('dictionary_full');
  return previous ? entries.map(item => item.id === entry.id ? { ...entry, savedAt: previous.savedAt } : item) : [entry, ...entries];
}
export interface ReviewQuestion { entryId: string; termId: string; prompt: string; options: { id: string; label: string }[]; answerId: string; explanation: string; source: string }
// These are distinct concepts, but a first recall quiz should not rely on a
// beginner already knowing the difference between similarly named ratios.
const confusingQuizPairs = [['return', 'concept:이익률', 'concept:배당수익률']];
/** Mastery is explicit: reading or a correct quiz answer never sets this flag. */
export function dictionaryReviewEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  return entries.filter(entry => entry.familiarity !== 'familiar' && entry.termId && financialTerm(entry.termId));
}
/** Questions and answers come from the same maintained definition. Personal notes never become answer keys. */
export function buildDictionaryReview(entries: DictionaryEntry[], random: () => number = Math.random): ReviewQuestion[] {
  const shuffle = <T,>(items: T[]) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.max(0, Math.min(.999999, random())) * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  };
  return dictionaryReviewEntries(entries).sort((a, b) =>
    Number(b.familiarity === 'confused') - Number(a.familiarity === 'confused') || (a.reviewedAt ?? '').localeCompare(b.reviewedAt ?? '')
  ).slice(0, 3).map(entry => {
    const term = financialTerm(entry.termId!)!;
    const name = term.title.split(' · ')[0];
    // Ask to recall the term from its exact definition; exclude choices sharing a name/alias.
    const other = shuffle(FINANCIAL_TERMS.filter(item => item.id !== term.id
      && item.title.split(' · ')[0] !== name && !item.aliases.some(alias => term.aliases.includes(alias))
      && !term.related?.includes(item.id) && !item.related?.includes(term.id)
      && !confusingQuizPairs.some(group => group.includes(term.id) && group.includes(item.id))
      && item.meaning !== term.meaning
      && !term.aliases.some(alias => item.meaning.includes(alias)) && !item.aliases.some(alias => term.meaning.includes(alias))))
      .filter((item, index, all) => all.findIndex(other => other.title.split(' · ')[0] === item.title.split(' · ')[0]) === index);
    const choices = [term, ...other.slice(0, 2)];
    return { entryId: entry.id, termId: term.id, prompt: term.meaning, options: shuffle(choices).map(item => ({ id: item.id, label: item.title.split(' · ')[0] })),
      answerId: term.id, explanation: term.example || term.meaning, source: term.source };
  });
}
