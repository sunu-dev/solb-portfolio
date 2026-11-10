'use client';

import { useRef, useState } from 'react';
import StockAnalysisQuestions from '@/components/analysis/StockAnalysisQuestions';
import StockLearning from '@/components/analysis/StockLearning';
import { lessonForQuestion } from '@/config/stockQuestions';
import ui from '@/components/ui/AppUI.module.css';
import styles from './guidelines.module.css';

const modes = [['signed-out','비로그인'],['ready','질문 가능'],['checking','횟수 확인 중'],['unavailable','확인 실패'],['exhausted','소진'],['cached','받은 답변'],['generating','답변 준비 중']] as const;
type Mode = typeof modes[number][0];
export default function DesignQuestionPreview() {
  const [mode,setMode] = useState<Mode>('signed-out');
  const [selected,setSelected] = useState<string|null>(null);
  const [background,setBackground] = useState<string>();
  const [notice,setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const closeAnswer = () => {
    const id = selected;
    setSelected(null);
    if(mode==='generating') setMode('ready');
    requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-question-id="${id}"]`)?.focus({preventScroll:true}));
  };
  const restoreQuestion = (id:string) => {
    setBackground(undefined);
    requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-question-background="${id}"]`)?.focus({preventScroll:true}));
  };
  return <div ref={root}>
    <div className={styles.previewHeading}><h3>AI 질문과 무료 개념 읽기</h3><span>실제 컴포넌트 · 예시 상태</span></div>
    <div className={styles.modeButtons} aria-label="질문 이용 상태 미리보기">{modes.map(([id,label])=><button type="button" key={id} className={ui.segment} aria-pressed={mode===id} onClick={()=>{setMode(id);setSelected(id==='generating'?'safe':null);setNotice('');}}>{label}</button>)}</div>
    <p className={styles.support}>이 영역은 상태와 동작을 검수하는 예시예요. AI 요청이나 실제 로그인을 실행하지 않아요.</p>
    {notice && <p className={styles.previewNotice} role="status">{notice}</p>}
    <StockAnalysisQuestions owner="design-question-preview" symbol="DESIGN-PREVIEW" tags={[]} selectedId={selected} loading={mode==='generating'}
      quotaStatus={mode==='exhausted'||mode==='cached'||mode==='generating'?'ready':mode} remaining={mode==='exhausted'||mode==='cached'?0:mode==='ready'||mode==='generating'?3:null} cachedQuestionIds={mode==='cached'?['safe']:[]}
      onSelect={id=>{if(mode==='signed-out'){setNotice('실제 서비스에서는 로그인으로 이어져요. 개념 먼저 읽기는 바로 이용할 수 있어요.');return;} setSelected(id);setNotice('');}}
      backgroundQuestionId={background} onLearn={id=>setBackground(id)}
      renderBackground={id=>background===id?<StockLearning owner="design-question-preview" symbol="DESIGN-PREVIEW" name="예시 회사" tags={[]} embedded initialLessonId={lessonForQuestion(id)} onCompany={()=>{}} onNews={()=>{}} onReturn={()=>restoreQuestion(id)} returnLabel="이 질문으로 돌아가기" />:null}
      answer={selected?<section id="stock-assistant-answer" className={styles.previewAnswer} aria-label="동작 확인용 예시 답변"><strong>답변 영역 · 동작 예시</strong>{mode==='generating'?<p role="status">답변을 준비하는 표시예요. 실제 AI 요청은 실행하지 않아요.</p>:<p>선택한 질문의 답변이 같은 자리에서 열려요. 실제 종목 분석은 주비에서 확인해 주세요.</p>}<button type="button" className={ui.textButton} onClick={closeAnswer}>{mode==='generating'?'예시 요청 취소':'예시 답변 닫기'}</button></section>:undefined} />
  </div>;
}
