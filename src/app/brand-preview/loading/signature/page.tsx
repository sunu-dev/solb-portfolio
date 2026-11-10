'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Check, Moon, Pause, Play, RotateCcw, Smartphone, Sun } from 'lucide-react';
import ui from '../loading.module.css';
import motion from './signature.module.css';

const variants = [
  { name: '한 번에 쓰는 서명', kind: '원안 정돈', detail: '원래 1번처럼 붉은 선을 한 번에 그립니다. 완성된 로고를 충분히 보여준 뒤 다시 시작합니다.', why: '원안의 인상을 가장 가깝게 유지하는 기준안.' },
  { name: '끝점의 박자', kind: '끝점 모션', detail: '선과 글자는 완성된 모습으로 둡니다. 마지막 붉은 점만 작게 커졌다가 돌아옵니다.', why: '짧은 접속에도 로고가 바로 읽히고, 오래 보아도 차분합니다.' },
  { name: '빛이 지나는 선', kind: '선 위의 움직임', detail: '완성된 붉은 선 위로 밝은 붉은빛이 지나갑니다. 로고가 지워지는 순간 없이 흐름을 만듭니다.', why: '브랜드 형태를 선명하게 유지하면서 움직임이 잘 보입니다.' },
  { name: '선을 따라가는 점', kind: '작은 점의 이동', detail: '작은 점 하나가 붉은 선의 꺾임을 따라 움직입니다. 마지막 점에 도착하면 잠깐 머뭅니다.', why: '처음부터 끝까지 따라 보게 되는 작은 볼거리가 있어요.' },
  { name: '세 번의 리듬', kind: '구간별 드로잉', detail: '선의 세 구간을 차례로 그립니다. 마지막 점이 가볍게 반응하고, 완성된 서명에서 쉬어갑니다.', why: '짧은 움직임 안에 시작·연결·마무리가 있어 기억에 남습니다.' },
  { name: '이어지는 밑줄', kind: '로고 아래의 흐름', detail: '로고는 고정하고 아래의 가느다란 선에 붉은 빛이 흐릅니다. 채워지는 진행 막대가 아닌 일정한 길이의 빛입니다.', why: '브랜드가 흔들리지 않으면서 대기 중이라는 표시가 분명합니다.' },
  { name: '위아래 서명', kind: '세로 배치', detail: '붉은 심볼을 위에, 주비를 아래에 둡니다. 심볼의 선이 천천히 그려집니다.', why: '모바일에서 형태를 조금 더 크게 보여주는 배치입니다.' },
  { name: '여백의 서명', kind: '왼쪽 정렬', detail: '로고를 왼쪽에 두고 짧은 선이 오른쪽으로 이어집니다. 한 점이 선 위를 왕복합니다.', why: '가운데 정렬과 다른, 편집된 지면 같은 인상을 줍니다.' },
  { name: '심볼을 가까이', kind: '심볼 중심', detail: '붉은 심볼을 크게 보여주고 주비는 작게 받칩니다. 끝점 주변의 빛만 부드럽게 퍼집니다.', why: '작은 화면에서도 주비의 고유한 형태가 눈에 남습니다.' },
  { name: '서명 한 장', kind: '얇은 프레임', detail: '얇은 테두리 안에 로고를 놓습니다. 선이 그려진 뒤, 아래의 작은 붉은 획이 호흡합니다.', why: '로고에 적당한 무게를 주는 단정한 카드형 대안입니다.' },
] as const;
const recommended = [2, 3, 5];
const storageKey = 'joobi-loading-signature-favorites-v1';
const empty: number[] = [];
let cached: number[] = empty;
let cachedRaw: string | null = null;
let memoryOnly = false;
const listeners = new Set<() => void>();

