import {expect,it} from 'vitest';
import {joobiComposerReaction,joobiReplyReaction,JOOBI_STAGE_REACTIONS,JOOBI_REACTIONS} from '@/lib/joobiReactions';
const base={options:null,clear:false,loading:false,stage:'checking',stopped:false,error:false,candidates:false,limited:false,typing:false,history:false} as const;
it('keeps active requests and clarification ahead of stale quota or draft state',()=>{
 expect(joobiComposerReaction({...base,loading:true,stage:'articles',limited:true,typing:true})).toBe('reading');
 expect(joobiComposerReaction({...base,candidates:true,error:true})).toBe('clarify');
 expect(joobiComposerReaction({...base,options:'privacy',loading:true})).toBe('privacy');
});
it('connects at least twenty distinct reactions to real interaction states',()=>{
 const moods=new Set([joobiComposerReaction(base),...Object.values(JOOBI_STAGE_REACTIONS),
 ...[{typing:true},{history:true},{clear:true},{options:'context' as const},{options:'privacy' as const},{error:true},{limited:true},{stopped:true},{candidates:true}].map(change=>joobiComposerReaction({...base,...change})),
 ...['안녕','고마워','알겠어요','잘가','너 누구야','네'].map(q=>joobiReplyReaction(q,true)),joobiReplyReaction('왜 떨어져?',false)]);
 expect(moods.size).toBeGreaterThanOrEqual(20);
 for(const mood of moods)expect(JOOBI_REACTIONS[mood]).toBeTruthy();
});
it('does not celebrate price direction or infer feelings from an ordinary question',()=>{
 expect(joobiReplyReaction('주가가 폭락해서 슬퍼',false)).toBe('ready');
 expect(joobiReplyReaction('고마워. 그런데 왜 떨어져?',false)).toBe('ready');
});
