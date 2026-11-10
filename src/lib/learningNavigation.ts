import { STOCK_LESSONS } from '@/config/stockLearning';
import { LEARNING_LINKS, LEARNING_TERMS } from '@/config/stockLearningGraph';

export type LearningInstrument = 'stock' | 'fund';
export const lessonById = (id?: string) => STOCK_LESSONS.find(lesson => lesson.id === id);

/** Editorial relevance comes first. Visited neighbors remain available; unrelated
 * unread lessons must never become the next step just to keep someone clicking. */
export function learningNeighbors(current: string, trail: readonly string[] = [], instrument: LearningInstrument = 'stock') {
  if (instrument === 'fund') return [];
  const seen = new Set(trail);
  return (LEARNING_LINKS[current] ?? [])
    .filter(([target], index, links) => target !== current && links.findIndex(([id]) => id === target) === index)
    .flatMap(([target, reason]) => {
      const lesson = lessonById(target);
      return lesson ? [{ lesson, reason, visited: seen.has(target) }] : [];
    })
    .sort((a, b) => Number(a.visited) - Number(b.visited))
    .slice(0, 2);
}

/** First two non-overlapping concepts; prefer the longest term at a shared position. */
export function learningTermLinks(text: string, current: string) {
  const matches = LEARNING_TERMS.filter(([, id]) => id !== current && lessonById(id))
    .flatMap(([word, id]) => {
      const index = text.indexOf(word);
      return index < 0 ? [] : [{ word, id, index }];
    })
    .sort((a, b) => a.index - b.index || b.word.length - a.word.length);
  const chosen: typeof matches = [];
  const seen = new Set<string>();
  let end = 0;
  for (const match of matches) {
    if (chosen.length === 2) break;
    if (match.index < end || seen.has(match.id)) continue;
    chosen.push(match);
    seen.add(match.id);
    end = match.index + match.word.length;
  }
  return chosen;
}

export interface LearningReadingState {
  active: string | null;
  trail: { id: string; top: number; trigger?: string }[];
}

/** A saved visit restores its own question, never a new unrelated fallback. */
export function restoreLearningReading(reading?: LearningReadingState, initialLessonId?: string): LearningReadingState {
  const active = reading ? lessonById(reading.active ?? undefined)?.id ?? null : lessonById(initialLessonId)?.id ?? null;
  return {
    active,
    trail: active && reading ? reading.trail.filter(step => lessonById(step.id)).slice(-30).map(step => ({
      id: step.id,
      top: Number.isFinite(step.top) ? Math.max(0, step.top) : 0,
      ...(step.trigger && /^\[data-learning-(?:term|related)="[a-z-]+"\]$/.test(step.trigger) ? { trigger: step.trigger } : {}),
    })) : [],
  };
}
