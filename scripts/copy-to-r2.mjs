// העתקת כל קובצי הקורס מהאחסון ב-Supabase ל-Cloudflare R2 — אותם קבצים בדיוק, באותם מפתחות.
// לא מוחק כלום ב-Supabase (כך שאפשר לחזור אחורה מיד). קובץ שכבר קיים ב-R2 באותו גודל — מדולג.
//
// הרצה:  NODE_OPTIONS=--use-system-ca node --env-file=.env.local scripts/copy-to-r2.mjs
//        (עם --check — רק בדיקה, בלי להעתיק)
// דרוש ב-.env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY [R2_BUCKET]

import { createHash, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter((k) => !env[k]);
if (missing.length) {
  console.error(`חסרות הגדרות ב-.env.local: ${missing.join(", ")}`);
  process.exit(1);
}
const checkOnly = process.argv.includes("--check");
const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const bucket = env.R2_BUCKET || "course-media";

// ── חתימת S3 (זהה ל-lib/sigv4.ts) ──
const enc = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256 = (d) => createHash("sha256").update(d, "utf8").digest("hex");
const hmac = (k, d) => createHmac("sha256", k).update(d, "utf8").digest();
function presign(method, key, expires = 900) {
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const params = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${env.R2_ACCESS_KEY_ID}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const query = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join("&");
  const path = `/${bucket}/${key}`.split("/").map(enc).join("/");
  const canonical = [method, path, query, `host:${host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  let k = hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, day);
  for (const part of ["auto", "s3", "aws4_request"]) k = hmac(k, part);
  return `https://${host}${path}?${query}&X-Amz-Signature=${createHmac("sha256", k).update(toSign, "utf8").digest("hex")}`;
}
async function r2Size(key) {
  const res = await fetch(presign("HEAD", key), { method: "HEAD" });
  return res.ok ? Number(res.headers.get("content-length")) : undefined;
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: rows, error } = await db.from("lesson_media").select("lesson_dir, file_name, storage_key, size_bytes").order("storage_key");
if (error) {
  console.error("לא הצלחנו לקרוא את רשימת הקבצים:", error.message);
  process.exit(1);
}

let ok = 0;
let copied = 0;
let failed = 0;
for (const row of rows) {
  const label = `${row.lesson_dir}/${row.file_name}`;
  const have = await r2Size(row.storage_key);
  if (have === Number(row.size_bytes)) {
    ok++;
    console.log(`✓ כבר קיים  ${label}`);
    continue;
  }
  if (checkOnly) {
    failed++;
    console.log(`✗ חסר ב-R2  ${label}`);
    continue;
  }
  const { data: blob, error: dlError } = await db.storage.from("course-media").download(row.storage_key);
  if (dlError || !blob) {
    failed++;
    console.log(`✗ הורדה נכשלה  ${label}: ${dlError?.message ?? ""}`);
    continue;
  }
  const put = await fetch(presign("PUT", row.storage_key), { method: "PUT", body: blob, headers: { "Content-Type": blob.type || "application/octet-stream" } });
  const after = put.ok ? await r2Size(row.storage_key) : undefined;
  if (after === blob.size) {
    copied++;
    console.log(`↑ הועתק  ${label} (${(blob.size / 1048576).toFixed(1)}MB)`);
  } else {
    failed++;
    console.log(`✗ העלאה נכשלה  ${label}: HTTP ${put.status}`);
  }
}
console.log(`\nסיכום: ${ok} כבר היו, ${copied} הועתקו, ${failed} נכשלו — מתוך ${rows.length}.`);
process.exit(failed ? 1 : 0);
