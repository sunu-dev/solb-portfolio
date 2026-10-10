import type { ReactNode } from 'react';
import type { SectorId } from '@/lib/sectorExploration';

// Original editorial line drawings. A shared pen, not a shared scene.
// Opacity washes inherit currentColor so the same artwork works in both themes.
const wash = { fill: 'currentColor', fillOpacity: 0.055 };
const shade = { fill: 'currentColor', fillOpacity: 0.12 };
export const SECTOR_ILLUSTRATION_CAPTIONS: Partial<Record<SectorId, string>> = {
  'fuel-cells': '건물 가까이에서 전기를 만들어요',
  photonics: '빛에 데이터를 실어 광섬유로 보내요',
};
const illustrations = {
  'fuel-cells': {
    label: '연료전지 발전장비에서 만든 전기가 옆 건물로 공급되는 모습',
    art: <>
      <path d="M25 63h80v65H25Zm0 0 13-11h80v65l-13 11m0-65 13-11" {...wash} />
      <path d="M51 63v65m27-65v65m-43-52h8m18 0h8m18 0h8m-60 12h8m18 0h8m18 0h8m-60 12h8m18 0h8m18 0h8m-60 12h8m18 0h8m18 0h8" />
      <path d="M118 109h64m-7-5 7 5-7 5" />
      <path d="m152 68-13 19h11l-4 14 16-22h-12Z" {...shade} />
      <path d="M195 59h51v72h-51Zm0 0 13-13h51v72l-13 13m0-72 13-13M214 131v-20h13v20" {...wash} />
      <path d="M204 71h10v10h-10Zm22 0h10v10h-10Zm-22 21h10v10h-10Zm22 0h10v10h-10Z" />
      <g fill="currentColor" stroke="none" fontSize="13" textAnchor="middle"><text x="71" y="153">연료전지</text><text x="150" y="58">전기</text><text x="226" y="153">건물</text></g>
    </>,
  },
  photonics: {
    label: '송신 장치가 빛에 데이터를 실어 광섬유 케이블을 통해 서버로 보내는 모습',
    art: <>
      {/* Optical transmitter: a light source and an output connector. */}
      <path d="M20 64h47v63H20Zm0 0 11-9h47v63l-11 9m0-63 11-9" {...wash} />
      <circle cx="43" cy="86" r="8" /><path d="M43 72v-4m0 36v-4M29 86h-4m36 0h-4m-24-10-3-3m26 26-3-3m0-20 3-3m-26 26 3-3M30 115h26" />
      <path d="M78 87h10v14H78" {...shade} />
      {/* One continuous cable, with directional light pulses inside it. */}
      <path d="M88 88h17c17 0 17 24 35 24s18-24 36-24h29v12h-29c-12 0-13 24-36 24s-24-24-35-24H88Z" {...wash} />
      <path d="m96 94 7 0m-3-3 3 3-3 3m36 21h9m-3-3 3 3-3 3m44-24h10m-3-3 3 3-3 3" />
      <path d="M143 79v23" strokeDasharray="2 4" opacity=".45" />
      {/* Receiving server rack with three recognizable drive bays. */}
      <path d="M211 49h43v79h-43Zm0 0 12-9h43v79l-12 9m0-79 12-9" {...wash} />
      <path d="M205 87h6v14h-6Z" {...shade} />
      {[58, 79, 100].map(y => <g key={y}><rect x="218" y={y} width="29" height="15" rx="2" /><path d={`M223 ${y + 7}h10m8 0h1`} /></g>)}
      <g fill="currentColor" stroke="none" fontSize="12" textAnchor="middle">
        <text x="49" y="152">송신 장치</text>
        <text x="143" y="70">광섬유</text>
        <text x="237" y="152">서버</text>
      </g>
    </>,
  },
  shipbuilding: {
    label: '크레인 아래에서 선체와 화물칸을 조립하는 조선소',
    art: <>
      <path d="M44 116V29h154v9H52v78M44 29l35-15 119 15M79 14v15m-27 9 27-24m0 24 28-9m-1 9 28-9m0 9 28-9m0 9 28-9M174 38v23m-5 0v7a5 5 0 0 0 10 0" />
      <path d="m63 99 179-10-26 39-127 9Z" {...wash} />
      <path d="m63 99 23 15 145-9m-145 9 3 23m29-25 2 22m29-24 2 21m29-23 2 20m28-21 2 21" />
      <path d="M89 97V76h40v19m-34-19V60h25v16m-17-16V49m-9 37h25M140 94V74h29v18m8-1V72h28v17m-59-14v17m10-17v17m27-18v16m10-17v16" />
      <path d="m36 149 25-3 16 5 24-4 25 3m18-2 24 3 29-5 19 4 25-3M52 156h-8m73 4h54m66-3h13" opacity=".45" />
    </>,
  },
  pharma: {
    label: '분자 구조와 연구용 플라스크, 완성된 캡슐 의약품',
    art: <>
      <path d="m35 58 21-13 22 13v25L56 96 35 83Zm43 0 21-13 22 13v25L99 96 78 83M41 62v17m16-28 15 9m13 3v15m14 11 15-9M35 58 22 51m34-6V29m65 29 15-8" />
      <circle cx="56" cy="24" r="5" /><circle cx="17" cy="48" r="5" /><circle cx="141" cy="47" r="5" />
      <path d="M168 35h26m-22 0v37l-24 44c-4 8 0 14 9 14h47c9 0 13-6 9-14l-23-44V35" {...wash} />
      <path d="M159 99c19-9 29 9 44 0m-36-20h9m-14 10h9m-3 28h6" />
      <circle cx="187" cy="109" r="3" /><circle cx="184" cy="88" r="2" />
      <g transform="rotate(-30 84 129)"><rect x="51" y="113" width="66" height="31" rx="15.5" {...wash} /><path d="M84 113v31m-21-23h8m-13 5v5" /><path d="M90 119v19m6-19v19m6-18v17" opacity=".25" /></g>
      <path d="M147 149h71m-185 4h88m110-63 7-4m-10-4 2-8" opacity=".35" />
    </>,
  },
  semiconductors: {
    label: '격자무늬 실리콘 웨이퍼 위로 분리해 놓은 반도체 칩',
    art: <>
      <ellipse cx="118" cy="94" rx="79" ry="48" {...wash} />
      <path d="M39 94v9c0 26 35 48 79 48 29 0 55-10 69-25M45 114c26 30 96 39 138 8" opacity=".5" />
      <path d="m54 67 89 66m-70-78 91 68M95 48l86 64m-63-66 73 53m-50-51 54 40M44 81l70 52M71 123l88-68m-67 77 89-66m-67 70 77-58M53 110l84-64m-94 48 61-46" opacity=".3" />
      <path d="m143 66 45-27 52 29v16l-46 28-50-29Z" fill="var(--surface)" />
      <path d="m143 66 45-27 52 29-46 28Z" {...shade} />
      <path d="m143 66 1 17 50 29 46-28V68m-46 28v16m-40-44 34-20 40 22-34 20Z" />
      <path d="m151 88-8 5m17 0-8 5m17 0-8 5m17 0-8 5m17 0-8 5m27-8 8 5m1-10 8 5m1-10 8 5m1-10 8 5m1-10 8 5M165 48v-9m9 4v-9m27 6v-9m9 14v-9m9 14v-9" />
      <path d="M49 41h10m-5-5v10m181 80h8m-4-4v8" opacity=".4" />
    </>,
  },
  technology: {
    label: '클라우드와 연결된 컴퓨터, 그 위에 펼쳐진 소프트웨어 창',
    art: <>
      <path d="M157 46h56c14 0 17-22 3-26-5-19-35-18-42-2-16-5-29 13-17 28Z" {...wash} />
      <path d="M183 47v18m0 0h36v33" strokeDasharray="3 5" opacity=".5" />
      <path d="m51 76 113-20 1 64-113 22Z" {...wash} />
      <path d="m52 142 113-22 37 17-116 25-34-20Zm12-58 88-16v45l-88 18Z" />
      <path d="m78 142 83-16 22 10-84 18m3-6 33-7" opacity=".45" />
      <path d="m87 47 96-17v59l-96 18Z" {...wash} />
      <path d="m87 61 96-17m-87 10 1-.2m6-1 1-.2m6-1 1-.2m8 18-9 10 9 6m26-23 9 6-9 10m-12-19-6 24" />
      <path d="M35 57h10m-5-5v10m177 64h12m-6-6v12" opacity=".45" />
    </>,
  },
  communication: {
    label: '전파를 보내는 안테나와 콘텐츠가 재생되는 휴대전화',
    art: <>
      <path d="m83 78-23 68h47L83 78Zm-10 32h20m-26 18h33m-32 0 26-18m-33 36 39-18M83 65v13" />
      <circle cx="83" cy="59" r="6" {...shade} />
      <path d="M66 42a24 24 0 0 0 0 34m34-34a24 24 0 0 1 0 34M55 31a40 40 0 0 0 0 56m56-56a40 40 0 0 1 0 56" />
      <g transform="rotate(9 182 99)"><rect x="152" y="47" width="61" height="103" rx="9" {...wash} /><path d="M174 55h18m-20 86h20" /><rect x="160" y="67" width="45" height="43" rx="3" /><path d="m177 79 13 10-13 10Zm-15 40h21m-21 7h32" /></g>
      <path d="M124 62c10 0 17 5 23 11m-23-18c14 0 23 5 28 10" opacity=".4" />
      <path d="M44 157h76m24 4h75m-1-137h10m-5-5v10" opacity=".35" />
    </>,
  },
  'consumer-discretionary': {
    label: '쇼핑백과 배송 상자, 여가를 상징하는 티켓',
    art: <>
      <path d="m44 66 62-10 12 85-72 10Z" {...wash} />
      <path d="M61 67V48c0-21 29-24 29-4v17m-36 8v72m52-85 13 9 12 77-13-1" />
      <path d="m124 105 48-20 59 23-48 23Z" {...shade} />
      <path d="M124 105v36l59 26 48-25v-34m-48 23v36m-35-72 59 25v13l-12 6v-14l-60-26" />
      <g transform="rotate(-14 176 56)"><path d="M135 36h86v12a8 8 0 0 0 0 16v12h-86V64a8 8 0 0 0 0-16Z" {...wash} /><path d="M196 40v32" strokeDasharray="3 4" /><path d="m158 47 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z" /></g>
      <path d="M27 106h7m-3-4v8m205-28h9m-4-4v8" opacity=".4" />
    </>,
  },
  'consumer-staples': {
    label: '장바구니에 담긴 우유와 빵, 생활용품',
    art: <>
      <path d="m49 91 12 60h154l13-60Z" {...wash} />
      <path d="M43 91h191m-155 11 6 38m20-38 3 38m22-38v38m24-38-2 38m23-38-4 38m24-38-6 38M76 89l39-54m89 54-38-54" />
      <path d="M69 88V58l11-18h26l10 18v30M80 40v17l-11 1m11-1h36m-35 14h24v12H81Z" />
      <path d="m140 88-6-44c-2-21 27-28 33-6l13 50m-36-37 14-5m-12 20 17-6m-14 21 19-6" {...wash} />
      <path d="M191 86V58c0-9 19-9 19 0v28m-16-35V39h13v12m-13-12h22m-16 26h10" />
      <path d="M47 161h185m-183-117h10m-5-5v10" opacity=".35" />
    </>,
  },
  energy: {
    label: '원유를 끌어올리는 펌프와 저장 탱크',
    art: <>
      <path d="M45 148h123M96 73l-22 75m30-75 33 75M83 119h41m-41 0 29-23M65 64l76-27 12 19-80 30Z" {...wash} />
      <path d="m141 37 24 5 9 30-19 7-2-23m13 22v53m-7 0h14v17h-14Zm-99-64-9-25 16-7 9 24m-16-9 3 33M42 83h38v10H42Z" />
      <circle cx="101" cy="73" r="5" /><path d="m71 92 26 40h18" />
      <path d="M192 92v54c0 12 48 12 48 0V92m-48 21c0 12 48 12 48 0" {...wash} /><ellipse cx="216" cy="92" rx="24" ry="9" />
      <path d="M208 135c0-6 8-16 8-16s8 10 8 16a8 8 0 0 1-16 0Z" />
      <path d="M36 159h120m36-128c-9 10-13 18-7 23 10 8 19-3 14-11" opacity=".4" />
    </>,
  },
  financials: {
    label: '기둥이 있는 은행 건물과 층층이 쌓인 동전',
    art: <>
      <path d="m39 67 67-39 64 39Z" {...wash} /><path d="M42 73h126M49 135V81h17v54m25 0V81h18v54m24 0V81h17v54M42 135h117v9H36v10h126" />
      <circle cx="106" cy="53" r="9" /><path d="M106 48v10m-3-8h4m-3 6h4" />
      <path d="M169 130v25c0 11 57 11 57 0v-25m-57 9c0 11 57 11 57 0m-57 8c0 11 57 11 57 0" {...wash} /><ellipse cx="197.5" cy="130" rx="28.5" ry="10" />
      <path d="M181 111v13c0 10 54 10 54 0v-13" {...wash} /><ellipse cx="208" cy="111" rx="27" ry="9" />
      <path d="M203 41c-24-10-47 3-45 23m45-23-4-8m4 8-9 2m47 38h9m-4-4v8" opacity=".45" />
    </>,
  },
  healthcare: {
    label: '청진기와 건강 기록, 진료를 상징하는 십자 표시',
    art: <>
      <g transform="rotate(-8 99 91)"><rect x="54" y="36" width="89" height="113" rx="6" {...wash} /><rect x="80" y="29" width="38" height="16" rx="4" /><path d="M65 96h14l7-14 11 32 9-23 7 5h17M69 126h43m-43 8h26" /><path d="M93 55h11v9h9v11h-9v9H93v-9h-9V64h9Z" /></g>
      <path d="M176 38v39c0 33 52 33 52 0V38m-46 0h-6m46 0h6M202 102v23c0 33-48 32-48 4v-7" />
      <path d="M182 48v29c0 24 40 24 40 0V48" opacity=".4" />
      <circle cx="154" cy="115" r="12" {...wash} /><circle cx="154" cy="115" r="6" />
      <path d="M52 162h123m64-30h9m-4-4v8" opacity=".35" />
    </>,
  },
  industrials: {
    label: '컨베이어 위의 부품을 옮기는 공장 로봇 팔',
    art: <>
      <path d="M42 133h193a12 12 0 0 1 0 24H42a12 12 0 0 1 0-24Z" {...wash} />
      {[45, 69, 93, 117, 141, 165, 189, 213, 235].map(x => <circle key={x} cx={x} cy="145" r="5" />)}
      <path d="M50 157v10m176-10v10M68 132v-14h51v14m-42-14 13-38 14 4 8 34" />
      <circle cx="97" cy="75" r="13" {...wash} /><circle cx="97" cy="75" r="5" />
      <path d="m87 66 43-38 11 15-32 37m30-50 51 32-9 15-47-28" {...wash} />
      <circle cx="136" cy="35" r="10" /><circle cx="186" cy="68" r="9" />
      <path d="m186 77 1 16m-1-7-13 10 5 10m8-20 15 9-4 11m-22 11 15-8 16 8v15h-31Z" />
      <path d="M42 107V62l19-13v30m147-33h20v34m-10-34V29m-9 0h18" opacity=".35" />
    </>,
  },
  materials: {
    label: '결정 형태의 원료와 금속 코일, 산업용 소재',
    art: <>
      <path d="m43 107 13-51 38-22 28 42-20 53Z" {...wash} />
      <path d="m56 56 27 30 11-52m-51 73 40-21 19 43m-19-43 39-10m-66-20 46 73" />
      <ellipse cx="190" cy="97" rx="38" ry="49" {...wash} /><ellipse cx="190" cy="97" rx="27" ry="37" /><ellipse cx="190" cy="97" rx="16" ry="24" />
      <path d="M190 48h-23c-22 0-38 22-38 49s16 49 38 49h23m-33-95c-22 20-28 65-5 89m38 6h47v-13h-25" />
      <path d="m37 142 59-8 32 14-62 11Z" {...shade} /><path d="M37 142v10l29 16 62-10v-10m-62 11v9" />
      <path d="m134 26 4 8m7-12-1 9m87 13h10m-5-5v10" opacity=".4" />
    </>,
  },
  'real-estate': {
    label: '입체적으로 나란히 선 주택과 업무용 빌딩',
    art: <>
      <path d="m109 136 1-97 53-18 44 22v99l-52 24Z" {...wash} />
      <path d="m110 39 45 21 52-17m-52 17v106M122 56l20 9m-20 5 20 9m-20 5 20 9m-20 5 20 9m-20 5 20 9m-20 5 20 9" />
      <path d="m168 68 27-11m-27 26 27-11m-27 26 27-11m-27 26 27-11m-27 26 27-11m-10-51v73" opacity=".65" />
      <path d="m35 112 35-38 45 20 25 40-9 4v6l-47 22-41-20v-27Z" fill="var(--surface)" />
      <path d="m35 112 35-38 45 20 25 40-46 22Z" {...wash} />
      <path d="m35 112 38 17 21 27m-21-27 42-35M43 119v27l41 20 47-22v-14m-47 36v-26m-27 12v-21l13 6v21m30-29 15-7v13l-15 7Z" />
      <path d="M233 147v-34m0 0c-27-8-11-41 0-46 12 8 26 41 0 46Zm-12 40 12-6 13 6M72 48h13m-6-6v12" opacity=".5" />
    </>,
  },
  utilities: {
    label: '풍력 발전기와 태양광 패널, 전기가 이어지는 집',
    art: <>
      <circle cx="95" cy="61" r="6" {...shade} />
      <path d="m93 55-2-34c0-7 7-10 8-2l2 37m-1 8 32 17c7 4 7 11 0 7L96 68m-7-5L58 80c-7 4-12-1-5-6l36-16M92 68l-4 81h16l-7-81" />
      <path d="m33 126 14-26h41l-14 26Zm14-26 27 26m-34-13h41m-19-13-14 26m2 0v16m17-16v16" {...wash} />
      <path d="m152 99 39-32 43 32m-74-6v50h63V91m-40 52v-25h17v25m-29-42h13v10h-13Zm29 0h13v10h-13Z" {...wash} />
      <path d="M104 148h87v-5" strokeDasharray="3 5" opacity=".5" />
      <circle cx="204" cy="36" r="10" /><path d="M204 17v-5m0 43v5m19-24h5m-38 0h-5m6-13-4-4m30 4 4-4" opacity=".45" />
      <path d="M31 153h48m77 6h84" opacity=".35" />
    </>,
  },
  equipment: {
    label: '렌즈를 통과한 빛으로 웨이퍼에 회로를 새기는 반도체 장비',
    art: <>
      <path d="M46 139V32h28v107m-28-98h73m-45 15h45M35 140h109v13H35Z" {...wash} />
      <path d="M105 42h58v12h-58Zm9 12v19c0 8 40 8 40 0V54m-34 24v16c0 9 28 9 28 0V78" />
      <ellipse cx="134" cy="94" rx="14" ry="5" />
      <path d="m122 101-18 25m42-25 18 25m-30-24v24" strokeDasharray="3 4" opacity=".5" />
      <ellipse cx="135" cy="135" rx="40" ry="12" {...wash} /><path d="M95 135v8c0 16 80 16 80 0v-8m-65-6 40 14m-24-19 39 14m-52 2 30-15m-14 20 29-15" opacity=".5" />
      <path d="M197 130V77h44v53Zm0-42h44m-35 9h25v17h-25Zm-9 43v23h44v-23m-29 9h15m-31-48h-14V34h-38" />
      <path d="M188 161h64m-197-144h11m-5-5v10" opacity=".35" />
    </>,
  },
  defense: {
    label: '넓은 범위를 살피는 레이더와 방어를 상징하는 방패',
    art: <>
      <path d="m62 61 48 50c-29 20-66-17-48-50Z" {...wash} />
      <path d="m62 61 48 50M85 86l26-26m-5-5 10 10M78 106l-6 29h37l-17-26M63 136h56v13H63Z" />
      <path d="M120 72a22 22 0 0 0-20-21m31 23a34 34 0 0 0-33-35m46 38a48 48 0 0 0-49-52" opacity=".5" />
      <path d="M155 68c19 0 28-8 39-15 11 7 22 15 40 15v38c0 26-21 41-40 50-19-9-39-24-39-50Z" {...wash} />
      <path d="M164 76c11-1 22-6 30-12 9 6 19 11 31 12v30c0 20-16 33-31 41-15-8-30-21-30-41Z" />
      <path d="m176 104 12 12 25-27M44 159h84m25-133h10m-5-5v10" opacity=".5" />
    </>,
  },
  aerospace: {
    label: '궤도를 도는 인공위성과 하늘을 가로지르는 비행기',
    art: <>
      <path d="M36 125c24-77 137-114 201-80M49 145c46-12 75-7 97 3" strokeDasharray="3 5" opacity=".35" />
      <g transform="translate(17 -10) rotate(-28 171 67)"><rect x="157" y="50" width="28" height="33" rx="3" {...shade} /><path d="M151 56h-34v22h34Zm40 0h34v22h-34ZM128 56v22m12-22v22m62-22v22m12-22v22m-97-11h34m40 0h34m-40-1h6m-40 0h6M165 83l-6 12m18-12 6 12m-25 0h25m-19-45 7-9 7 9m-7-9V31" /><circle cx="171" cy="28" r="3" /></g>
      <path d="m39 125 26-14 37-52c5-7 12-4 9 5L97 98l38-14 13-22 9-2-3 25c8 3 8 7 0 10l-23 8-24 27-10 3 12-24-33 12-17 22-9 2 6-18Z" {...wash} />
      <path d="m76 121 21-23m-34 40-17 13m-4-13-14 8" opacity=".5" />
      <path d="M170 159a74 74 0 0 1 72-47m-59 47c12-22 29-33 59-35m-20-9 7 14-11 9 6 12m-21-25-7 11 8 12" opacity=".45" />
    </>,
  },
  batteries: {
    label: '층으로 펼친 배터리 소재와 원통형 충전지',
    art: <>
      <path d="m39 114 51-26 59 27-51 29Z" {...shade} /><path d="m39 99 51-26 59 27-51 29Zm0-16 51-26 59 27-51 29Zm0-16 51-26 59 27-51 29Z" {...wash} />
      <path d="m53 66 37-18 44 20m-83 50 47 21 40-23m-87-31 47 21 40-23m-87 16 47 21 40-23" opacity=".3" />
      <path d="M169 60v84c0 18 54 18 54 0V60" {...wash} /><ellipse cx="196" cy="60" rx="27" ry="11" /><path d="M169 133c0 18 54 18 54 0m-38-77v-8c0-7 22-7 22 0v8c0 7-22 7-22 0Z" />
      <path d="m200 78-17 28h14l-5 21 18-29h-14ZM176 74v51" />
      <path d="M91 29v-9m-4 4h8m45 120v10m-4-5h8M40 157h76m48 9h70" opacity=".4" />
    </>,
  },
  automotive: {
    label: '차체 아래 바퀴와 도로가 보이는 입체 자동차',
    art: <>
      <path d="m39 104 20-20 45-14 34-27 47 11 30 36 23 14v28l-26 13-114 17-59-25Z" {...wash} />
      <path d="m59 84 39 25 117-19M98 109v27m6-66 45 13 36-29m-47-11 11 40-45-13m53 11 48-7-24-14m-32 23-11-40M39 104l59 32 140-22m-21-17 16 10-24 5-9-12m-153 12 15 8v8l-15-8m59 0 15-2m24-4 11-2" />
      <ellipse cx="77" cy="137" rx="12" ry="18" transform="rotate(-15 77 137)" fill="var(--surface)" /><ellipse cx="77" cy="137" rx="5" ry="9" transform="rotate(-15 77 137)" />
      <ellipse cx="203" cy="133" rx="12" ry="18" transform="rotate(15 203 133)" fill="var(--surface)" /><ellipse cx="203" cy="133" rx="5" ry="9" transform="rotate(15 203 133)" />
      <path d="m33 158 21-3m52 12 72-11m45-4 22-4M40 64l29-7m-18-5 29-7" opacity=".35" />
    </>,
  },
} satisfies Record<SectorId, { label: string; art: ReactNode }>;

export default function SectorIllustration({ sector }: { sector: SectorId }) {
  const illustration = illustrations[sector];
  return <svg viewBox="0 0 280 180" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={illustration.label} data-sector-illustration={sector}>
    {illustration.art}
  </svg>;
}
