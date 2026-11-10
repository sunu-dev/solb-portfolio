// Decorative, finite motion registered to the v2 artwork's 1536 × 1024 canvas.
// The illustration stays still; these strokes describe activity within the scene.
export const originalMotion = {
  automotive: { label: '로봇 팔의 도어 배치와 복귀', paths: ['M1000 443 L1010 450', 'M674 227 L685 229'], kind: 'lamp' },
  brokerage: { label: '주문이 오가는 흐름', paths: ['M670 246 Q750 210 817 275', 'M773 668 Q674 709 587 632'], kind: 'flow' },
  optics: { label: '관찰 대상에 모이는 빛', paths: ['M801 698 L801 660', 'M801 533 L817 485'], kind: 'flow' },
  cables: { label: '도체를 따라 전달되는 전기', paths: ['M710 676 L926 761', 'M705 702 L903 807', 'M692 716 L837 802'], kind: 'flow' },
  restaurant: { label: '음식 위로 피어오르는 김', paths: ['M594 333 C558 302 624 277 597 245', 'M647 340 C616 307 667 290 644 267', 'M866 380 C831 350 893 328 867 299'], kind: 'steam' },
  food: { label: '구운 빵 위로 피어오르는 김', paths: ['M485 241 C450 213 515 181 483 145', 'M597 210 C568 181 625 152 599 119', 'M715 247 C687 214 743 193 720 161'], kind: 'steam' },
  materials: { label: '강판 표면을 지나는 빛', paths: ['M790 252 L1018 167', 'M820 322 L1070 229', 'M845 391 L1104 293'], kind: 'sheen' },
  agriculture: { label: '곡물 사이를 지나는 바람', paths: ['M995 444 Q1080 404 1170 413 Q1255 426 1344 380', 'M1029 533 Q1130 494 1230 505 Q1327 516 1410 472'], kind: 'wind' },
  tobacco: { label: '담뱃잎의 잎맥을 따라가는 강조', paths: ['M987 480 Q1011 594 1126 678 Q1230 747 1308 794'], kind: 'flow' },
  photonics: { label: '광섬유를 따라 전달되는 빛', paths: ['M875 286 C1310 132 1500 543 821 789', 'M889 322 C1274 203 1445 513 811 695', 'M854 249 C1330 62 1621 489 916 852'], kind: 'flow' },
};

export function motionSvg(id, theme = 'light') {
  const scene = originalMotion[id];
  if (!scene) throw new Error(`Missing original motion: ${id}`);
  const color = theme === 'dark' ? '#d2bce9' : '#9b83bb';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024" fill="none" aria-hidden="true"><style>
path{stroke:${color};stroke-width:7;stroke-linecap:round;opacity:0;animation-duration:2.6s;animation-iteration-count:1;animation-fill-mode:both}
.flow{stroke-dasharray:18 82;animation-name:flow}
.steam{animation-name:steam;stroke-width:6}
.wind{stroke-dasharray:28 72;animation-name:wind;stroke-width:5}
.sheen{stroke:#eee7fb;stroke-width:14;stroke-dasharray:25 75;animation-name:flow}
.lamp{stroke:#e1d4f6;stroke-width:13;animation-name:lamp}
@keyframes lamp{0%,100%{opacity:0}20%,65%{opacity:1}}
@keyframes flow{0%{opacity:0;stroke-dashoffset:25}15%,70%{opacity:.8}90%,100%{opacity:0;stroke-dashoffset:-100}}
@keyframes steam{0%{opacity:0;transform:translateY(16px)}25%,55%{opacity:.55}100%{opacity:0;transform:translateY(-45px)}}
@keyframes wind{0%{opacity:0;stroke-dashoffset:35;transform:translateX(-15px)}25%,55%{opacity:.65}100%{opacity:0;stroke-dashoffset:-100;transform:translateX(25px)}}
@media(prefers-reduced-motion:reduce){path{animation:none!important;opacity:0!important}}
</style>${scene.paths.map(d => `<path class="${scene.kind}" pathLength="100" d="${d}"/>`).join('')}</svg>`;
}
