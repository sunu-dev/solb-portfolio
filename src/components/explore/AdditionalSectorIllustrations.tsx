import type { ReactNode } from 'react';
import type { SectorId } from '@/lib/sectorExploration';

const wash = { fill: 'currentColor', fillOpacity: 0.055 };
const shade = { fill: 'currentColor', fillOpacity: 0.12 };
const Arrow = ({ x, y = 88 }: { x: number; y?: number }) => <path d={`M${x} ${y}h20m-5-4 5 4-5 4`} />;
const Labels = ({ children }: { children: [string, string, string] }) => <g fill="currentColor" stroke="none" fontSize="14" textAnchor="middle">
  {children.map((label, index) => <text key={label} x={[49, 141, 233][index]} y="155">{label}</text>)}
</g>;

/** Distinct business scenes; labels explain the role rather than imply stock performance. */
export const ADDITIONAL_ILLUSTRATIONS = {
  servers: {
    caption: '반도체와 부품을 서버로 구성해 고객에게 공급해요',
    label: '계산용 반도체와 부품을 서버 랙으로 조립해 기업 데이터센터에 공급하는 모습',
    art: <>
      <rect x="29" y="64" width="39" height="39" rx="3" {...wash} /><rect x="37" y="72" width="23" height="23" rx="2" />
      <path d="M36 57v7m12-7v7m12-7v7m-24 39v7m12-7v7m12-7v7M22 72h7m-7 12h7m-7 12h7m39-24h7m-7 12h7m-7 12h7" />
      <Arrow x={85} /><rect x="116" y="39" width="50" height="89" rx="4" {...wash} />
      {[51, 74, 97].map(y => <g key={y}><rect x="123" y={y} width="36" height="17" rx="2" /><path d={`M129 ${y + 8}h17m7 0h1`} /></g>)}
      <Arrow x={176} /><path d="M210 126V53h47v73Zm10-62h9v9h-9Zm18 0h9v9h-9Zm-18 21h9v9h-9Zm18 0h9v9h-9Zm-10 41v-17h12v17" {...wash} />
      <Labels>{['부품', '서버 시스템', '기업 고객']}</Labels>
    </>,
  },
  'nand-storage': {
    caption: '전원이 꺼져도 데이터를 보관하는 칩을 저장 제품에 넣어요',
    label: 'NAND 메모리 칩을 SSD 저장장치로 구성해 컴퓨터에서 사용하는 모습',
    art: <>
      <rect x="25" y="66" width="48" height="35" rx="3" {...wash} /><path d="M33 75h32m-32 9h32m-32 9h32M32 61v5m11-5v5m11-5v5m11-5v5m-33 35v5m11-5v5m11-5v5m11-5v5" />
      <Arrow x={85} /><rect x="111" y="59" width="61" height="54" rx="4" {...wash} /><rect x="121" y="70" width="18" height="19" rx="2" /><rect x="146" y="70" width="16" height="19" rx="2" /><path d="M120 101h42m-19 12v6m6-6v6" />
      <Arrow x={177} /><rect x="205" y="60" width="56" height="43" rx="3" {...wash} /><path d="m200 115 5-12h56l5 12Zm20-4h26" />
      <Labels>{['NAND 칩', 'SSD', '데이터 보관']}</Labels>
    </>,
  },
  'hdd-storage': {
    caption: '회전하는 자기 디스크에 데이터를 기록하고 읽어요',
    label: '하드디스크의 회전하는 원판과 읽기 헤드를 통해 데이터를 보관하는 모습',
    art: <>
      <rect x="22" y="53" width="68" height="73" rx="5" {...wash} /><circle cx="55" cy="87" r="24" /><circle cx="55" cy="87" r="8" />
      <path d="m78 63-22 24m22-24v-4M32 117h40" /><Arrow x={100} />
      <rect x="128" y="46" width="50" height="81" rx="4" {...wash} /><path d="M136 62h34m-34 23h34m-34 23h34m-30-42h2m-2 23h2m-2 23h2" />
      <Arrow x={185} /><path d="M218 63h42v62h-42Zm8 12h26m-26 12h26m-26 12h20m-20 12h23" {...wash} />
      <g fill="currentColor" stroke="none" fontSize="14" textAnchor="middle"><text x="56" y="155">회전 디스크</text><text x="153" y="155">저장 시스템</text><text x="239" y="155">데이터</text></g>
    </>,
  },
  networking: {
    caption: '네트워크 장비가 서버와 이용자 사이의 데이터를 전달해요',
    label: '서버들이 네트워크 스위치에 연결되고 데이터가 이용자의 컴퓨터로 전달되는 모습',
    art: <>
      <rect x="23" y="40" width="50" height="31" rx="3" {...wash} /><rect x="23" y="95" width="50" height="31" rx="3" {...wash} /><path d="M32 53h27m-27 11h12m-12 43h27m-27 11h12M73 55h14v30h26m-40 25h14V85" />
      <rect x="113" y="71" width="57" height="30" rx="4" {...wash} /><path d="M122 85h5v7h-5Zm12 0h5v7h-5Zm12 0h5v7h-5Zm12 0h5v7h-5Z" />
      <Arrow x={177} /><rect x="205" y="62" width="56" height="44" rx="3" {...wash} /><path d="M233 106v13m-16 0h32m-43-40h24m-24 10h34" />
      <Labels>{['서버', '네트워크', '이용자']}</Labels>
    </>,
  },
  'data-center-power': {
    caption: '서버에 전력을 공급하고 계산 중 발생하는 열을 식혀요',
    label: '전력 장비와 냉각 팬이 데이터센터 서버의 전력과 냉각을 지원하는 모습',
    art: <>
      <rect x="22" y="47" width="53" height="80" rx="4" {...wash} /><path d="m52 64-15 24h13l-5 20 19-28H51ZM31 118h33" />
      <Arrow x={85} /><rect x="115" y="40" width="52" height="88" rx="4" {...wash} /><path d="M123 57h36m-36 23h36m-36 23h36m-32-37h2m-2 23h2m-2 23h2" />
      <path d="M178 80h19m-5-4 5 4-5 4M197 103h-19m5-4-5 4 5 4" />
      <rect x="205" y="50" width="57" height="76" rx="4" {...wash} /><circle cx="233" cy="85" r="21" /><circle cx="233" cy="85" r="4" />
      <path d="M233 81c-18-16-23 1-4 7m8-3c20-15 25 1 4 8m-7-3c-3 24-19 21-10 2m-10 25h37" />
      <Labels>{['전력 공급', '서버 운영', '냉각']}</Labels>
    </>,
  },
  cybersecurity: {
    caption: '기기와 네트워크의 위협을 탐지하고 접근을 보호해요',
    label: '접속 요청을 보안 시스템에서 확인한 뒤 기업의 컴퓨터와 데이터를 보호하는 모습',
    art: <>
      <circle cx="49" cy="65" r="12" {...wash} /><path d="M29 114V98c0-24 40-24 40 0v16m-32-7h24" />
      <Arrow x={85} /><path d="M118 57h47v44c0 17-13 27-24 34-11-7-23-17-23-34Z" {...wash} /><path d="m129 88 8 8 17-20" />
      <Arrow x={177} /><rect x="204" y="58" width="57" height="45" rx="3" {...wash} /><path d="M233 103v16m-17 0h33M216 72h26m-26 10h17m-17 10h30" />
      <Labels>{['접속 요청', '보안 확인', '기업 데이터']}</Labels>
    </>,
  },
  'cloud-data': {
    caption: '흩어진 데이터를 연결해 분석과 실제 업무에 활용해요',
    label: '서로 다른 데이터 저장소를 연결한 플랫폼에서 분석 화면으로 정보를 전달하는 모습',
    art: <>
      <ellipse cx="49" cy="57" rx="21" ry="8" /><path d="M28 57v51c0 11 42 11 42 0V57m-42 17c0 11 42 11 42 0m-42 17c0 11 42 11 42 0" {...wash} />
      <Arrow x={85} /><rect x="115" y="56" width="52" height="57" rx="4" {...wash} />
      <path d="M127 70h8v8h-8Zm22 0h8v8h-8Zm-22 23h8v8h-8Zm22 0h8v8h-8Zm-14-19h14m-18 4v15m22-15v15m-18 4h14" />
      <Arrow x={177} /><rect x="204" y="54" width="57" height="53" rx="3" {...wash} /><path d="M233 107v12m-16 0h32m-34-38 9-8 10 6 16-14M215 97h35" />
      <Labels>{['데이터', '연결·분석', '업무 활용']}</Labels>
    </>,
  },
  'space-launch': {
    caption: '발사체로 위성을 우주에 보내고 우주 시스템을 공급해요',
    label: '발사체가 상승하며 위성을 우주 궤도로 운반하는 모습',
    art: <>
      <path d="M35 127h62m-51 0V61h14v66m-14-53h28m-28 19h28m-14 21 14-21m-14-19 14 19" />
      <path d="M96 104V53c0-17 10-31 20-39 10 8 20 22 20 39v51Zm0-9-13 21V85l13-18m40 28 13 21V85l-13-18" {...wash} />
      <circle cx="116" cy="54" r="8" /><path d="M106 104v12l10 18 10-18v-12m-27 24-6 13m40-13 6 13" />
      <path d="M154 68c10-19 33-32 57-32" strokeDasharray="3 5" />
      <rect x="222" y="38" width="21" height="29" rx="2" {...shade} /><path d="M216 43h-25v19h25Zm33 0h23v19h-23Zm-49 0v19m59-19v19m-68-10h25m33 0h23m-45 15-6 10m17-10 6 10" />
      <g fill="currentColor" stroke="none" fontSize="14" textAnchor="middle"><text x="61" y="163">발사 준비</text><text x="116" y="163">발사체</text><text x="233" y="163">우주 시스템</text></g>
    </>,
  },
  'satellite-communications': {
    caption: '위성 통신망을 통해 지상의 휴대전화와 연결해요',
    label: '지구 위의 통신 위성이 지상의 휴대전화와 무선 연결을 하는 모습',
    art: <>
      <rect x="122" y="24" width="36" height="31" rx="3" {...shade} /><path d="M115 28H70v22h45Zm50 0h45v22h-45ZM85 28v22m15-22v22m80-22v22m15-22v22m-125-11h45m50 0h45" />
      <path d="m126 62-49 43m78-43 49 43" strokeDasharray="3 5" />
      <rect x="49" y="91" width="31" height="45" rx="4" {...wash} /><path d="M59 97h11m-11 32h11" />
      <rect x="203" y="91" width="31" height="45" rx="4" {...wash} /><path d="M213 97h11m-11 32h11M94 124a64 64 0 0 1 94 0m-79 1 8-10 13 7 13-6 16 9" opacity=".5" />
      <g fill="currentColor" stroke="none" fontSize="14" textAnchor="middle"><text x="140" y="80">통신 위성</text><text x="65" y="160">휴대전화</text><text x="218" y="160">휴대전화</text></g>
    </>,
  },
  'surgical-robotics': {
    caption: '의료진이 조종하는 수술 장비와 소모품을 공급해요',
    label: '의료진의 조작 장치와 연결된 로봇 팔이 수술대에서 정밀한 움직임을 돕는 모습',
    art: <>
      <rect x="25" y="55" width="46" height="33" rx="3" {...wash} /><path d="M48 88v18m-16 0h32M32 72l10-5 10 8 11-6m-30 48h10v9H33Zm20 0h10v9H53Z" />
      <Arrow x={83} /><path d="M120 129V58h18v71m-18-56 28-29 17 12-23 27m23-27 31 21-9 14-39-21m40 21-2 17m-5 0h13" {...wash} />
      <circle cx="151" cy="51" r="6" /><circle cx="189" cy="78" r="6" />
      <path d="M172 127h88v-13h-88Zm10 0v10m68-10v10m-63-25h61m-53-12h38" {...wash} />
      <g fill="currentColor" stroke="none" fontSize="14" textAnchor="middle"><text x="48" y="160">의료진 조작</text><text x="137" y="160">수술 장비</text><text x="233" y="160">정밀한 동작</text></g>
    </>,
  },
  biomanufacturing: {
    caption: '의약품 개발사의 주문에 맞춰 바이오의약품을 생산해요',
    label: '개발사가 위탁한 의약품을 배양 탱크에서 생산하고 품질을 확인해 공급하는 모습',
    art: <>
      <path d="M29 44h34m-28 0v29l-12 32c-3 9 1 16 10 16h27c9 0 13-7 10-16L58 73V44m-31 53h38" {...wash} /><circle cx="43" cy="106" r="3" /><circle cx="54" cy="88" r="3" />
      <Arrow x={85} /><rect x="118" y="51" width="47" height="68" rx="12" {...wash} /><path d="M141 34v67m-12-67h24m-35 40h47m-47 29h47m-39 16v11m31-11v11m-16-50-9 10h18l-9 10" />
      <Arrow x={177} />{[209, 240].map(x => <g key={x}><rect x={x} y="70" width="22" height="47" rx="4" {...wash} /><path d={`M${x + 3} 70V60h16v10m-19 12h22m-16 10h10`} /></g>)}
      <Labels>{['개발사 의뢰', '위탁 생산', '품질·공급']}</Labels>
    </>,
  },
  payments: {
    caption: '소비자·가맹점·금융기관 사이의 결제 정보를 연결해요',
    label: '소비자의 카드 결제를 결제 네트워크가 연결해 가맹점으로 전달하는 모습',
    art: <>
      <rect x="20" y="66" width="58" height="38" rx="4" {...wash} /><path d="M20 77h58m-48 17h16m10 0h11" />
      <Arrow x={85} /><circle cx="141" cy="84" r="25" {...wash} /><circle cx="141" cy="84" r="7" /><path d="M141 59v18m-25 7h18m14 0h18m-25 7v18m-18-43 13 13m10 10 13 13m-36 0 13-13m10-10 13-13" />
      <Arrow x={177} /><path d="M210 120V74h47v46Zm-5-46 6-18h45l6 18m-57 0c0 9 14 9 14 0 0 9 14 9 14 0 0 9 14 9 14 0 0 9 15 9 15 0M228 120V99h14v21" {...wash} />
      <Labels>{['카드 결제', '결제망', '가맹점']}</Labels>
    </>,
  },
  brokerage: {
    caption: '투자자의 주문을 금융상품 거래로 연결하는 서비스를 제공해요',
    label: '투자자의 매매 주문을 증권 플랫폼이 금융상품 거래에 연결하는 모습',
    art: <>
      <circle cx="49" cy="60" r="13" {...wash} /><path d="M27 121V98c0-25 44-25 44 0v23m-34-13h24" />
      <Arrow x={85} /><rect x="123" y="43" width="37" height="85" rx="5" {...wash} /><path d="M134 52h14m-18 23h23m-23 11h23m-23 11h15m-8 22h7" />
      <Arrow x={177} /><rect x="206" y="53" width="55" height="66" rx="4" {...wash} /><path d="M206 70h55m-28 0v49m-19-36h12m-12 13h12m16-13h12m-12 13h12m-40 13h12m16 0h12" />
      <Labels>{['투자자', '증권 플랫폼', '상품 거래']}</Labels>
    </>,
  },
  'digital-assets': {
    caption: '가상자산을 거래하고 보관하는 서비스를 제공해요',
    label: '가상자산 거래 플랫폼과 보관 지갑, 거래 기록이 연결된 모습',
    art: <>
      <rect x="22" y="61" width="55" height="47" rx="5" {...wash} /><path d="M22 73h55m-40 18 6-6m-6 6 6 6m19-12-6 6 6 6M43 91h13" />
      <Arrow x={85} /><path d="M114 62h54v51h-54Zm0 12h54m-4 14h-18v15h18Z" {...wash} /><circle cx="152" cy="96" r="2" />
      <Arrow x={177} /><rect x="208" y="40" width="22" height="22" rx="3" {...wash} /><rect x="239" y="78" width="22" height="22" rx="3" {...wash} /><rect x="208" y="116" width="22" height="22" rx="3" {...wash} /><path d="m230 54 14 24m0 22-14 23m-11-61v54" />
      <Labels>{['거래 플랫폼', '보관 지갑', '거래 기록']}</Labels>
    </>,
  },
  'solar-equipment': {
    caption: '태양광 패널을 만들어 발전 사업자 등에 공급해요',
    label: '공장에서 제작한 태양광 패널을 설치 현장에 공급하는 모습. 전력 판매와 장비 제조는 구분',
    art: <>
      <path d="M23 121V72l18 10V65l18 11V54h15v67Zm8-18h10v10H31Zm20 0h10v10H51Z" {...wash} />
      <Arrow x={85} /><path d="m116 112 11-55h41l-11 55Zm11-55 30 55m-25-55-11 55m27-55-11 55m-17-37h42m-46 19h42" {...wash} />
      <Arrow x={177} /><path d="m207 111 13-31h40l-13 31Zm13-31 27 31m-15-31-13 31m-6-17h41m-35 17v14m27-14v14" {...wash} />
      <circle cx="239" cy="43" r="10" /><path d="M239 25v-4m0 40v4m18-22h5m-41 0h-5m10-13-4-4m30 4 4-4" />
      <Labels>{['생산', '태양광 패널', '납품·설치']}</Labels>
    </>,
  },
  'industrial-gases': {
    caption: '공장과 의료 현장에 필요한 산업용 가스를 공급해요',
    label: '가스 생산·저장 설비와 운반 용기를 통해 공장과 병원에 산업용 가스를 공급하는 모습',
    art: <>
      <path d="M26 115V54c0-19 45-19 45 0v61c0 12-45 12-45 0Zm0-51h45m-45 34h45m-37 24v8m29-8v8" {...wash} />
      <Arrow x={85} />{[122, 147].map(x => <g key={x}><rect x={x} y="59" width="17" height="66" rx="8" {...wash} /><path d={`M${x + 5} 59V48h7v11m-9 16h11`} /></g>)}
      <Arrow x={177} /><path d="M206 123V62h54v61Zm22-52h9v10h10v9h-10v10h-9V90h-10V80h10Zm-1 52v-14h13v14" {...wash} />
      <Labels>{['가스 생산', '공급·운송', '공장·의료']}</Labels>
    </>,
  },
} satisfies Partial<Record<SectorId, { caption: string; label: string; art: ReactNode }>>;

export const ADDITIONAL_CAPTIONS = Object.fromEntries(Object.entries(ADDITIONAL_ILLUSTRATIONS).map(([id, scene]) => [id, scene.caption]));
