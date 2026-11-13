import type { JoobiStage } from './joobiProgress';
import { assistantSmallTalk } from './assistantSmallTalk';

/** Visual reactions describe UI state, never investment outcomes or inferred emotions. */
export const JOOBI_REACTIONS = {
 idle: '', hello: '✦', listening: '✎', checking: '·', searching: '?', reading: '≡',
 supplement: '+', thinking: '…', validating: '✓', ready: '✦', retry: '↻',
 thanks: '♡', nod: '✓', bye: '✧', introduce: '☺', clarify: '?', limited: '☾',
 stopped: 'Ⅱ', settings: '⚙', privacy: '◇', clear: '↺', welcomeBack: '↩',
} as const;
export type JoobiMood = keyof typeof JOOBI_REACTIONS;
export const JOOBI_STAGE_REACTIONS: Record<JoobiStage, JoobiMood> = {
 checking:'checking', sources:'searching', articles:'reading', supplement:'supplement', writing:'thinking', validating:'validating',
};
export function joobiReplyReaction(question: string, local: boolean): JoobiMood {
 if (!local) return 'ready';
 const kind = assistantSmallTalk(question);
 return kind === 'greeting' ? 'hello' : kind === 'thanks' ? 'thanks' : kind === 'acknowledge' ? 'nod'
  : kind === 'farewell' ? 'bye' : kind === 'identity' ? 'introduce' : 'clarify';
}
export function joobiComposerReaction(state: { options: 'context'|'privacy'|null; clear: boolean; loading: boolean; stage: JoobiStage; stopped: boolean; error: boolean; candidates: boolean; limited: boolean; typing: boolean; history: boolean }): JoobiMood {
 if(state.clear)return 'clear';
 if(state.options)return state.options === 'privacy' ? 'privacy' : 'settings';
 if(state.loading)return JOOBI_STAGE_REACTIONS[state.stage];
 if(state.candidates)return 'clarify';
 if(state.error)return 'retry';
 if(state.stopped)return 'stopped';
 if(state.limited)return 'limited';
 if(state.typing)return 'listening';
 return state.history ? 'welcomeBack' : 'hello';
}
