'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import StockReturnBrief from '@/components/analysis/StockReturnBrief';
import StockDetailResources from '@/components/analysis/StockDetailResources';
import StockLearning from '@/components/analysis/StockLearning';
import BuySimulator from '@/components/portfolio/BuySimulator';
import JoobiLockup from '@/components/brand/JoobiLockup';
import { IdentityGuidelines, LayoutGuidelines, CoverageGuidelines } from './DesignGuidelines';
import DesignChecks from './DesignChecks';
import DesignQuestionPreview from './DesignQuestionPreview';
import { designNavigation } from './designReference';
import ui from '@/components/ui/AppUI.module.css';
import reading from '@/components/ui/ReadingUI.module.css';
import styles from './design-system.module.css';

const colors = [
  ['차콜', '--text-primary', '읽을 내용에 집중'],
  ['버터 옐로', '--brand-highlight', '중요한 시작과 선택'],
  ['크림', '--surface-warm', '이해를 돕는 이야기'],
  ['회색 종이', '--bg-subtle', '비어 있는 상태와 보조 정보'],
  ['리포트 바탕', '--surface-feature', '흐름을 읽는 집중 영역'],
  ['상승', '--color-gain', '+ 기호·상승 문구와 함께'],
  ['하락', '--color-loss', '− 기호·하락 문구와 함께'],
] as const;

