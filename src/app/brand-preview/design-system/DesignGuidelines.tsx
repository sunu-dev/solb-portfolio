import JoobiLockup from '@/components/brand/JoobiLockup';
import { brandRules, coverage, layoutRules, writingRules } from './designReference';
import styles from './guidelines.module.css';

export function IdentityGuidelines() {
  return <>
    <div className={styles.brandCanvas}><JoobiLockup variant="hero" /><p>세상의 변화와 내 투자 사이를 풀어주는 주식비서.</p><div className={styles.path}><span>발견해요</span><span aria-hidden="true">→</span><span>이해해요</span><span aria-hidden="true">→</span><span>연결해요</span></div></div>
    <div className={styles.threeColumns}>{brandRules.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div>
    <div className={styles.logoRules}><div><span className={styles.label}>실제 서비스 로고</span><div className={styles.logoSpecimen}><JoobiLockup variant="header" /></div><p>현재 헤더·모달의 로고를 그대로 사용해요. 본문 글꼴과 로고 글꼴은 역할이 달라요.</p></div><div><span className={styles.label}>사용 기준</span><ul><li>심볼과 글자의 비율·간격·붉은 심볼을 보존해요.</li><li>로고를 늘리거나 손그림 글자로 다시 만들지 않아요.</li><li>헤더·모달·히어로 크기는 기존 변형을 재사용해요.</li><li>실제 서비스 로고의 밝기·다크 변형을 함께 확인해요.</li></ul></div></div>
    <aside className={styles.note}>붉은 심볼은 주비를 식별하는 표식이에요. 옐로는 주요 동작, 빨강·파랑은 숫자의 상승·하락을 표현해요. 옐로 강조를 투자 추천이나 안전 표시로 사용하지 않아요.</aside>
  </>;
}

export function LayoutGuidelines() {
  return <>
    <div className={styles.ruleGrid}>{layoutRules.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div>
    <div className={styles.rhythm} aria-label="여백 기준 예시">{[8,16,24,32,40].map(value => <div key={value}><span style={{width:value}} /><small>{value}px</small></div>)}</div>
    <h3 className={styles.subheading}>말투에도 같은 기준을</h3>
    <div className={styles.writing}>{writingRules.map(item => <article key={item.subject}><h4>{item.subject}</h4><div><span>이렇게 써요</span><p>{item.use}</p></div><div className={styles.avoid}><span>피할 표현</span><p>{item.avoid}</p></div></article>)}</div>
    <aside className={styles.note}>수치·해석·가상 예시를 구분하고, 약어의 뜻과 중간 전달 과정을 생략하지 않아요. 문구의 길이는 숨길 내용을 늘려 줄이지 않고 첫 요약과 자세한 설명으로 나눠요.</aside>
  </>;
}

export function CoverageGuidelines() {
  return <>
    <div className={styles.coverageHeader}><span>화면·도구</span><span>현재 적용 범위와 남은 일</span></div>
    <div className={styles.coverage}>{coverage.map(item => <article key={item.area}><div><h3>{item.area}</h3><span className={styles.status} data-status={item.status}>{item.status}</span></div><div><p>{item.detail}</p><code>{item.source}</code></div></article>)}</div>
    <div className={styles.sources}><h3>기준을 바꿀 때 함께 볼 곳</h3><dl><div><dt>설명·제품 원칙</dt><dd>docs/JOOBI_EXPLANATION_PRINCIPLES.md</dd></div><div><dt>시각·동작 기준</dt><dd>docs/UI_SYSTEM.md · READING_UI_SYSTEM.md</dd></div><div><dt>색·글자·크기</dt><dd>src/app/globals.css</dd></div><div><dt>실제 컨트롤</dt><dd>AppUI.module.css · ReadingUI.module.css</dd></div></dl><p>기준 변경 → 공통 코드 반영 → 대표 화면의 두 테마·상태·기기 검수 → 적용 현황 갱신 순서로 진행해요. 이 목록은 전체 화면 전수 검수 완료 표시가 아니에요.</p></div>
  </>;
}
