import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const width = 72;
const height = 64;
const transparent = 0;
const palette = [
  [0, 0, 0], [20, 153, 130], [20, 63, 67], [232, 248, 244],
  [223, 114, 102], [255, 229, 223], [255, 255, 255], [105, 169, 218],
  [224, 241, 239], [168, 218, 208], [244, 196, 114], [255, 248, 231],
  [114, 130, 139], [191, 116, 108], [41, 119, 108], [211, 234, 229]
];

const bytes = [];
const push = (...values) => bytes.push(...values);
const pushU16 = (value) => push(value & 0xff, (value >> 8) & 0xff);

function roundedRect(pixels, x, y, w, h, radius, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const dx = Math.max(x + radius - px - 1, 0, px - (x + w - radius));
      const dy = Math.max(y + radius - py - 1, 0, py - (y + h - radius));
      if (dx * dx + dy * dy <= radius * radius && px >= 0 && px < width && py >= 0 && py < height) {
        pixels[py * width + px] = color;
      }
    }
  }
}

function circle(pixels, cx, cy, radius, color) {
  for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py += 1) {
    for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px += 1) {
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2 && px >= 0 && px < width && py >= 0 && py < height) {
        pixels[py * width + px] = color;
      }
    }
  }
}

function bar(pixels, x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      if (px >= 0 && px < width && py >= 0 && py < height) pixels[py * width + px] = color;
    }
  }
}

function frame(index) {
  const pixels = new Uint8Array(width * height);
  const bob = [0, -1, 0, 1][index];
  const pulse = [7, 9, 11, 9][index];

  circle(pixels, 36, 35 + bob, 27, 8);
  roundedRect(pixels, 13, 22 + bob, 46, 29, 10, 1);
  roundedRect(pixels, 17, 26 + bob, 38, 21, 7, 6);
  roundedRect(pixels, 22, 31 + bob, 13, 4, 2, 15);
  roundedRect(pixels, 22, 38 + bob, 25, 3, 2, 15);
  circle(pixels, 47, 32 + bob, 2, 4);
  circle(pixels, 48, 34 + bob, 1, 6);
  bar(pixels, 26, 44 + bob, 20, 2, 9);
  bar(pixels, 14, 52 + bob, 44, 2, 14);
  circle(pixels, 55, 14 + bob, pulse, 5);
  circle(pixels, 55, 14 + bob, 7, 4);
  bar(pixels, 54, 10 + bob, 2, 7, 6);
  bar(pixels, 54, 19 + bob, 2, 2, 6);
  circle(pixels, 12, 15 + bob, index % 2 === 0 ? 2 : 1, 10);

  return pixels;
}

function encodeLzw(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const bits = [];
  const codeSize = minCodeSize + 1;
  const emit = (code) => {
    for (let bit = 0; bit < codeSize; bit += 1) bits.push((code >> bit) & 1);
  };

  // A clear code before every pixel deliberately avoids dictionary growth.
  // The small UI animation remains compact enough, while this form is broadly
  // compatible with the GIF decoders used by mobile browsers.
  for (const index of indices) {
    emit(clearCode);
    emit(index);
  }
  emit(endCode);

  const packed = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let bit = 0; bit < 8 && i + bit < bits.length; bit += 1) value |= bits[i + bit] << bit;
    packed.push(value);
  }
  return packed;
}

push(...Buffer.from('GIF89a'));
pushU16(width);
pushU16(height);
push(0xf3, transparent, 0);
for (const color of palette) push(...color);
push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01, 0x00, 0x00, 0x00);

for (let index = 0; index < 4; index += 1) {
  push(0x21, 0xf9, 0x04, 0x01, 9, 0, transparent, 0x00);
  push(0x2c, 0, 0, 0, 0);
  pushU16(width);
  pushU16(height);
  push(0x00, 0x04);
  const encoded = encodeLzw(frame(index), 4);
  for (let offset = 0; offset < encoded.length; offset += 255) {
    const block = encoded.slice(offset, offset + 255);
    push(block.length, ...block);
  }
  push(0x00);
}

push(0x3b);
const output = resolve(process.cwd(), 'public/images/traffic-depleted.gif');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.from(bytes));
console.log(output);
