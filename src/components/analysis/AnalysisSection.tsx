'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, ScanSearch, ChartNoAxesCombined, NotebookPen } from 'lucide-react';
import styles from './AnalysisSection.module.css';

const loading = () => <p role="status" className={styles.hint}>자료를 불러오고 있어요…</p>;
const AiChok = dynamic(() => import('@/components/portfolio/AiChokSection'), { loading });
const MarketMovers = dynamic(() => import('@/components/portfolio/MarketMovers'), { loading });
const Cohort = dynamic(() => import('@/components/portfolio/CohortReference'), { loading });
const Macro = dynamic(() => import('@/components/insights/MacroRateCard'), { loading });
const Profile = dynamic(() => import('@/components/insights/InvestorProfile'), { loading });
const DNA = dynamic(() => import('@/components/portfolio/PortfolioDNA'), { loading });
const Pulse = dynamic(() => import('@/components/portfolio/StockPulse'), { loading });
const Journal = dynamic(() => import('@/components/portfolio/InvestmentJournal'), { loading });
const Pattern = dynamic(() => import('@/components/portfolio/TradePatternMirror'), { loading });
const Throwback = dynamic(() => import('@/components/portfolio/ThrowbackCard'), { loading });
const Events = dynamic(() => import('@/components/events/EventsSection'), { loading });
const Share = dynamic(() => import('@/components/portfolio/ShareCard'), { loading });

const groups = [
  { id: 'discover', title: '종목 찾기', description: '시장 흐름 속에서 관심 가는 종목을 찾아보세요.', Icon: ScanSearch },
  { id: 'check', title: '내 투자 점검', description: '내 투자 성향과 보유 종목의 특징을 살펴보세요.', Icon: ChartNoAxesCombined },
  { id: 'records', title: '기록 돌아보기', description: '지난 판단을 되짚고, 과거 시장과 비교해보세요.', Icon: NotebookPen },
] as const;
type Group = typeof groups[number]['id'];
const tools = [
  { id: 'chok', group: 'discover', title: '오늘의 종목 발견', description: '시장 흐름과 관찰할 종목의 근거' },
  { id: 'movers', group: 'discover', title: '시장 움직임', description: '지금 움직임이 큰 종목 살펴보기' },
  { id: 'cohort', group: 'discover', title: '투자 성향별 종목', description: '내 성향과 함께 살펴볼 종목' },
  { id: 'macro', group: 'discover', title: '금리와 시장 지표', description: '시장 숫자를 이해하는 데 필요한 설명' },
  { id: 'profile', group: 'check', title: '내 투자 성향', description: '투자 유형 확인과 다시 알아보기' },
  { id: 'dna', group: 'check', title: '포트폴리오 특징', description: '보유 종목으로 보는 나의 투자 모습' },
  { id: 'pulse', group: 'check', title: '종목 흐름 점검', description: '보유 종목의 최근 가격 흐름' },
  { id: 'journal', group: 'records', title: '투자 일기', description: '종목에 남긴 메모를 날짜별로 모아보기' },
  { id: 'pattern', group: 'records', title: '나의 투자 패턴', description: '기록에 남은 판단과 결과 돌아보기' },
  { id: 'throwback', group: 'records', title: '지난 투자 돌아보기', description: '보유 종목의 과거 가격과 지금 비교' },
  { id: 'events', group: 'records', title: '과거 시장과 비교', description: '시장 이벤트 당시 내 종목의 움직임' },
  { id: 'share', group: 'records', title: '포트폴리오 카드', description: '내 투자 현황을 카드로 만들기' },
] as const;
type Tool = typeof tools[number]['id'];

export default function AnalysisSection() {
  const params = useSearchParams();
  const selected = tools.find(item => item.id === params.get('tool'));
  const tool = selected?.id ?? null;
  const group = selected?.group ?? groups.find(item => item.id === params.get('group'))?.id ?? null;
  const heading = useRef<HTMLHeadingElement>(null);
  const category = groups.find(item => item.id === group);
  const focusHeading = () => requestAnimationFrame(() => heading.current?.focus());
  const navigate = (nextGroup: Group | null, nextTool: Tool | null = null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'events');
    if (nextGroup) url.searchParams.set('group', nextGroup); else url.searchParams.delete('group');
    if (nextTool) url.searchParams.set('tool', nextTool); else url.searchParams.delete('tool');
    window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
    focusHeading();
  };
  const chooseGroup = (value: Group) => navigate(value);
  const chooseTool = (value: Tool) => navigate(tools.find(item => item.id === value)!.group, value);
  const openProfile = () => chooseTool('profile');

  return <div className={styles.root}>
    {(group || tool) && <button className={styles.back} onClick={() => {
      navigate(tool ? group : null);
    }}><ArrowLeft size={18} aria-hidden="true" />{tool ? category?.title : '분석 홈'}</button>}
    <header className={styles.header}>
      {!selected && <p className={styles.eyebrow}>필요할 때, 하나씩</p>}
      <h1 ref={heading} tabIndex={-1}>{selected?.title || category?.title || '분석'}</h1>
      <p>{selected?.description || category?.description || '오늘 궁금한 것부터 골라보세요.'}</p>
    </header>

    {!group && <div className={styles.groups} data-tour="analysis-hub">
      {groups.map(({ id, title, description, Icon }) => <button key={id} className={styles.group} onClick={() => chooseGroup(id)}>
        <span className={styles.icon}><Icon size={23} strokeWidth={1.75} aria-hidden="true" /></span>
        <span className={styles.copy}><strong>{title}</strong><span>{description}</span></span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>)}
    </div>}

    {group && !tool && <div className={styles.tools}>
      {tools.filter(item => item.group === group).map(item => <button className={styles.tool} key={item.id} onClick={() => chooseTool(item.id)}>
        <span className={styles.copy}><strong>{item.title}</strong><span>{item.description}</span></span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>)}
    </div>}

    {tool && <section aria-label={selected?.title}>
      <div className={styles.toolBody}>
        {tool === 'chok' && <AiChok />}
        {tool === 'movers' && <MarketMovers />}
        {tool === 'cohort' && <Cohort onStartQuiz={openProfile} />}
        {tool === 'macro' && <Macro />}
        {tool === 'profile' && <Profile />}
        {tool === 'dna' && <DNA />}
        {tool === 'pulse' && <Pulse />}
        {tool === 'journal' && <Journal />}
        {tool === 'pattern' && <Pattern />}
        {tool === 'throwback' && <Throwback />}
        {tool === 'events' && <Events embedded />}
        {tool === 'share' && <Share />}
      </div>
      <p className={styles.empty} role="status">{tool === 'journal' || tool === 'pattern'
        ? '아직 살펴볼 기록이 없어요. 내 주식에서 종목에 메모를 남기면 여기에서 돌아볼 수 있어요.'
        : tool === 'movers' || tool === 'macro'
          ? '표시할 시장 자료가 아직 준비되지 않았어요. 잠시 후 다시 열어주세요.'
          : '아직 분석할 자료가 충분하지 않아요. 보유 종목과 시세가 준비되면 여기에서 확인할 수 있어요.'}</p>
    </section>}
  </div>;
}
