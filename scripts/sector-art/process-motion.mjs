import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const root='public/illustrations/sectors/originals';
const configs={
 food:{label:'식품 가공 라인에서 반죽과 빵이 오븐과 포장기로 이동해요.', paths:[
 'M456 661 Q453 632 490 628 Q531 624 539 658 Q538 684 497 691 Q464 690 456 673Z',
 'M561 613 Q558 588 601 576 Q639 568 660 600 Q670 626 626 641 Q583 654 566 634Z',
 'M674 558 Q676 536 722 524 Q760 518 776 540 L777 570 Q742 594 705 593 Q675 586 674 558Z',
 'M1113 414 Q1113 387 1172 372 Q1216 362 1238 391 Q1253 420 1200 442 Q1146 461 1119 438Z'],
 travel:'translate(68px,-32px)',
 area:'M434 621 L767 465 L778 600 L477 743Z M1083 407 L1238 334 L1286 408 L1083 506Z',
 foreground:'M774 467 L824 457 L824 682 L773 682Z M1287 292 L1357 317 L1357 507 L1287 507Z'},
 tobacco:{label:'담뱃잎 가공 설비에서 포장된 제품이 출하 방향으로 이동해요.',paths:[
 'M1182 550 L1254 516 L1318 544 L1318 575 L1246 609 L1182 580Z',
 'M1278 606 L1349 568 L1414 596 L1414 628 L1345 664 L1278 636Z'],travel:'translate(38px,19px)',
 area:'M1100 466 L1480 620 L1480 690 L1334 705 L1097 578Z',foreground:'M1098 552 L1350 674 L1350 700 L1098 577Z'},
 materials:{label:'강판이 압연 롤러를 지나 판재 이송 라인으로 공급돼요.'},
 cables:{label:'피복을 입힌 전선을 권취 릴에 감아요.'}
};
export const processConfigs=configs;
for(const [id,c] of Object.entries(configs)) for(const theme of ['light','dark']){
 const embed=async suffix=>'data:image/webp;base64,'+(await sharp(`${root}/${id}-v3-${theme}${suffix}.png`).webp({quality:92}).toBuffer()).toString('base64');
 let defs=`<image id="painting" width="1536" height="1024" href="${await embed('')}"/>`,body='',keyframes='';
 if(c.paths){
  defs+=`<image id="plate" width="1536" height="1024" href="${await embed('-plate')}"/><clipPath id="area"><path d="${c.area}"/></clipPath><clipPath id="front"><path d="${c.foreground}"/></clipPath>`;
  c.paths.forEach((p,i)=>defs+=`<clipPath id="item${i}"><path d="${p}"/></clipPath>`);
  body=`<use href="#painting"/><use href="#plate" clip-path="url(#area)"/><g clip-path="url(#area)"><g class="moving">${c.paths.map((_,i)=>`<use href="#painting" clip-path="url(#item${i})"/>`).join('')}</g></g><use href="#painting" clip-path="url(#front)"/>`;
  keyframes=`@keyframes process{0%,8%{transform:translate(0,0)}92%,100%{transform:${c.travel}}}`;
 }else if(id==='cables'){
  // Normalize the elliptical reel face to a circle before rotating, then restore
  // the hub and fixed bearing stand in front. The canvas and machine stay still.
  defs+=`<image id="plate" width="1536" height="1024" href="${await embed('-plate')}"/><clipPath id="reel"><ellipse cx="1170" cy="592" rx="126" ry="160" transform="rotate(-10 1170 592)"/></clipPath><clipPath id="spokes"><path d="M1090 465 Q1109 457 1126 465 L1144 533 L1127 556 L1107 587 L1066 605 Q1043 552 1090 465Z M1140 450 Q1214 460 1248 537 L1207 560 L1185 543 L1154 529Z M1216 590 L1260 577 Q1295 657 1249 720 L1227 730 L1185 659 L1201 629Z"/></clipPath><clipPath id="stand"><path d="M1083 624 L1126 615 L1167 643 L1199 780 L1169 789 L1065 743Z"/><path d="M1090 579 Q1100 558 1143 552 Q1174 556 1189 592 Q1193 625 1154 648 Q1110 661 1095 631Z"/></clipPath>`;
  body='<use href="#painting"/><use href="#plate" clip-path="url(#reel)"/><g clip-path="url(#reel)"><g transform="translate(1170 592) rotate(-10) scale(.76 1)"><g class="moving"><g transform="scale(1.315789 1) rotate(10) translate(-1170 -592)"><use href="#painting" clip-path="url(#spokes)"/></g></g></g></g><use href="#painting" clip-path="url(#stand)"/>';
  keyframes='@keyframes process{0%,8%{transform:rotate(0deg)}92%,100%{transform:rotate(110deg)}}';
 }else{
  defs+='<clipPath id="sheet"><path d="M835 505 L969 450 L1390 666 L1270 726Z"/></clipPath>';
  const ink=theme==='light'?'#aaa0c5':'#aa9bc8';
  body=`<use href="#painting"/><g clip-path="url(#sheet)"><g class="sheet" fill="none" stroke="${ink}" stroke-width="2" opacity=".35"><path d="M790 485L925 424M910 547L1045 486M1030 609L1165 548M1150 671L1285 610M1270 733L1405 672"/></g></g>`;
  for(const [x,y] of [[700,470],[707,582]])body+=`<g transform="translate(${x} ${y}) rotate(-18) scale(.8 1)"><g class="moving"><path d="M0 -19V-10" stroke="${ink}" stroke-width="3" stroke-linecap="round"/></g></g>`;
  keyframes='@keyframes process{0%,8%{transform:rotate(0deg)}92%,100%{transform:rotate(220deg)}}@keyframes feed{0%,8%{transform:translate(0,0)}92%,100%{transform:translate(120px,62px)}}.sheet{animation-name:feed}';
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024" role="img" aria-label="${c.label}"><defs>${defs}</defs><style>.moving,.sheet{animation-name:process;animation-duration:2.6s;animation-timing-function:cubic-bezier(.45,0,.25,1);animation-iteration-count:1;animation-fill-mode:both}${keyframes}.still{display:none}@media(prefers-reduced-motion:reduce){.process{display:none}.still{display:block}.moving,.sheet{animation:none!important}}</style><g class="process">${body}</g><use class="still" href="#painting"/></svg>`;
 writeFileSync(`${root}/${id}-v3-${theme}-process.svg`,svg);
 console.log(`${id} ${theme}: ${Math.round(Buffer.byteLength(svg)/1024)} KiB`);
}