function snapshot() {
  if (memoryOnly) return cached;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== cachedRaw) {
      const parsed: unknown = JSON.parse(raw ?? '[]');
      cached = Array.isArray(parsed) ? [...new Set(parsed.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 10))] : empty;
      cachedRaw = raw;
    }
  } catch { memoryOnly = true; }
  return cached;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => { if (e.key === storageKey || e.key === null) listener(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}
function favorite(n: number) {
  const current = snapshot();
  cached = current.includes(n) ? current.filter(value => value !== n) : [...current, n].sort((a,b) => a-b);
  cachedRaw = JSON.stringify(cached);
  try { localStorage.setItem(storageKey, cachedRaw); } catch { memoryOnly = true; }
  listeners.forEach(listener => listener());
}

function Mark({ variant }: { variant: number }) {
  return <div className={motion.markWrap}>
    <svg viewBox="0 0 40 40" className={motion.symbol} aria-hidden="true">
      <path className={motion.ghost} d="M7 31 15 20 22 24 33 10"/>
      {variant === 5 ? <g className={motion.segments}>
        <path pathLength="1" d="M7 31 15 20"/>
        <path pathLength="1" d="M15 20 22 24"/>
        <path pathLength="1" d="M22 24 33 10"/>
      </g> : <path className={motion.ink} pathLength="1" d="M7 31 15 20 22 24 33 10"/>}
      {variant === 3 && <path className={motion.highlight} pathLength="1" d="M7 31 15 20 22 24 33 10"/>}
      <circle className={motion.tip} cx="33" cy="10" r="3.2"/>
    </svg>
    {variant === 4 && <i className={motion.traveler}/>}
    {variant === 9 && <i className={motion.halo}/>}
  </div>;
}

function Signature({ variant }: { variant: number }) {
  return <div className={motion.signature} data-variant={variant}>
    <div className={motion.lockup}><Mark variant={variant}/><span className={motion.name}>주비</span></div>
    {variant === 6 ? <div className={motion.flowRail}><i/></div>
      : variant === 8 ? <div className={motion.editorialRail}><i/></div>
      : variant === 1 || variant === 10 ? <div className={motion.underline}/>
      : null}
  </div>;
}

export default function SignatureStudies() {
  const [selected, setSelected] = useState(2);
  const [mode, setMode] = useState<'all'|'focus'|'favorites'>('all');
  const [paused, setPaused] = useState(false);
  const [dark, setDark] = useState(false);
  const [phone, setPhone] = useState(false);
  const [revision, setRevision] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [scenario, setScenario] = useState<'normal'|'slow'|'error'>('normal');
  const favorites = useSyncExternalStore(subscribe, snapshot, () => empty);
  useEffect(() => {
    if (paused || mode !== 'focus' || scenario === 'error') return;
    const timer = setInterval(() => setElapsed(value => Math.min(value + 1, 60)), 1000);
    return () => clearInterval(timer);
  }, [paused, mode, scenario, revision]);
  function restart() { setRevision(value => value + 1); setElapsed(0); }
  function choose(n: number) { setSelected(n); setMode('focus'); setScenario('normal'); restart(); window.scrollTo({top:0,behavior:'auto'}); }
  function changeMode(next: 'all'|'focus'|'favorites') { setMode(next); window.scrollTo({top:0,behavior:'auto'}); }
  const item = variants[selected - 1];
  const shown = mode === 'favorites' ? favorites : variants.map((_, index) => index + 1);
  const slow = scenario === 'slow' || elapsed >= 8;

  return <main className={`${ui.lab} ${paused ? ui.paused : ''}`} data-theme={dark ? 'dark' : 'light'}>
    <header className={ui.toolbar}>
      <div className={ui.topline}><Link href="/brand-preview/loading" className={motion.back}><ArrowLeft size={15}/><b>주비</b><span>1번 변형 10안</span></Link>
        <div className={ui.tools}>
          <button type="button" aria-label={dark ? '밝은 배경' : '어두운 배경'} onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button>
          <button type="button" aria-label="모바일 비율" aria-pressed={phone} onClick={() => setPhone(!phone)}><Smartphone size={17}/></button>
          <button type="button" aria-label={paused ? '모션 재생' : '모션 일시정지'} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={17}/> : <Pause size={17}/>}</button>
          <button type="button" aria-label="모든 모션 처음부터" onClick={restart}><RotateCcw size={16}/></button>
        </div>
      </div>
      <div className={ui.controlLine}><div className={ui.picker}>
        <button type="button" aria-label="이전 변형" onClick={() => choose(selected === 1 ? 10 : selected - 1)}><ArrowLeft size={16}/></button>
        <label className={ui.selectLabel}><span className={ui.srOnly}>변형 선택</span><select aria-label="변형 선택" value={selected} onChange={e => choose(Number(e.target.value))}>{variants.map((value,index) => <option key={value.name} value={index+1}>01-{String(index+1).padStart(2,'0')}　{value.name}{recommended.includes(index+1) ? ' · 추천' : ''}</option>)}</select></label>
        <button type="button" aria-label="다음 변형" onClick={() => choose(selected === 10 ? 1 : selected + 1)}><ArrowRight size={16}/></button>
      </div><nav className={ui.tabs} aria-label="보기 방식">{([['all','전체 10'],['focus','한 개씩'],['favorites',`후보 ${favorites.length}`]] as const).map(([key,label]) => <button type="button" key={key} aria-current={mode === key ? 'page' : undefined} onClick={() => changeMode(key)}>{label}</button>)}</nav></div>
    </header>
    <div className={ui.body}>
      {mode === 'focus' ? <>
        <div className={ui.headline}><div><span className={ui.eyebrow}>SIGNATURE / 01-{String(selected).padStart(2,'0')}</span><h1>{item.name}{recommended.includes(selected) && <small>추천</small>}</h1></div><button type="button" className={ui.save} aria-pressed={favorites.includes(selected)} onClick={() => favorite(selected)}><Bookmark size={16} fill={favorites.includes(selected) ? 'currentColor' : 'none'}/>{favorites.includes(selected) ? '후보에 담김' : '후보에 담기'}</button></div>
        <div className={ui.focusGrid}><section className={`${ui.stage} ${phone ? ui.phone : ''}`} aria-label={`01-${String(selected).padStart(2,'0')} ${item.name} 미리보기`}>
          <div className={ui.stageInner} key={`${selected}-${revision}`}>
            {scenario === 'error' ? <div className={`${ui.errorPreview} ${motion.error}`}><Signature variant={selected}/><h2>연결을 확인해주세요</h2><p>연결이 원활하지 않아요.</p><button type="button" onClick={() => { setScenario('normal'); restart(); }}>다시 연결하기</button></div>
              : <><div className={ui.art}><Signature variant={selected}/></div><p className={ui.caption} role="status">{slow ? '조금 늦어지고 있어요' : '불러오는 중'}</p>{slow && <button type="button" className={ui.retryPreview} onClick={() => {setScenario('normal');restart();}}>다시 시도 <RotateCcw size={11}/></button>}</>}
          </div><span className={ui.stageLabel}>디자인 미리보기 · 실제 접속 대기 아님</span>
        </section><aside className={ui.notes}><span className={ui.category}>{item.kind}</span><h2>{item.name}</h2><p>{item.detail}</p><div className={ui.why}><span>이 안의 인상</span><p>{item.why}</p></div><div className={ui.scenarios}><span>상태 비교</span>{([['normal','접속 중'],['slow','느린 연결'],['error','연결 실패']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={scenario === value} onClick={() => {setScenario(value);restart();}}>{scenario === value && <Check size={12}/>} {label}</button>)}</div><button type="button" className={ui.replay} onClick={restart}><RotateCcw size={13}/>처음부터 보기 <span>{elapsed}초</span></button><p className={ui.note}>로고 형태와 붉은색은 공통입니다. 준비가 끝나면 모션 도중에도 바로 본 화면으로 이어집니다.</p></aside></div>
        <div className={ui.quick}><span>추천 비교</span>{recommended.map(n => <button type="button" key={n} aria-pressed={n === selected} onClick={() => choose(n)}>01-{String(n).padStart(2,'0')} {variants[n-1].name}</button>)}</div>
      </> : <section className={ui.overview}>
        <div className={ui.overviewHeading}><div><span className={ui.eyebrow}>ONE SIGNATURE / TEN EXPRESSIONS</span><h1>{mode === 'favorites' ? '담아둔 변형' : '1번에서 출발한 10개의 서명'}</h1><p className={motion.intro}>같은 붉은 선, 같은 주비. 선의 움직임과 배치를 비교해보세요.</p></div><Link className={motion.originalLink} href="/brand-preview/loading">원래 20개 보기 <ArrowRight size={13}/></Link></div>
        {shown.length === 0 ? <div className={ui.empty}><Bookmark/><p>마음에 드는 변형을 후보에 담아보세요.</p><button type="button" onClick={() => changeMode('all')}>전체 10개 보기</button></div> : <div className={ui.cards}>{shown.map(n => <article className={ui.card} key={n}>
          <button type="button" className={ui.cardOpen} aria-label={`01-${String(n).padStart(2,'0')} ${variants[n-1].name} 크게 보기`} onClick={() => choose(n)}><div className={ui.thumb}><div className={ui.thumbArt} key={`${n}-${revision}`}><Signature variant={n}/></div></div><div className={ui.cardText}><span>01-{String(n).padStart(2,'0')}</span><strong>{variants[n-1].name}</strong>{recommended.includes(n) && <small>추천</small>}</div><p className={motion.cardKind}>{variants[n-1].kind}</p></button>
          <button type="button" className={ui.cardSave} aria-label={`01-${String(n).padStart(2,'0')} ${favorites.includes(n) ? '후보에서 빼기' : '후보에 담기'}`} aria-pressed={favorites.includes(n)} onClick={() => favorite(n)}><Bookmark size={16} fill={favorites.includes(n) ? 'currentColor' : 'none'}/></button>
        </article>)}</div>}
      </section>}
      <footer className={ui.footer}><span>JOOBI / SIGNATURE STUDIES</span><span>로컬 비교용 시안 · 선택해도 운영 화면은 바뀌지 않습니다.</span></footer>
    </div>
  </main>;
}
