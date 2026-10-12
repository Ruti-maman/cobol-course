-- קובצי השיעורים באחסון הפרטי של Supabase (סרטונים ומטלות).
-- הקבצים עצמם בדלי הפרטי course-media; כאן רשום איזה קובץ שייך לאיזה שיעור.
-- שמות המפתחות באחסון באנגלית (גיבוב של שם הקובץ), כי האחסון לא מקבל שמות בעברית.
-- נכתב על ידי scripts/upload-media.mjs. אין גישה ללומדות — רק לשרת עם המפתח הסודי.

create table if not exists public.lesson_media (
  id bigint generated always as identity primary key,
  lesson_dir text not null,          -- תיקיית השיעור, למשל less1 (Lesson.sourceDir)
  file_name text not null,           -- שם הקובץ המקורי, כפי שמוצג באתר
  storage_key text not null unique,  -- המיקום בדלי course-media
  size_bytes bigint not null,
  uploaded_at timestamptz not null default now(),
  unique (lesson_dir, file_name)
);

alter table public.lesson_media enable row level security;
-- בלי מדיניות בכלל: לומדות לא קוראות את הטבלה ישירות; השרת קורא אותה עם המפתח הסודי.

-- הדלי הפרטי. 50MB — המגבלה במסלול החינמי.
insert into storage.buckets (id, name, public, file_size_limit)
values ('course-media', 'course-media', false, 52428800)
on conflict (id) do nothing;
