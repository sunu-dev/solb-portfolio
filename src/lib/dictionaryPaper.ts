export const leftPaper = 'M24 30 C150 30 365 8 468 24 Q490 27 500 39 L500 575 C482 575 469 565 442 565 C305 579 130 575 24 571 Z';
export const rightPaper = 'M500 39 Q514 26 538 24 C665 10 847 29 976 30 L976 571 C841 575 695 579 558 565 C531 565 518 575 500 575 Z';

/** Use the same silhouette as the real SVG, without Safari foreignObject SVG paint servers. */
export function printDictionaryPaper(content: HTMLCanvasElement, paper: string, spread: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = content.width; canvas.height = content.height;
  const ctx = canvas.getContext('2d'); if (!ctx) return content;
  const w = canvas.width, h = canvas.height;
  ctx.save();
  if (spread) {
    ctx.scale(w/1000,h/610);
    const shape = new Path2D(leftPaper + rightPaper); ctx.clip(shape);
    ctx.scale(1000/w,610/h);
  } else {
    ctx.beginPath(); ctx.rect(w*.01,h*.005,w*.98,h*.988); ctx.clip();
  }
  ctx.fillStyle = paper; ctx.fillRect(0,0,w,h);
  const grain = document.createElement('canvas'); grain.width=128; grain.height=128;
  const grainContext = grain.getContext('2d');
  if (grainContext) {
    const pixels = grainContext.createImageData(128,128);
    let seed = 17;
    for (let i=0;i<pixels.data.length;i+=4) {
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
      const shade = seed >>> 24;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=shade; pixels.data[i+3]=6;
    }
    grainContext.putImageData(pixels,0,0);
    const pattern = ctx.createPattern(grain,'repeat'); if(pattern){ctx.fillStyle=pattern;ctx.fillRect(0,0,w,h);}
  }
  if (spread) {
    const binding = ctx.createLinearGradient(0,0,w,0);
    binding.addColorStop(0,'transparent'); binding.addColorStop(.42,'transparent');
    binding.addColorStop(.485,'rgba(255,255,255,.08)'); binding.addColorStop(.5,'rgba(0,0,0,.18)');
    binding.addColorStop(.515,'rgba(255,255,255,.06)'); binding.addColorStop(.58,'transparent'); binding.addColorStop(1,'transparent');
    ctx.fillStyle=binding;ctx.fillRect(0,0,w,h);
  }
  ctx.drawImage(content,0,0); ctx.restore(); return canvas;
}
