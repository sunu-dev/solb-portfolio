'use client';

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, CircleHelp, FileText, Moon, Pause, Play, RotateCcw, Search, Smartphone, Sun } from 'lucide-react';
import styles from './loading.module.css';

const designs = [
  ['시그니처', '브랜드', '붉은 선 하나가 주비의 표정이 돼요.', '로고를 짧게 그린 뒤 완성된 모습에서 숨을 고릅니다.', '짧은 접속에 가장 잘 맞는 기본안.'],
  ['오비트', '브랜드', '주비를 중심으로, 작은 움직임.', '한 점이 로고 주위를 느리게 돕니다. 회전의 속도를 일정하게 유지합니다.', '조용하지만 멈춘 화면처럼 보이지 않음.'],
  ['점의 합류', '브랜드', '흩어진 점들이 한곳에 모입니다.', '세 점이 모였다가 다시 벌어집니다. 로고는 같은 자리를 지킵니다.', '브랜드의 연결이라는 성격을 표현.'],
  ['작은 리듬', '추상 모션', '기다림에 가벼운 박자를 더합니다.', '길이가 다른 다섯 막대가 파도처럼 움직입니다.', '작은 공간에서도 존재감이 분명함.'],
  ['주비의 노트', '비서의 도구', '한 장을 펼쳐, 살펴볼 준비.', '작은 노트의 페이지가 넘어가고 주비의 붉은 책갈피가 남습니다.', '주식비서의 성격과 모션의 재미가 균형을 이룸.'],
  ['정리하는 카드', '비서의 도구', '흩어진 내용을 가지런하게.', '기울어진 카드 세 장이 순서대로 포개집니다.', '준비한다는 행동을 문장 없이 전달.'],
  ['이어지는 별', '추상 모션', '점과 점 사이에 흐름이 생깁니다.', '가느다란 선이 작은 별들을 연결합니다. 빛나는 점이 이어집니다.', '차분하면서 조금 더 감성적인 방향.'],
  ['초점', '추상 모션', '네 방향의 조각이 초점을 맞춥니다.', '모서리 네 조각이 로고 쪽으로 가까워졌다 멀어집니다.', '편집된 제품 같은 정돈된 인상.'],
  ['고요한 호흡', '브랜드', '부드럽게, 주비.', '따뜻한 원이 아주 천천히 커졌다 작아집니다.', '오래 보아도 피로가 적은 차분한 추천안.'],
  ['먼저 펼친 화면', '화면 먼저', '빈 화면 대신, 도착할 곳을 먼저.', '내 주식·최근 소식의 뼈대가 같은 위치에 먼저 나타납니다.', '실제 화면으로 넘어갈 때 가장 자연스러움.'],
  ['타이포 루프', '실험', '주비라는 두 글자에 리듬을.', '조금씩 어긋난 두 글자가 맞물렸다 다시 돌아옵니다.', '타이포그래피가 주인공인 선명한 방향.'],
  ['연결의 순서', '추상 모션', '서로 다른 정보가 이어집니다.', '세 개의 작은 원 사이로 붉은 빛이 흐릅니다.', '단순한 점 로딩보다 의미가 분명함.'],
  ['잔잔한 물결', '추상 모션', '부드러운 선이 흐릅니다.', '두 개의 곡선이 서로 다른 박자로 지나갑니다.', '복잡한 차트 없이 흐름을 표현.'],
  ['붉은 궤적', '브랜드', '길을 따라 움직이는 작은 점.', '닫힌 곡선 위를 한 점이 따라갑니다. 끝나는 척하는 진행률은 없어요.', '형태와 움직임이 기억에 남는 방향.'],
  ['모이는 조각', '실험', '네 조각이 하나의 장면으로.', '모서리가 다른 조각들이 제자리로 들어와 형태를 만듭니다.', '그래픽 성격이 강한 선택지.'],
  ['열리는 창', '화면 먼저', '주비의 창이 천천히 열립니다.', '겹쳐진 창 두 장 사이에서 로고가 나타납니다.', '첫 화면으로 이어지는 공간감.'],
  ['잠깐의 읽을거리', '기다리는 동안', '짧게 읽고, 바로 시작.', '대기가 길어질 때만 주비를 쓰는 작은 방법을 한 장씩 보여줍니다.', '5초 이상 대기에 추천. 읽느라 접속을 늦추지 않음.'],
  ['비서의 책상', '비서의 도구', '노트와 소식이 책상 위로.', '노트·소식·돋보기가 차례로 놓이는 작은 일러스트입니다.', '비서라는 서비스 성격을 가장 직접적으로 표현.'],
  ['한눈에 연결', '기다리는 동안', '가격, 소식, 내 주식이 만나는 곳.', '세 장의 단어 카드가 모여 한 묶음이 돼요.', '기능을 설명하는 긴 문장 없이 서비스 소개.'],
  ['작은 동행', '작은 상호작용', '기다리는 동안 눈을 맞춥니다.', '작은 도형이 눈을 깜빡입니다. 누르면 한 번 고개를 기울입니다.', '친근한 실험안. 캐릭터 채택 시 별도 브랜드 검토.'],
] as const;
const recommended = [1, 5, 9, 10, 17];
const favoriteKey = 'joobi-loading-design-favorites-v1';
const emptyFavorites: number[] = [];
let cachedFavorites: number[] = emptyFavorites;
let cachedRaw: string | null = null;
let memoryOnly = false;
const favoriteListeners = new Set<() => void>();
function readFavorites() {
  if (memoryOnly) return cachedFavorites;
  try {
    const raw = localStorage.getItem(favoriteKey);
    if (raw !== cachedRaw) {
      const parsed: unknown = JSON.parse(raw ?? '[]');
      cachedFavorites = Array.isArray(parsed) ? [...new Set(parsed.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 20))] : emptyFavorites;
      cachedRaw = raw;
    }
  } catch { memoryOnly = true; }
  return cachedFavorites;
}
function subscribeFavorites(listener: () => void) {
  favoriteListeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === favoriteKey || event.key === null) listener(); };
  window.addEventListener('storage', onStorage);
  return () => { favoriteListeners.delete(listener); window.removeEventListener('storage', onStorage); };
}
function toggleFavorite(n: number) {
  const current = readFavorites();
  cachedFavorites = current.includes(n) ? current.filter(x => x !== n) : [...current, n].sort((a,b) => a-b);
  cachedRaw = JSON.stringify(cachedFavorites);
  try { localStorage.setItem(favoriteKey, cachedRaw); } catch { memoryOnly = true; }
  favoriteListeners.forEach(listener => listener());
}
const tips = [
  ['종목 이름이 길다면', '애플처럼 회사 이름으로도 검색할 수 있어요.'],
  ['다시 찾는 종목은', '검색창 아래의 최근 검색에서 바로 열 수 있어요.'],
  ['소식부터 살펴보려면', '종목 상세의 차트 아래에서 최근 소식을 볼 수 있어요.'],
];
const refs = [
  { name: 'Google', kind: '브랜드 모션', copy: '로고의 점을 움직여 듣기·생각하기·응답을 표현한 공식 디자인 사례.', take: '01·02·03·14에 반영', url: 'https://design.google/library/evolving-google-identity' },
  { name: 'Shopify', kind: '실제 로딩 경험', copy: '제목과 화면 골격을 먼저 보여주고, 데이터가 도착해도 배치를 안정적으로 유지.', take: '10·16에 반영', url: 'https://shopify.engineering/improve-ui-performance-understanding-your-user' },
  { name: 'Canva', kind: '앱 디자인 지침', copy: '불러올 내용을 짐작할 수 있는 자리표시자를 권장. 짧은 대기와 긴 대기를 구분.', take: '10과 대기 상태에 반영', url: 'https://www.canva.dev/docs/apps/design-guidelines/loading/' },
  { name: 'Slack', kind: '과거 사례 · 현재 제거', copy: '접속이 빨라져 읽을 시간이 없어진 로딩 메시지를 제거했다고 공식 기록에 설명.', take: '17은 긴 대기에서만 표시', url: 'https://slack.com/help/articles/115004846068-Slack-updates-and-changes/' },
  { name: 'Netflix', kind: '로딩과 구분되는 브랜드 인트로', copy: '오리지널 작품 시작의 짧은 로고 시퀀스. 접속 로딩의 직접 사례는 아님.', take: '01·11의 짧은 첫인상 참고', url: 'https://about.netflix.com/en/news/your-new-netflix-ident-animation-cue-netflix-sound' },
];

