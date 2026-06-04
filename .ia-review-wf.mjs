export const meta = {
  name: 'joobi-ia-menu-review-16',
  description: '주비 IA·메뉴 리뷰 — 코드 기능 인벤토리 + 경쟁사 IA → 16인 패널 → 제안 IA',
  phases: [
    { title: 'Ground', detail: '기능 인벤토리 5 + 경쟁사 IA 웹 3' },
    { title: 'Panel', detail: '16인 패널' },
    { title: 'Spec', detail: '인벤토리·메뉴 판정·배치·제안 IA' },
  ],
}

const CTX = [
  '[안건] 주비 = 한국 개인투자자용 AI 주식 관리·정보 PWA. 기능이 많아 토스·카카오 증권처럼 메뉴/탐색이 필요한지, 각 기능이 적절한 탭에 있는지 정보구조(IA) 전면 리뷰.',
  '[현재 IA] 하단 4탭+더보기: 포트폴리오 / AI 인사이트 / 뉴스 / 이벤트 / 더보기. 포트폴리오 탭에 카드 10+겹 적층(Dashboard·MorningBriefing·BrokerSummary·MergedHoldings·세무계산기·보유테이블[서브탭 종목/분석]·시각화·챕터·StockPulse 등). AI 인사이트 탭(AI촉·이야기·투자성향·코호트). 이벤트·뉴스 탭. 모달/이벤트로만 열리는 숨은 기능(OCR·검색·알림센터·챕터책장·Wrapped·세무).',
  '[생존 패널 지적] 포트폴리오 첫 화면 7~8겹 적층 — 보유 테이블이 8번째 묻힘.',
  '[제약] 토스/카카오뱅크풍 미니멀. 손익색(이익 빨강·손실 파랑) 보존. 정체성: 매매·추천 아닌 본인 주식 관리·정보(방향0). PC·모바일 양쪽.',
  '[3대 질문] Q1 전체 기능 인벤토리(무슨 기능·어느 위치). Q2 메뉴 필요한가(아니면 기능 정리·통합·제거). Q3 각 기능이 적절한 페이지에 있나(오배치·통합·숨김).',
  '[태도] 추측 금지(인벤토리는 코드 근거). 기능 과밀·동선 매몰·발견성 가차없이. 메뉴 추가가 만능 아님.',
].join('\n')

const INV_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['area', 'features'],
  properties: {
    area: { type: 'string' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'whatItDoes', 'location', 'discoverability'],
        properties: {
          name: { type: 'string' },
          whatItDoes: { type: 'string' },
          location: { type: 'string' },
          discoverability: { type: 'string', enum: ['clear', 'buried', 'hidden'] },
        },
      },
    },
  },
}

const COMP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['topic', 'findings', 'takeaway'],
  properties: {
    topic: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    takeaway: { type: 'string' },
  },
}

const GROUND = [
  { key: 'inv-portfolio', kind: 'Explore', schema: INV_SCHEMA, q: '포트폴리오 탭(PortfolioSection + 서브탭 종목/분석 + 모든 카드·위젯) 기능을 실제 코드로 빠짐없이 추출. 위치·발견성. src/components/portfolio 정독.' },
  { key: 'inv-insights', kind: 'Explore', schema: INV_SCHEMA, q: 'AI 인사이트 탭(InsightsSection: AI촉·이야기·투자성향·코호트·숨은종목) 기능 전수. src/components/insights 정독.' },
  { key: 'inv-events-news', kind: 'Explore', schema: INV_SCHEMA, q: '이벤트 탭·뉴스 탭·시장 컨텍스트 바 기능 추출. src/components/events·news·layout 정독.' },
  { key: 'inv-nav', kind: 'Explore', schema: INV_SCHEMA, q: '네비·메뉴·설정·헤더: MobileNav(4탭+더보기), 더보기 클릭 시 열리는 것, RightSidebar, SettingsPanel, Header, /help. src/components/layout·common 정독.' },
  { key: 'inv-hidden', kind: 'Explore', schema: INV_SCHEMA, q: '숨은 기능 — 모달·window CustomEvent로만 열려 탭/메뉴에 없는 기능(OCR·검색·알림센터·챕터책장·Wrapped·세무·종목분석). grep CustomEvent·Modal·setShow. 발견성 평가.' },
  { key: 'comp-toss', kind: 'web', schema: COMP_SCHEMA, q: '토스증권·카카오페이증권 IA/네비/메뉴 — 하단탭 구성, 전체/메뉴 햄버거 유무, 기능 그룹핑·계층. WebSearch.' },
  { key: 'comp-kr', kind: 'web', schema: COMP_SCHEMA, q: '미래에셋·키움 + 뱅크샐러드 IA — 기능 많은 앱의 전체 메뉴 관행, 탭 vs 메뉴, 자산 대시보드. WebSearch.' },
  { key: 'comp-global', kind: 'web', schema: COMP_SCHEMA, q: 'Robinhood + Public·Webull IA — 탭 구조·발견성·메뉴 패턴. 미니멀 앱의 기능 수납법. WebSearch.' },
]