export default function DesignSystem() {
  const [dark, setDark] = useState(false);
  const [currency, setCurrency] = useState('원화');
  const [state, setState] = useState<'empty' | 'loading' | 'error'>('empty');
  const [lesson, setLesson] = useState<string>();
  const [fieldValue, setFieldValue] = useState('');
  const [fieldChecked, setFieldChecked] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('direction');
  const fieldError = fieldChecked && !fieldValue.trim();
  useEffect(() => {
    const previous = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    return () => { document.documentElement.classList.toggle('dark', previous); };
  }, [dark]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      const current = entries.find(entry => entry.isIntersecting);
      if (current) setActiveSection(current.target.id);
    }, {rootMargin:'-15% 0px -65% 0px'});
    designNavigation.forEach(([id]) => { const section = document.getElementById(id); if(section) observer.observe(section); });
    return () => observer.disconnect();
  }, []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });

  return <div className={styles.site}>
    <a className={styles.skip} href="#direction">본문으로 건너뛰기</a>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.wordmark}><JoobiLockup variant="header" /><span className={styles.wordmarkLabel}>디자인</span></Link>
      <p className={styles.sidebarCaption}>쉽게 읽고, 자연스럽게 이어지도록.</p>
      <nav aria-label="디자인 기준">{designNavigation.map(([id, label], index) => <a key={id} href={`#${id}`} aria-current={activeSection===id?'location':undefined} onClick={()=>setActiveSection(id)}><span>0{index + 1}</span>{label}</a>)}</nav>
      <div className={styles.sidebarFooter}><span>주비 디자인 작업실</span><Link href="/">서비스로 돌아가기 <ArrowRight size={14} aria-hidden="true" /></Link></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><span>주비 디자인 기준 <span className={styles.edition}>2026.10</span></span><button className={ui.iconButton} type="button" aria-label={dark ? '밝은 디자인 보기' : '어두운 디자인 보기'} onClick={() => setDark(value => !value)}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button></header>
      <section id="direction" className={styles.hero}>
        <p className={styles.eyebrow}>주식 초보자를 위한 주식비서</p>
        <h1>이해하기 쉬운 투자,<br /><span>주비다운 화면.</span></h1>
        <p className={styles.heroIntro}>정돈된 숫자, 편안한 여백, 사람의 손이 느껴지는 그림.<br /> 이해에서 다음 궁금증으로 이어지는 경험을 만들어요.</p>
        <div className={styles.principles}>{[
          ['내용이 먼저', '확인된 사실을 앞에 두고, 설명과 출처는 한 번 눌러 이어 읽어요.'],
          ['강조는 필요한 곳에', '흰색과 차콜을 바탕으로 중요한 시작에만 옐로를 사용해요.'],
          ['다음 질문으로', '소식에서 개념으로, 기업에서 내 투자로 자연스럽게 이어져요.'],
        ].map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</div>
      </section>
      <section id="identity" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>차분하게, 다정하게, 연결해서</p><h2>주비가 주비로 보이는 이유.</h2><p>기존 서비스의 로고와 승인한 시각 방향을 바탕으로, 바뀌지 않을 역할을 정리해요.</p></div>
        <IdentityGuidelines />
      </section>
      <section id="foundations" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>기본 재료</p><h2>조용한 바탕, 분명한 위계.</h2><p>서비스에서 사용하는 색과 글자 기준을 그대로 불러와요. 의미 색은 장식과 구분해요.</p></div>
        <div className={styles.swatches}>{colors.map(([title, token, use]) => <article key={token}><div className={styles.swatch} style={{ background: `var(${token})` }} /><h3>{title}</h3><p>{use}</p><code>{token}</code></article>)}</div>
        <div className={styles.typeSamples}><div><span>페이지 제목 · 24 / 650</span><p className={ui.pageTitle}>내 투자를 한곳에 모아보세요</p></div><div><span>읽기 제목 · 공통 섹션 기준</span><h3 className={reading.sectionTitle}>무슨 일이 있었나요?</h3></div><div><span>본문 · 15 / 400</span><p>낯선 용어의 뜻부터 내 투자와의 관계까지, 쉬운 말로 설명해요.</p></div><div><span>보조 정보 · 12 / 400</span><small>자료 기준 시각과 출처는 본문을 가리지 않도록 표시해요.</small></div></div>
      </section>
      <section id="illustrations" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>사람의 손이 느껴지도록</p><h2>가볍게 그린, 작은 이야기.</h2><p>승인한 평면 펜 드로잉 4종. 다크 모드에서도 밝은 종이 위에 놓습니다.</p></div>
        <div className={styles.illustrations}>{[['portfolio', '내 투자'], ['currency', '환율'], ['rates', '금리'], ['companies', '기업 비교']].map(([file, title]) => <figure key={file}><div><Image src={`/illustrations/home/${file}-handdrawn-v2.png`} alt={title} width={384} height={256} /></div><figcaption>{title}</figcaption></figure>)}</div>
        <p className={styles.illustrationRules}>얇고 조금 불규칙한 펜선, 적은 색, 평면적인 형태를 유지해요. 광택·입체 렌더링·복잡한 배관 같은 장식은 피하고, 정보 전달을 가리지 않아요. 이 4종의 승인과 기존 산업 그림 전체의 교체는 별도 범위예요.</p>
      </section>
      <section id="rules" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>어느 화면에서도 같은 감각</p><h2>배치부터 말투까지, 하나의 기준.</h2><p>여백·단위·아이콘·움직임과 사실을 설명하는 순서를 함께 맞춰요.</p></div>
        <LayoutGuidelines />
      </section>
      <section id="components" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>같은 역할에는 같은 동작</p><h2>누르기 전부터 알 수 있게.</h2><p>실제 공통 버튼과 선택 그룹, 펼치기를 사용한 예시입니다.</p></div>
        <div className={styles.controls}><button type="button" className={ui.accentButton} onClick={() => scrollTo('detail')}>상세 화면 살펴보기 <ArrowRight size={16} aria-hidden="true" /></button><a href="#illustrations" className={ui.secondaryButton}>그림 보기</a><button type="button" className={ui.primaryButton} disabled>자료 확인 중</button></div>
        <div className={styles.controlRow}><span>표시 통화</span><div className={ui.segments} aria-label="통화 선택 예시">{['원화', '달러'].map(item => <button key={item} type="button" className={ui.segment} aria-pressed={currency === item} onClick={() => setCurrency(item)}>{item}</button>)}</div><span className={styles.selection}>{currency} 선택됨</span></div>
        <details className={styles.disclosure}><summary className={reading.disclosure}>자세한 설명은 필요할 때 펼쳐요</summary><p>첫 화면은 간결하게, 출처와 자료 범위는 한 번 눌러 읽을 수 있게 합니다. 키보드로도 같은 순서로 살펴볼 수 있어요.</p></details>
        <form className={styles.fieldDemo} onSubmit={event=>{event.preventDefault();setFieldChecked(true);}} noValidate>
          <label htmlFor="design-field">기록 이름 · 입력 상태 예시</label>
          <div><input id="design-field" className={ui.field} value={fieldValue} onChange={event=>setFieldValue(event.target.value)} aria-invalid={fieldError} aria-describedby="design-field-feedback" placeholder="예: 다음 실적에서 확인할 것" /><button type="submit" className={ui.secondaryButton}>입력 상태 확인</button></div>
          <p id="design-field-feedback" role="status">{fieldError?'기록 이름을 입력해 주세요.':fieldChecked?'입력한 내용을 확인했어요. 이 예시에서는 저장하지 않아요.':'빈 입력과 오류·정상 상태를 확인하는 예시예요. 실제 기록은 저장하지 않아요.'}</p>
        </form>
      </section>
      <section id="detail" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>실제 서비스 컴포넌트</p><h2>소식에서, 다음 궁금증까지.</h2><p>상세 하단의 새 위계와 동작을 확인하는 예시 화면입니다. 실제 종목 자료는 아니에요.</p></div>
        <div className={styles.demoToolbar}><span>소식 표시 상태</span><div className={ui.segments} aria-label="소식 상태 미리보기">{([['empty', '자료 없음'], ['loading', '확인 중'], ['error', '불러오기 실패']] as const).map(([id, label]) => <button key={id} className={ui.segment} type="button" aria-pressed={state === id} onClick={() => setState(id)}>{label}</button>)}</div></div>
        <div className={styles.demo}>
          <DesignQuestionPreview />
          <StockReturnBrief owner="design-preview" symbol="DESIGN-PREVIEW" items={[]} newsStatus={state} price={0} currency="KRW" onLearn={setLesson} />
          <StockDetailResources items={[
            {id:'industry',title:'산업과 다른 기업',description:'같은 산업에서 맡는 역할 비교',content:<p>산업 설명과 기업 비교가 열리는 자리예요. 선택한 항목의 내용과 닫기를 같은 위치에서 제공합니다.</p>},
            {id:'report',title:'종합 분석',description:'여러 관점으로 정리한 AI 분석',content:<p>종합 분석을 시작하는 자리예요. 이 디자인 예시에서는 AI를 호출하지 않습니다.</p>},
          ]} />
          <div className={styles.learning}><StockLearning name="이 회사" owner="design-preview" symbol="DESIGN-PREVIEW" tags={['earnings']} initialLessonId={lesson} onNews={() => scrollTo('detail')} onCompany={() => scrollTo('direction')} /></div>
          <div className={styles.personal}><h3>내 투자에 연결하기</h3><p className={styles.exampleNote}>가상 가격 10,000원으로 계산하는 동작 예시입니다.</p><BuySimulator symbol="DESIGN-PREVIEW" market="KR" currentPrice={10000} priceCurrency="KRW" shares={0} avgCost={0} totalPortfolioValue={0} usdKrw={1300} currency="KRW" /></div>
        </div>
      </section>
      <section id="review" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>보기 좋은 화면에서, 쓰기 좋은 화면으로</p><h2>놓친 상태까지 확인해요.</h2><p>현재 토큰의 대비를 측정하고 변경한 화면을 직접 점검해요. 미확인 항목을 완료로 채우지 않아요.</p></div>
        <DesignChecks />
      </section>
      <section id="coverage" className={styles.section}>
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>기준과 실제 적용을 함께</p><h2>어디까지 맞췄는지, 남김없이.</h2><p>2026년 10월 22일 작업 기준의 범위예요. 적용한 기준과 추가 검수 범위를 구분해요.</p></div>
        <CoverageGuidelines />
      </section>
      <footer className={styles.footer}><strong>주비 디자인</strong><p>색과 동작의 기준은 공통 UI를, 설명의 순서는 제품 원칙을 따릅니다.</p><Link href="/">주비로 돌아가기 <ArrowRight size={15} aria-hidden="true" /></Link></footer>
    </main>
  </div>;
}
