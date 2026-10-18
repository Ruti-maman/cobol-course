-- צד המנהלת: תוקף לזכאות, שיעורים במסד הנתונים, ויומן פעולות.
-- להריץ פעם אחת ב-Supabase: SQL Editor → להדביק את כל הקובץ → Run. בטוח להריץ שוב (לא מוחק כלום).
-- עד שהקובץ רץ — האתר ממשיך לעבוד בדיוק כמו היום (השיעורים נקראים מהקוד, הזכאויות בלי תוקף).

-- ── 1. תוקף לזכאות (למשל: שנה מיום האישור) ─────────────────────────────
alter table public.lesson_entitlements add column if not exists expires_at timestamptz;  -- null = בלי תאריך סיום
alter table public.lesson_entitlements add column if not exists granted_by text;         -- המייל של המנהלת שאישרה
alter table public.lesson_entitlements add column if not exists note text;               -- הערה, למשל אסמכתת תשלום

-- ── 2. השיעורים — מנוהלים מממשק הניהול, בלי פריסה מחדש (CLAUDE.md סעיף 4) ──
create table if not exists public.lessons (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  position int not null,
  kind text not null default 'lesson' check (kind in ('intro', 'lesson')),
  title text not null,
  summary text not null default '',
  topics text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  source_dir text not null unique check (source_dir ~ '^[a-z0-9-]+$'),  -- התיקייה באחסון (less0, less8…)
  video_count int not null default 0,       -- לתצוגה בלבד; מתעדכן אוטומטית מהקבצים כשאפשר
  assignment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lessons enable row level security;
drop policy if exists "read published lessons" on public.lessons;
create policy "read published lessons" on public.lessons for select to anon, authenticated using (status = 'published');
-- כתיבה: רק השרת עם המפתח הסודי (ממשק הניהול).

-- השיעורים הקיימים — בדיוק כמו באתר היום, כך שאחרי ההרצה שום דבר לא משתנה.
insert into public.lessons (slug, position, kind, title, summary, topics, status, source_dir, video_count, assignment_count) values
  ('setup', 0, 'intro', 'התקנת סביבת עבודה', 'הכנת המחשב לכתיבה, קומפילציה והרצה של תכניות COBOL.', array['סביבת עבודה','סילבוס'], 'published', 'less0', 1, 0),
  ('program-structure', 1, 'lesson', 'מבנה תכנית COBOL ופקודות בסיס', 'חלקי ה-DIVISION וה-SECTION, עמודות הקידוד, הגדרת משתנים ופקודות ראשונות.', array['DIVISION','SECTION','PIC','MOVE','COMPUTE','DISPLAY','ACCEPT','PERFORM'], 'published', 'less1', 4, 1),
  ('conditions', 2, 'lesson', 'תנאים והיררכיית משתנים', 'התניות וקינון, רמות משתנים ו-GROUP ITEMS, ערכים מותנים ואתחול.', array['IF','EVALUATE','01 / 03','88','VALUE','INITIALIZE'], 'published', 'less2', 3, 1),
  ('debug-advanced', 3, 'lesson', 'דיבאג והגדרות מתקדמות', 'עבודה עם נקודות עצירה, ופקודות והגדרות מתקדמות לעבודה עם נתונים.', array['DEBUG','BREAK POINT','REDEFINES','DATE / TIME','MOVE CORRESPONDING'], 'published', 'less3', 2, 1),
  ('arrays-loops', 4, 'lesson', 'מערכים ולולאות', 'מערכים ואינדקסים, ארגון ה-WORKING-STORAGE ולולאות מכל הסוגים.', array['OCCURS','INDEX','PERFORM TIMES','PERFORM UNTIL','PERFORM VARYING'], 'published', 'less4', 3, 1),
  ('files', 5, 'lesson', 'עבודה עם קבצים', 'הגדרת קבצים, פתיחה, קריאה וכתיבה, ולולאות על קבצים.', array['FD','FILE STATUS','OPEN / CLOSE','READ INTO','WRITE FROM'], 'published', 'less5', 4, 1),
  ('subprograms', 6, 'lesson', 'תתי-תכניות ורוטינות שירות', 'קריאה לתכניות אחרות והעברת נתונים ביניהן.', array['CALL','USING','LINKAGE SECTION'], 'published', 'less6', 3, 1),
  ('indexed-files-final', 7, 'lesson', 'קובץ ממופתח ופרויקט סיום', 'עדכון קובץ ממופתח, וסיכום כל החומר בפרויקט מסכם.', array['INDEXED','INVALID KEY','REWRITE','פרויקט סיום'], 'published', 'less7', 5, 1)
on conflict (slug) do nothing;

-- ── 3. יומן פעולות של המנהלת (CLAUDE.md סעיף 6.6) ─────────────────────
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  admin_email text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
-- בלי מדיניות: רק השרת עם המפתח הסודי קורא וכותב.

-- ── 4. סדר וכותרת לקבצים (לא חובה; בלי ערך — לפי שם הקובץ כמו היום) ──
alter table public.lesson_media add column if not exists position int;