phase('Ground')
const ground = (await parallel(GROUND.map(g => () => agent(
  CTX + '\n\n[임무] ' + g.q + '\nStructuredOutput 필수.',
  g.kind === 'Explore'
    ? { label: g.key, phase: 'Ground', schema: g.schema, agentType: 'Explore' }
    : { label: g.key, phase: 'Ground', schema: g.schema },
)))).filter(Boolean)

const invDigest = ground.filter(r => r.features).map(r => {
  const lines = r.features.map(f => '- ' + f.name + ' [' + f.discoverability + '] @' + f.location + ' — ' + f.whatItDoes).join('\n')
  return '## ' + r.area + '\n' + lines
}).join('\n\n')

const compDigest = ground.filter(r => r.findings).map(r => {
  const lines = r.findings.map(x => '- ' + x).join('\n')
  return '## ' + r.topic + '\n' + lines + '\n=> 차용: ' + r.takeaway
}).join('\n\n')

const PANEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lens', 'menuVerdict', 'oneLineVerdict'],
  properties: {
    lens: { type: 'string' },
    menuVerdict: { type: 'string', enum: ['menu', 'cleanup', 'both', 'keep'] },
    topMisplacements: { type: 'array', items: { type: 'string' } },
    topRecommendations: { type: 'array', items: { type: 'string' } },
    oneLineVerdict: { type: 'string' },
  },
}

const LENSES = [
  { key: 'persona-new', lens: '신규 사용자(기능 발견성)', focus: '내 주식 관리·AI촉·세금을 못 찾고 헤매는 지점. 위치 예측 가능성.' },
  { key: 'persona-power', lens: '파워 유저(빠른 재접근)', focus: '매일 쓰는 기능에 몇 탭/스크롤 만에 닿나. 자주 쓰는 게 묻혔나.' },
  { key: 'persona-toss', lens: '토스/증권사 헤비유저', focus: '익숙한 IA(하단탭+전체메뉴) 기대 대비 어색함. 메뉴 부재로 못 찾나.' },
  { key: 'persona-novice', lens: '주식 초보', focus: '카드 10겹 적층 과부하. 뭘 먼저 볼지 모름. 핵심만 남기고 나머지는 메뉴로?' },
  { key: 'ia', lens: '정보구조 설계자', focus: '4탭+더보기가 기능 수에 맞나. 탭 그룹핑 논리·계층 깊이. 적층 vs 진입점 분리.' },
  { key: 'nav', lens: '네비게이션 패턴 전문가', focus: '하단탭 vs 햄버거/전체메뉴 vs 진입카드. 전체 메뉴가 맞나 탭 재구성이 맞나. 모달-only 진입점.' },
  { key: 'cogload', lens: '인지부하·정보 scent', focus: '적층 인지부하. 라벨이 기능을 예측하게 하나. 스캔 가능성.' },
  { key: 'mobile', lens: '모바일 UX', focus: '탭 깊이·스크롤·엄지 도달. 하단탭 5개 적정? 무한스크롤 문제.' },
  { key: 'discovery', lens: '온보딩·발견성', focus: '모달/이벤트로만 열리는 숨은 기능을 존재조차 모름. 발견 경로.' },
  { key: 'consistency', lens: '일관성·디자인시스템', focus: '탭마다 다른 레이아웃·카드 패턴 불일치. 진입점 표현 통일.' },
  { key: 'pm', lens: 'PM·제품전략', focus: '핵심 가치(내 주식 한눈에 관리)가 IA 1순위로 드러나나. 우선순위→배치.' },
  { key: 'growth', lens: '그로스·발견성→리텐션', focus: '좋은 기능이 묻혀 안 쓰여 리텐션 죽음. 발견성↑=사용↑.' },
  { key: 'hierarchy', lens: '정보 위계', focus: '보유 종목 관리가 8번째 묻힘 — 핵심이 부차 카드에 밀림. 위계 재정렬.' },
  { key: 'comp-ia', lens: '경쟁 IA 차용', focus: '토스·카카오·미래에셋·뱅크샐러드 메뉴 구조 차용. 차별점 유지하며 익숙함.' },
  { key: 'fintech-menu', lens: '핀테크 메뉴 패턴', focus: '증권앱 메뉴/전체 탭 관행(설정·세금·이벤트·고객센터 수납). 2차 기능을 어디에.' },
  { key: 'overload', lens: '기능 과잉 비평', focus: '메뉴 추가 전 뭘 제거·통합·숨기나. 핵심 vs 노이즈. 메뉴는 기능과잉의 반창고일 수 있다.' },
]

