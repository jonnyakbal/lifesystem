import fs from 'node:fs/promises';
import sharp from 'sharp';

const solar = await fs.readFile('public/icons/icon-v4-solar.svg');
await fs.writeFile('public/icons/solar.svg', solar);
await fs.mkdir('public/brand', { recursive: true });
for (const size of [192, 512]) {
  await sharp(solar).resize(size).png().toFile(`public/icons/solar-${size}.png`);
}
await sharp(solar).resize(180).flatten({ background: '#070a1c' }).png().toFile('public/icons/solar-apple.png');
const inset = await sharp(solar).resize(360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#070a1c' } }).composite([{ input: inset, left: 76, top: 76 }]).png().toFile('public/icons/solar-maskable.png');
// ICO containing a PNG image, supported by modern browsers and Windows.
const png = await sharp(solar).resize(32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await fs.writeFile('src/app/favicon.ico', Buffer.concat([header, png]));
const backdrop = Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="b"><stop stop-color="#1d2451"/><stop offset="1" stop-color="#070a1c"/></radialGradient></defs><rect width="1600" height="900" fill="url(#b)"/><g fill="none" stroke="#a78bfa" opacity=".16"><ellipse cx="1180" cy="410" rx="440" ry="180" transform="rotate(-24 1180 410)"/><ellipse cx="1180" cy="410" rx="290" ry="390" transform="rotate(24 1180 410)"/></g><circle cx="1440" cy="220" r="16" fill="#67e8f9"/><circle cx="1040" cy="775" r="8" fill="#fde68a"/><text x="110" y="385" fill="#ede9fe" font-family="sans-serif" font-size="62" letter-spacing="4">LIFESYSTEM</text><text x="114" y="445" fill="#aab1cc" font-family="sans-serif" font-size="26">Seu universo, em movimento.</text><path d="M114 494h80" stroke="#fde68a" stroke-width="3"/><g font-family="sans-serif" font-size="16" fill="#aab1cc"><text x="114" y="770">ÓRBITA · IDENTIDADE ASTRAL</text></g></svg>`);
const mark = await sharp(solar).resize(390).png().toBuffer();
await sharp(backdrop).composite([{ input: mark, left: 960, top: 225 }]).png().toFile('public/brand/solar-cover.png');
console.log('Solar brand assets generated.');
