-- זכאות לשיעורים: איזו לומדת רשאית לראות איזה שיעור.
-- הזכאות נשמרת לכל שיעור בנפרד — שיעור שיתווסף בעתיד לא נפתח אוטומטית למי שכבר קנתה (CLAUDE.md סעיף 4).
-- שורות נוצרות רק בצד השרת עם מפתח service (בעתיד: מה-webhook של חברת הסליקה, סעיף 6.2).
-- ללומדות אין הרשאת כתיבה: הן יכולות רק לקרוא את הזכאויות של עצמן.

create table if not exists public.lesson_entitlements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_slug text not null,
  source text not null default 'manual',      -- manual / purchase
  payment_ref text,                           -- מזהה העסקה אצל חברת הסליקה
  created_at timestamptz not null default now(),
  unique (user_id, lesson_slug)               -- אותו אירוע פעמיים לא יוצר זכאות כפולה
);

alter table public.lesson_entitlements enable row level security;

drop policy if exists "read own entitlements" on public.lesson_entitlements;
create policy "read own entitlements"
  on public.lesson_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- אין מדיניות insert / update / delete — רק מפתח service (שעוקף RLS) יכול לשנות זכאויות.