phase('Panel')
const panel = (await parallel(LENSES.map(l => () => agent(
  CTX + '\n\n[기능 인벤토리(코드)]\n' + invDigest + '\n\n[경쟁사 IA]\n' + compDigest + '\n\n[너의 렌즈] ' + l.lens + '\n[집중] ' + l.focus + '\n\nQ1·Q2·Q3에 답하라. menuVerdict는 menu(메뉴 필요)/cleanup(기능 정리)/both/keep 중. 오배치 기능·이동 위치 구체적으로. StructuredOutput 필수.',
  { label: 'panel-' + l.key, phase: 'Panel', schema: PANEL_SCHEMA },
)))).filter(Boolean)

const tally = { menu: 0, cleanup: 0, both: 0, keep: 0 }
panel.forEach(p => { if (p.menuVerdict && tally[p.menuVerdict] != null) tally[p.menuVerdict] += 1 })
const panelDigest = panel.map(p => '[' + p.lens + '] ' + p.menuVerdict + ' | 오배치=' + ((p.topMisplacements || []).join(';') || '-') + ' | 권고=' + ((p.topRecommendations || []).join(';') || '-') + ' | ' + p.oneLineVerdict).join('\n')

phase('Spec')
const spec = await agent(
  CTX + '\n\n[기능 인벤토리]\n' + invDigest + '\n\n[경쟁사 IA]\n' + compDigest + '\n\n[16인 패널]\n' + panelDigest + '\n\n[메뉴 판정 집계 menu/cleanup/both/keep] ' + JSON.stringify(tally) + '\n\n종합해 마크다운으로:\n## Q1 전체 기능 인벤토리 (탭/위치별 표)\n## Q2 메뉴 필요한가 (판정+근거 — 메뉴 vs 기능정리 vs 둘 다)\n## Q3 배치 적절성 (오배치/묻힌 기능 + 이동·통합·숨김)\n## 제안 IA (탭 재구성/메뉴 구조 구체적으로, 토스·카카오 차용점)\n## 우선순위 (P0/P1/P2)\n## 구현 메모 (어느 컴포넌트를 어떻게)\n최종 답을 마크다운 텍스트로 직접(도구 호출 말고).',
  { label: 'spec', phase: 'Spec' },
)

return {
  inventory: ground.filter(r => r.features).map(r => ({ area: r.area, count: r.features.length })),
  menuTally: tally,
  panelVerdicts: panel.map(p => ({ lens: p.lens, menu: p.menuVerdict, verdict: p.oneLineVerdict })),
  spec,
}
