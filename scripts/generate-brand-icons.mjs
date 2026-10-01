// Reproducible brand assets. Only the explicit generated icon paths below are written.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile('public/joobi-icon.svg');
for (const size of [192, 512]) {
  await sharp(source).resize(size, size).png().toFile(`public/icon-${size}.png`);
  // Full opaque background for maskable icons, with the mark inside the safe area.
  await sharp(source).resize(size, size).flatten({ background: '#FFF1F3' }).png().toFile(`public/icon-maskable-${size}.png`);
}
const png = await sharp(source).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile('src/app/favicon.ico', Buffer.concat([header, png]));
console.log('Generated favicon and 4 app icons from joobi-icon.svg');
