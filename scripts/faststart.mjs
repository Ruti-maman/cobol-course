// מעביר את ה-moov לתחילת קובצי MP4 ("faststart") כדי שהסרטון יתחיל לנגן מיד.
// בלי קידוד מחדש — אין שינוי באיכות. קובצי המקור לא נדרסים: הפלט נכתב ל-content-processed/.
//
// שימוש: node scripts/faststart.mjs

import fs from "node:fs";
import path from "node:path";

const srcRoot = "content-source";
const outRoot = "content-processed";

function readBoxes(buf, start, end) {
  const boxes = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header) throw new Error(`box פגום ב-${pos}`);
    boxes.push({ type, pos, size, header });
    pos += size;
  }
  return boxes;
}

const containers = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf"]);

/** מזיז את כל היסטי ה-chunks (stco / co64) בתוך ה-moov ב-delta בתים. */
function shiftChunkOffsets(moov, start, end, delta) {
  for (const box of readBoxes(moov, start, end)) {
    const body = box.pos + box.header;
    if (containers.has(box.type)) {
      shiftChunkOffsets(moov, body, box.pos + box.size, delta);
    } else if (box.type === "stco") {
      const count = moov.readUInt32BE(body + 4);
      for (let i = 0; i < count; i++) {
        const at = body + 8 + i * 4;
        const value = moov.readUInt32BE(at) + delta;
        if (value > 0xffffffff) throw new Error("היסט חורג מ-32 ביט");
        moov.writeUInt32BE(value, at);
      }
    } else if (box.type === "co64") {
      const count = moov.readUInt32BE(body + 4);
      for (let i = 0; i < count; i++) {
        const at = body + 8 + i * 8;
        moov.writeBigUInt64BE(moov.readBigUInt64BE(at) + BigInt(delta), at);
      }
    }
  }
}

function topLevelBoxes(fd, size) {
  const boxes = [];
  const head = Buffer.alloc(16);
  let pos = 0;
  while (pos + 8 <= size) {
    fs.readSync(fd, head, 0, 16, pos);
    let boxSize = head.readUInt32BE(0);
    const type = head.toString("latin1", 4, 8);
    if (boxSize === 1) boxSize = Number(head.readBigUInt64BE(8));
    else if (boxSize === 0) boxSize = size - pos;
    if (boxSize < 8) throw new Error(`box פגום ב-${pos}`);
    boxes.push({ type, pos, size: boxSize });
    pos += boxSize;
  }
  return boxes;
}

function copyRange(fdIn, fdOut, start, length) {
  const chunk = Buffer.alloc(8 * 1024 * 1024);
  let done = 0;
  while (done < length) {
    const n = fs.readSync(fdIn, chunk, 0, Math.min(chunk.length, length - done), start + done);
    fs.writeSync(fdOut, chunk, 0, n);
    done += n;
  }
}

function faststart(input, output) {
  const fdIn = fs.openSync(input, "r");
  try {
    const size = fs.fstatSync(fdIn).size;
    const boxes = topLevelBoxes(fdIn, size);
    const moovIdx = boxes.findIndex((b) => b.type === "moov");
    const mdatIdx = boxes.findIndex((b) => b.type === "mdat");
    if (moovIdx < 0 || mdatIdx < 0) throw new Error("חסר moov או mdat");
    if (moovIdx < mdatIdx) return false; // כבר תקין

    const moovBox = boxes[moovIdx];
    const moov = Buffer.alloc(moovBox.size);
    fs.readSync(fdIn, moov, 0, moovBox.size, moovBox.pos);
    // כל מה שהיה לפני ה-moov זז קדימה בגודל ה-moov
    shiftChunkOffsets(moov, 8, moov.length, moovBox.size);

    fs.mkdirSync(path.dirname(output), { recursive: true });
    const tmp = `${output}.partial`;
    const fdOut = fs.openSync(tmp, "w");
    try {
      const ftyp = boxes[0];
      if (ftyp.type !== "ftyp") throw new Error("הקובץ לא מתחיל ב-ftyp");
      copyRange(fdIn, fdOut, ftyp.pos, ftyp.size);
      fs.writeSync(fdOut, moov);
      for (const box of boxes.slice(1)) {
        if (box.type !== "moov") copyRange(fdIn, fdOut, box.pos, box.size);
      }
    } finally {
      fs.closeSync(fdOut);
    }
    fs.renameSync(tmp, output);
    return true;
  } finally {
    fs.closeSync(fdIn);
  }
}

let fixed = 0;
for (const dir of fs.readdirSync(srcRoot).sort()) {
  const dirPath = path.join(srcRoot, dir);
  if (!fs.statSync(dirPath).isDirectory()) continue;
  for (const file of fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith(".mp4"))) {
    const output = path.join(outRoot, dir, file);
    if (fs.existsSync(output)) continue;
    if (faststart(path.join(dirPath, file), output)) {
      console.log(`✓ ${dir}/${file}`);
      fixed++;
    }
  }
}
console.log(fixed ? `תוקנו ${fixed} סרטונים → ${outRoot}/` : "אין סרטונים שדורשים תיקון.");
