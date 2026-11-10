import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

// Use the approved painting for all visible geometry. Only the cleared background
// comes from an inpainted plate. Embedded WebP avoids external SVG image requests.
const root = 'public/illustrations/sectors/originals';
const arm = 'M258 230 Q250 196 276 181 L445 91 Q485 76 520 100 L636 145 Q663 136 677 161 L678 174 L716 182 L724 207 L712 224 L692 237 L676 244 L665 271 L658 303 L654 333 L633 332 L634 313 L645 300 L647 263 L655 242 L650 231 L674 220 L675 209 L651 204 L638 193 Q612 205 598 188 L504 153 Q490 174 465 169 L337 244 Q308 273 281 257 Z';
const door = 'M650 309 Q673 225 798 176 L805 179 L812 290 L802 325 L665 387 Q646 372 650 309 Z';
const lower = 'M260 226 L340 209 L401 302 L432 325 L429 375 L351 397 L294 324 Z';
const hole = 'M235 60 H825 V340 L674 405 L588 357 L400 380 L236 280 Z';
const foreground = 'M489 582 L498 545 L550 502 L604 468 L659 399 L730 351 L796 311 L842 284 Q944 267 1019 304 L1082 309 L1133 349 L1142 418 L1090 523 L1000 576 L823 652 L741 701 L584 704 L493 660 Z';

for (const theme of ['light', 'dark']) {
  const embed = async suffix => `data:image/webp;base64,${(await sharp(readFileSync(`${root}/automotive-v4-${theme}${suffix}.png`)).webp({ quality: 92 }).toBuffer()).toString('base64')}`;
  const original = await embed('');
  const plate = await embed('-plate');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024" role="img" aria-label="자동차 생산 라인에서 로봇 팔이 도어를 차체에 배치하고 복귀하는 동작">
<defs><image id="painting" width="1536" height="1024" href="${original}"/><image id="plate" width="1536" height="1024" href="${plate}"/>
<clipPath id="outside"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H1536V1024H0Z ${hole}"/></clipPath><clipPath id="cleared"><path d="${hole}"/></clipPath>
<clipPath id="arm"><path d="${arm}"/></clipPath><clipPath id="door"><path d="${door}"/></clipPath><clipPath id="lower"><path d="${lower}"/></clipPath><clipPath id="car"><path d="${foreground}"/></clipPath></defs>
<style>
.upper,.door{transform-origin:300px 230px;animation-duration:2.6s;animation-timing-function:cubic-bezier(.45,0,.25,1);animation-iteration-count:1;animation-fill-mode:both}
.upper{animation-name:reach}.door{animation-name:place}
@keyframes reach{0%,10%{transform:rotate(0deg)}42%,64%{transform:rotate(19deg)}90%,100%{transform:rotate(0deg)}}
@keyframes place{0%,10%{transform:rotate(0deg)}42%,100%{transform:rotate(19deg)}}
.still{display:none}
@media(prefers-reduced-motion:reduce){.assembly{display:none}.still{display:block}.upper,.door{animation:none!important}}
</style>
<g class="assembly"><use href="#painting" clip-path="url(#outside)"/><use href="#plate" clip-path="url(#cleared)"/><use href="#painting" clip-path="url(#lower)"/>
<g class="door"><use href="#painting" clip-path="url(#door)"/></g><g class="upper"><use href="#painting" clip-path="url(#arm)"/></g><use href="#painting" clip-path="url(#car)"/></g><use class="still" href="#painting"/>
</svg>`;
  writeFileSync(`${root}/automotive-v4-${theme}-assembly.svg`, svg);
  console.log(`${theme}: ${(Buffer.byteLength(svg) / 1024).toFixed(0)} KiB`);
}
