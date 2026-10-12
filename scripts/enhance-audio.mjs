// שיפור השמע בסרטוני הקורס — בלי לגעת במלל.
// הבעיה: השמע בהקלטות חזק מדי — עד 22dB מעל המקסימום — ולכן נשמע צורם ומעוות בנגן.
// מה עושה: הורדת עוצמה אחידה ל-‎-16 LUFS (בדיוק מלא, כך שהחלקים החורגים חוזרים להיות נקיים),
//           ו"תקרה" שמטפלת רק בקפיצות חדות בודדות.
// מה לא עושה (בכוונה): אין הפחתת רעש, אין סינון תדרים ואין שינוי בתזמון.
//   נמדד: הורדת עוצמה + תקרה = 99.9% התאמה לצורת הגל המקורית בתחום הדיבור, הזזה 0ms.
//   סינון תדרים נמוכים הוריד ל-98.5% והגדיל קפיצות — לכן הוסר.
// התמונה מועתקת כמו שהיא. קובצי המקור לא נדרסים לעולם — הפלט ל-content-enhanced/.
//
// שימוש:
//   node scripts/enhance-audio.mjs                       ← כל הסרטונים
//   node scripts/enhance-audio.mjs less1/foo.mp4         ← סרטון אחד
//   node scripts/enhance-audio.mjs --sample less1/foo.mp4 18:45 50   ← דוגמה לפני/אחרי
// דורש ffmpeg: משתנה הסביבה FFMPEG, או ffmpeg בנתיב המערכת.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const SRC = process.env.CONTENT_DIR || "content-source";
const OUT = "content-enhanced";

const TARGET_LUFS = -16; // רמת דיבור מקובלת לסרטונים ברשת
const CEILING_DB = -2; // התקרה לקפיצות (מרווח קטן לקידוד AAC)
const AUDIO_BITRATE = "160k"; // גבוה מהמקור (‎~100k) כדי לא לאבד איכות בקידוד מחדש

function measureLoudness(file, extra = []) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-nostats", ...extra, "-i", file, "-map", "0:a:0", "-af", "ebur128", "-f", "null", "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const summary = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(summary);
  if (!m) throw new Error(`לא הצלחתי למדוד עוצמה: ${file}`);
  return Number(m[1]);
}

function filterChain(measuredLufs) {
  const gain = (TARGET_LUFS - measuredLufs).toFixed(2);
  const limit = Math.pow(10, CEILING_DB / 20).toFixed(4);
  return [
    "aformat=sample_fmts=fltp", // עיבוד בדיוק מלא — החריגות מעל 0dB נשמרות עד שהעוצמה יורדת
    `volume=${gain}dB`,
    // latency=1 — מפצה על ההשהיה של ה-limiter, כך שהשמע נשאר מסונכרן בדיוק לתמונה
    `alimiter=limit=${limit}:attack=5:release=50:level=false:latency=1`,
  ].join(",");
}

function enhance(rel) {
  const input = path.join(SRC, rel);
  const output = path.join(OUT, rel);
  if (fs.existsSync(output)) return console.log(`· קיים כבר: ${rel}`);
  const lufs = measureLoudness(input);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const tmp = output.replace(/\.mp4$/i, ".partial.mp4");
  execFileSync(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy",
    "-af", filterChain(lufs), "-c:a", "aac", "-b:a", AUDIO_BITRATE, "-ar", "48000",
    "-map_metadata", "0", "-movflags", "+faststart", tmp,
  ]);
  fs.renameSync(tmp, output);
  console.log(`✓ ${rel}  (${lufs} → ${TARGET_LUFS} LUFS)`);
}

function sample(rel, start, seconds) {
  const input = path.join(SRC, rel);
  const dir = "audio-samples";
  fs.mkdirSync(dir, { recursive: true });
  const lufs = measureLoudness(input); // מדידה על כל הסרטון — אותה הגברה כמו בעיבוד המלא
  const base = ["-hide_banner", "-loglevel", "error", "-y", "-ss", start, "-t", String(seconds), "-i", input, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast"];
  // "לפני": השמע המקורי כמו שהוא (העתקה בלי קידוד מחדש — קידוד מחדש של המקור עצמו כבר פוגע בו)
  execFileSync(FFMPEG, [...base, "-c:a", "copy", path.join(dir, "לפני.mp4")]);
  execFileSync(FFMPEG, [...base, "-af", filterChain(lufs), "-c:a", "aac", "-b:a", AUDIO_BITRATE, path.join(dir, "אחרי.mp4")]);
  console.log(`דוגמה מוכנה ב-${dir}/ (לפני.mp4, אחרי.mp4) — ${rel} מ-${start}, ${seconds} שניות`);
}

const args = process.argv.slice(2);
if (args[0] === "--sample") {
  sample(args[1], args[2] ?? "0", Number(args[3] ?? 40));
} else if (args.length) {
  args.forEach(enhance);
} else {
  for (const dir of fs.readdirSync(SRC).sort()) {
    const d = path.join(SRC, dir);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.toLowerCase().endsWith(".mp4"))) enhance(path.join(dir, f));
  }
}
