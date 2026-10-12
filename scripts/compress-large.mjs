// דוחס סרטונים שגדולים ממגבלת הקובץ באחסון (50MB במסלול החינמי של Supabase).
// התמונה מקודדת מחדש באיכות גבוהה ככל האפשר שעדיין נכנסת במגבלה; השמע מועתק כמו שהוא.
// קובצי המקור לא נדרסים לעולם — הפלט ל-content-compressed/.
//
// שימוש: node scripts/compress-large.mjs
// דורש ffmpeg: משתנה הסביבה FFMPEG, או ffmpeg בנתיב המערכת.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SRC = process.env.CONTENT_DIR || "content-source";
const OUT = process.env.COMPRESSED_DIR || "content-compressed";
const LIMIT = 48 * 1024 * 1024; // מרווח ביטחון מתחת ל-50MB
// אותו סדר עדיפויות כמו באתר: קודם הגרסה עם השמע המשופר / faststart
const inputs = [process.env.ENHANCED_DIR || "content-enhanced", process.env.PROCESSED_DIR || "content-processed", SRC];

function bestInput(dir, file) {
  for (const root of inputs) {
    const candidate = path.join(root, dir, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function encode(input, output, crf) {
  const r = spawnSync(
    FFMPEG,
    ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-map", "0", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
      "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", output],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg נכשל: ${input}`);
}

let done = 0;
for (const dir of fs.readdirSync(SRC).sort()) {
  if (!fs.statSync(path.join(SRC, dir)).isDirectory()) continue;
  for (const file of fs.readdirSync(path.join(SRC, dir)).filter((f) => f.toLowerCase().endsWith(".mp4"))) {
    const input = bestInput(dir, file);
    if (!input || fs.statSync(input).size <= LIMIT) continue;
    const output = path.join(OUT, dir, file);
    if (fs.existsSync(output) && fs.statSync(output).size <= LIMIT) continue;

    fs.mkdirSync(path.dirname(output), { recursive: true });
    const tmp = `${output}.partial.mp4`;
    // מתחילים באיכות גבוהה ומורידים בהדרגה עד שהקובץ נכנס במגבלה
    for (let crf = 23; crf <= 35; crf += 2) {
      process.stdout.write(`${dir}/${file} — CRF ${crf}… `);
      encode(input, tmp, crf);
      const size = fs.statSync(tmp).size;
      console.log(`${(size / 1024 / 1024).toFixed(1)}MB`);
      if (size <= LIMIT) {
        fs.renameSync(tmp, output);
        done++;
        break;
      }
    }
    if (fs.existsSync(tmp)) {
      fs.rmSync(tmp);
      console.log(`✗ ${dir}/${file} — לא הצלחתי להקטין מספיק בלי לפגוע באיכות`);
    }
  }
}
console.log(done ? `נדחסו ${done} סרטונים → ${OUT}/` : "אין סרטונים שגדולים מהמגבלה.");