function Mark({ className = '' }: { className?: string }) {
  return <svg className={`${styles.mark} ${className}`} viewBox="0 0 40 40" aria-hidden="true"><path d="M7 31 15 20 22 24 33 10" pathLength="1"/><circle cx="33" cy="10" r="3.2"/></svg>;
}
function Wordmark({ mark = true }: { mark?: boolean }) {
  return <div className={styles.wordmark}>{mark && <Mark />}<span>주비</span></div>;
}
function Lines() { return <div className={styles.lines}><i/><i/><i/></div>; }
function Art({ id, elapsed = 0, mini = false }: { id: number; elapsed?: number; mini?: boolean }) {
  const [nod, setNod] = useState(false);
  const tip = tips[Math.floor(Math.max(0, elapsed - 5) / 5) % tips.length];
  const commonBrand = <div className={styles.belowBrand}><Wordmark mark={false}/></div>;
  switch (id) {
    case 1: return <div className={styles.signature}><Wordmark/><div className={styles.signatureLine}/></div>;
    case 2: return <><div className={styles.orbit}><div className={styles.orbitTrack}/><Mark/></div>{commonBrand}</>;
    case 3: return <><div className={styles.mergeDots}><i/><i/><i/></div><Wordmark mark={false}/></>;
    case 4: return <><div className={styles.rhythm}>{[0,1,2,3,4].map(n=><i key={n} style={{'--n':n} as CSSProperties}/>)}</div>{commonBrand}</>;
    case 5: return <><div className={styles.notebook}><div className={styles.noteBack}/><div className={styles.notePage}><Mark/><Lines/></div><div className={styles.turningPage}/><i className={styles.bookmark}/></div>{commonBrand}</>;
    case 6: return <><div className={styles.stack}>{[0,1,2].map(n=><div key={n} style={{'--n':n} as CSSProperties}><Mark/><Lines/></div>)}</div>{commonBrand}</>;
    case 7: return <><svg className={styles.constellation} viewBox="0 0 240 130" aria-hidden="true"><path d="M25 85 65 35 118 76 164 26 212 65"/>{[[25,85],[65,35],[118,76],[164,26],[212,65]].map(([x,y],n)=><circle key={x} cx={x} cy={y} r={n===2?6:3} style={{'--n':n} as CSSProperties}/>)}</svg>{commonBrand}</>;
    case 8: return <><div className={styles.focus}><i/><i/><i/><i/><Mark/></div>{commonBrand}</>;
    case 9: return <><div className={styles.breath}><div/><div/><Wordmark/></div></>;
    case 10: return <div className={styles.appSkeleton}><header><Wordmark/><Search size={16}/></header><div className={styles.skeletonTitle}>내 주식</div><div className={styles.skeletonCards}><i/><i/><i/></div><div className={styles.skeletonTitle}>최근 소식</div><div className={styles.skeletonRows}><Lines/><Lines/></div></div>;
    case 11: return <div className={styles.kinetic}><div><span>주</span><span>비</span></div><i/><small>내 주식 비서</small></div>;
    case 12: return <><div className={styles.nodes}><i/><b/><i/><b/><i/></div>{commonBrand}</>;
    case 13: return <><svg className={styles.waves} viewBox="0 0 280 100" aria-hidden="true"><path d="M-140 50 Q-105 8 -70 50 T0 50 T70 50 T140 50 T210 50 T280 50 T350 50 T420 50"/><path d="M-140 58 Q-105 90 -70 58 T0 58 T70 58 T140 58 T210 58 T280 58 T350 58 T420 58"/></svg>{commonBrand}</>;
    case 14: return <><div className={styles.trail}><svg viewBox="0 0 180 140" aria-hidden="true"><path d="M90 20 C170 20 165 120 90 120 C15 120 10 20 90 20Z"/></svg><i/><Mark/></div>{commonBrand}</>;
    case 15: return <><div className={styles.mosaic}>{[0,1,2,3].map(n=><i key={n} style={{'--n':n} as CSSProperties}/>)}</div>{commonBrand}</>;
    case 16: return <><div className={styles.windowArt}><div/><div/><Wordmark/></div></>;
    case 17: return <div className={styles.reading}><Wordmark/>{elapsed>=5||mini?<div className={styles.tipCard} key={tip[0]}><span>주비 사용 메모</span><strong>{tip[0]}</strong><p>{tip[1]}</p><div className={styles.tipDots}>{tips.map(t=><i key={t[0]} data-active={t===tip} aria-hidden="true"/>)}</div></div>:<div className={styles.readingRest}><i/><i/><i/></div>}</div>;
    case 18: return <><div className={styles.desk}><div className={styles.deskPaper}><FileText/><Lines/></div><div className={styles.deskBook}><Mark/></div><div className={styles.deskGlass}><Search/></div><i/></div>{commonBrand}</>;
    case 19: return <><div className={styles.wordCards}>{['가격','소식','내 주식'].map((t,n)=><span key={t} style={{'--n':n} as CSSProperties}>{t}</span>)}</div>{commonBrand}</>;
    default: return <>{mini?<div className={styles.companion}><i/><i/><span/></div>:<button type="button" className={`${styles.companion} ${nod?styles.nodding:''}`} onClick={()=>setNod(!nod)} aria-label="작은 주비와 눈 맞추기" aria-pressed={nod}><i/><i/><span/></button>}{commonBrand}</>;
  }
}

