// מעלה את קובצי השיעורים (סרטונים ומטלות) לאחסון הפרטי ב-Supabase, ורושם אותם בטבלה lesson_media.
// לכל קובץ נבחרת הגרסה הטובה ביותר שקיימת: דחוסה → שמע משופר → faststart → מקור (כמו באתר במחשב).
// בטוח להריץ שוב: קובץ שכבר עלה באותו גודל — מדלגים. שום דבר לא נמחק.
//
// שימוש: node --env-file=.env.local scripts/upload-media.mjs
// דורש ב-.env.local: NEXT_PUBLIC_SUPABASE_URL ו-SUPABASE_SECRET_KEY.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "course-media";
const MAX_BYTES = 50 * 1024 * 1024; // מגבלת קובץ במסלול החינמי של Supabase

const srcRoot = process.env.CONTENT_DIR || "content-source";
const preferredRoots = [
  process.env.COMPRESSED_DIR || "content-compressed",
  process.env.ENHANCED_DIR || "content-enhanced",
  process.env.PROCESSED_DIR || "content-processed",
];

const contentTypes = {
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("חסרים NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SECRET_KEY ב-.env.local");
  process.exit(1);
}
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

/** מפתח באנגלית בלבד — האחסון לא מקבל שמות קבצים בעברית. */
function storageKey(dir, file) {
  const hash = createHash("sha256").update(`${dir}/${file}`).digest("hex").slice(0, 20);
  return `${dir}/${hash}${path.extname(file).toLowerCase()}`;
}

function bestVersion(dir, file) {
  for (const root of preferredRoots) {
    const candidate = path.join(root, dir, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(srcRoot, dir, file);
}

const { data: existingRows, error: listError } = await supabase.from("lesson_media").select("lesson_dir, file_name, size_bytes");
if (listError) {
  console.error(`לא הצלחתי לקרוא את הטבלה lesson_media: ${listError.message}`);
  console.error("האם הורצה המיגרציה db/migrations/0002_lesson_media.sql?");
  process.exit(1);
}
const existing = new Map(existingRows.map((r) => [`${r.lesson_dir}/${r.file_name}`, r.size_bytes]));

let uploaded = 0;
let skipped = 0;
const tooBig = [];
const failed = [];

for (const dir of fs.readdirSync(srcRoot).sort()) {
  if (!fs.statSync(path.join(srcRoot, dir)).isDirectory()) continue;
  for (const file of fs.readdirSync(path.join(srcRoot, dir)).sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!contentTypes[ext] || file.startsWith("~$")) continue;

    const local = bestVersion(dir, file);
    const size = fs.statSync(local).size;
    if (size > MAX_BYTES) {
      tooBig.push(`${dir}/${file} (${(size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    if (existing.get(`${dir}/${file}`) === size) {
      skipped++;
      continue;
    }

    const key = storageKey(dir, file);
    process.stdout.write(`↑ ${dir}/${file} (${(size / 1024 / 1024).toFixed(1)}MB)… `);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, fs.readFileSync(local), { contentType: contentTypes[ext], upsert: true, cacheControl: "3600" });
    if (upErr) {
      console.log(`נכשל: ${upErr.message}`);
      failed.push(`${dir}/${file}`);
      continue;
    }
    const { error: rowErr } = await supabase
      .from("lesson_media")
      .upsert({ lesson_dir: dir, file_name: file, storage_key: key, size_bytes: size }, { onConflict: "lesson_dir,file_name" });
    if (rowErr) {
      console.log(`עלה, אבל הרישום נכשל: ${rowErr.message}`);
      failed.push(`${dir}/${file}`);
      continue;
    }
    console.log("✓");
    uploaded++;
  }
}

console.log(`\nהועלו: ${uploaded} · כבר היו: ${skipped}`);
if (tooBig.length) console.log(`גדולים מדי (מעל 50MB) — צריך לדחוס עם scripts/compress-large.mjs:\n  ${tooBig.join("\n  ")}`);
if (failed.length) {
  console.log(`נכשלו:\n  ${failed.join("\n  ")}`);
  process.exit(1);
}
