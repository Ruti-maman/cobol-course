// בדיקה מהירה של האחסון הפרטי: כמה קבצים רשומים, שקישור חתום עובד, ושבלי קישור כזה אין גישה.
// שימוש: node --env-file=.env.local scripts/check-media.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const s = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data: rows, error } = await s.from("lesson_media").select("lesson_dir, file_name, storage_key");
if (error) throw new Error(error.message);
console.log(`רשומים: ${rows.length} קבצים`);

const sample = rows.find((r) => r.file_name.endsWith(".mp4"));
const { data } = await s.storage.from("course-media").createSignedUrl(sample.storage_key, 60);
const signed = await fetch(data.signedUrl, { headers: { Range: "bytes=0-99" } });
console.log(`קישור חתום: ${signed.status} ${signed.headers.get("content-type")} (${sample.lesson_dir}/${sample.file_name})`);

const open = await fetch(`${url}/storage/v1/object/public/course-media/${sample.storage_key}`);
console.log(`גישה בלי קישור חתום: ${open.status} ${open.ok ? "✗ פתוח לציבור!" : "✓ חסום"}`);