export default function LoadingDesigns() {
  const [selected, setSelected] = useState(5);
  const [mode, setMode] = useState<'focus'|'all'|'favorites'|'research'>('all');
  const favorites = useSyncExternalStore(subscribeFavorites, readFavorites, () => emptyFavorites);
  const [paused, setPaused] = useState(false);
  const [dark, setDark] = useState(false);
  const [phone, setPhone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [revision, setRevision] = useState(0);
  const [scenario, setScenario] = useState<'normal'|'slow'|'error'>('normal');
  useEffect(()=>{if(paused || mode!=='focus' || scenario==='error')return; const timer=setInterval(()=>setElapsed(v=>Math.min(v+1,60)),1000); return()=>clearInterval(timer);},[paused,mode,scenario,revision]);
  function choose(n:number) {setSelected(n);setElapsed(0);setRevision(v=>v+1);setScenario('normal');setMode('focus');window.scrollTo({top:0,behavior:'auto'});}
  function restart(){setElapsed(0);setRevision(v=>v+1);}
  function favorite(n:number){toggleFavorite(n);}
  const item=designs[selected-1];
  const shown=mode==='favorites'?designs.map((_,n)=>n+1).filter(n=>favorites.includes(n)):designs.map((_,n)=>n+1);
  const slow=scenario==='slow'||elapsed>=8;
  return <main className={`${styles.lab} ${paused?styles.paused:''}`} data-theme={dark?'dark':'light'}>
    <header className={styles.toolbar}>
      <div className={styles.topline}><Link className={styles.labBrand} href="/"><Mark/><b>주비</b><span>접속 화면 20안</span></Link><div className={styles.tools}><button type="button" aria-label={dark?'밝은 배경':'어두운 배경'} onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button type="button" aria-label="모바일 비율" aria-pressed={phone} onClick={()=>setPhone(!phone)}><Smartphone size={17}/></button><button type="button" aria-label={paused?'모션 재생':'모션 일시정지'} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={17}/>:<Pause size={17}/>}</button></div></div>
      <div className={styles.controlLine}><div className={styles.picker}><button type="button" aria-label="이전 시안" onClick={()=>choose(selected===1?20:selected-1)}><ArrowLeft size={16}/></button><label className={styles.selectLabel}><span className={styles.srOnly}>시안 선택</span><select value={selected} onChange={e=>choose(Number(e.target.value))}>{designs.map((d,n)=><option key={d[0]} value={n+1}>{String(n+1).padStart(2,'0')}　{d[0]}{recommended.includes(n+1)?' · 추천':''}</option>)}</select></label><button type="button" aria-label="다음 시안" onClick={()=>choose(selected===20?1:selected+1)}><ArrowRight size={16}/></button></div><nav className={styles.tabs} aria-label="보기 방식">{([['focus','한 개씩'],['all','전체 20'],['favorites',`후보 ${favorites.length}`],['research','서비스 사례']] as const).map(([key,label])=><button type="button" key={key} aria-current={mode===key?'page':undefined} onClick={()=>setMode(key)}>{label}</button>)}</nav></div>
    </header>
    <div className={styles.body}>
      {mode==='focus'?<>
        <div className={styles.headline}><div><span className={styles.eyebrow}>LOADING STUDIES / {String(selected).padStart(2,'0')}</span><h1>{item[0]}{recommended.includes(selected)&&<small>추천</small>}</h1></div><button type="button" className={styles.save} aria-pressed={favorites.includes(selected)} onClick={()=>favorite(selected)}><Bookmark size={16} fill={favorites.includes(selected)?'currentColor':'none'}/>{favorites.includes(selected)?'후보에 담김':'후보에 담기'}</button></div>
        <div className={styles.focusGrid}><section className={`${styles.stage} ${phone?styles.phone:''}`} aria-label={`${selected}번 ${item[0]} 움직이는 시안`}>
          <div className={styles.stageInner} data-design={selected} key={`${selected}-${revision}`}>
            {scenario==='error'?<div className={styles.errorPreview}><Wordmark/><CircleHelp size={24}/><h2>연결을 확인해주세요</h2><p>연결이 원활하지 않아요.</p><button type="button" onClick={()=>{setScenario('normal');restart();}}>다시 연결하기</button></div>:<><div className={styles.art}><Art id={selected} elapsed={scenario==='slow'?Math.max(elapsed,8):elapsed}/></div><div className={styles.caption} role="status"><span className={styles.captionDot}/>{slow?'조금 늦어지고 있어요':'불러오는 중'}</div>{slow&&<button type="button" className={styles.retryPreview} onClick={restart}>다시 시도 <RotateCcw size={11}/></button>}</>}
          </div>
          <div className={styles.stageLabel}>움직이는 시안 · 실제 접속 대기 아님</div>
        </section><aside className={styles.notes}><span className={styles.category}>{item[1]}</span><h2>{item[2]}</h2><p>{item[3]}</p><div className={styles.why}><span>선택할 이유</span><p>{item[4]}</p></div><div className={styles.scenarios}><span>상태 비교</span>{([['normal','접속 중'],['slow','느린 연결'],['error','연결 실패']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={scenario===value} onClick={()=>{setScenario(value);restart();}}>{scenario===value&&<Check size={12}/>} {label}</button>)}</div><button type="button" className={styles.replay} onClick={restart}><RotateCcw size={13}/>처음부터 보기 <span>{elapsed}초</span></button><p className={styles.note}>준비가 끝나면 모션이 끝나기를 기다리지 않고 바로 화면을 엽니다. 진행률·시세·완료 단계를 꾸며내지 않습니다.</p></aside></div>
        <div className={styles.quick}><span>먼저 비교할 추천안</span>{recommended.map(n=><button type="button" key={n} aria-pressed={selected===n} onClick={()=>choose(n)}>{String(n).padStart(2,'0')} {designs[n-1][0]}</button>)}</div>
      </>:mode==='research'?<section className={styles.research}><span className={styles.eyebrow}>REFERENCE NOTES / 2026.10.18</span><h1>기다림을 다루는 방법</h1><p className={styles.intro}>공식 자료를 기준으로 정리했어요. 현재의 모든 앱 버전을 직접 촬영한 비교는 아니에요. 접속 로딩·브랜드 인트로·디자인 지침을 구분했어요.</p><div className={styles.referenceGrid}>{refs.map(ref=><a key={ref.name} href={ref.url} target="_blank" rel="noreferrer"><span>{ref.kind}<ArrowUpRight size={16}/></span><h2>{ref.name}</h2><p>{ref.copy}</p><small>{ref.take}</small></a>)}</div><div className={styles.finding}><b>주비에 적용할 방향</b><p>짧으면 로고만. 길어지면 작은 읽을거리. 준비가 끝나면 즉시 본 화면으로.</p><p>03의 작은 점 모션, 05의 노트, 10의 화면 골격, 17의 긴 대기용 메모를 우선 비교합니다.</p></div></section>:<section className={styles.overview}><div className={styles.overviewHeading}><div><span className={styles.eyebrow}>{mode==='favorites'?'YOUR SHORTLIST':'TWENTY DIRECTIONS'}</span><h1>{mode==='favorites'?'담아둔 후보':'20개의 접속 경험'}</h1></div><Link href="/brand-preview/loading/signature" className={styles.seriesLink}>1번 변형 10개 보기 →</Link></div>{shown.length===0?<div className={styles.empty}><Bookmark/><p>마음에 드는 시안에서 ‘후보에 담기’를 누르세요.</p><button type="button" onClick={()=>setMode('all')}>전체 20개 보기</button></div>:<div className={styles.cards}>{shown.map(n=><article key={n} className={styles.card}><button type="button" className={styles.cardOpen} onClick={()=>choose(n)} aria-label={`${n}번 ${designs[n-1][0]} 크게 보기`}><div className={styles.thumb} data-design={n}><div className={styles.thumbArt}><Art id={n} mini/></div></div><div className={styles.cardText}><span>{String(n).padStart(2,'0')}</span><strong>{designs[n-1][0]}</strong>{recommended.includes(n)&&<small>추천</small>}</div><p>{designs[n-1][1]}</p></button><button type="button" className={styles.cardSave} aria-label={`${n}번 ${favorites.includes(n)?'후보에서 빼기':'후보에 담기'}`} aria-pressed={favorites.includes(n)} onClick={()=>favorite(n)}><Bookmark size={16} fill={favorites.includes(n)?'currentColor':'none'}/></button></article>)}</div>}</section>}
      <footer className={styles.footer}><span>JOOBI / MOTION & WAITING</span><span>시안 선택은 운영 화면을 변경하지 않습니다.</span>{favorites.length>0&&<button type="button" onClick={()=>setMode('favorites')}>내 후보 {favorites.join(' · ')} <ArrowRight size={12}/></button>}</footer>
    </div>
  </main>;
}
