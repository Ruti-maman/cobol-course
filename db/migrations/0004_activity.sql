-- פעילות לומדות: כמה זמן צפו בסרטונים וכמה פעמים נכנסו לשיעורים (לתצוגה בצד הניהול).
-- להריץ פעם אחת ב-Supabase: SQL Editor → להדביק את כל הקובץ → Run. בטוח להריץ שוב (לא מוחק כלום).
-- עד שהקובץ רץ — האתר עובד כרגיל, פשוט לא נאספים נתוני פעילות.

create table if not exists public.learner_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,                       -- היום (לפי שעון ישראל)
  lesson_slug text not null,
  seconds int not null default 0,          -- זמן צפייה בפועל (רק בזמן שהסרטון מתנגן)
  views int not null default 0,            -- כניסות לדף השיעור
  last_seen timestamptz not null default now(),
  primary key (user_id, day, lesson_slug)
);
alter table public.learner_activity enable row level security;
-- בלי מדיניות: רק השרת עם המפתח הסודי קורא וכותב.

-- הוספה אטומית: אותו יום + אותו שיעור = שורה אחת שמצטברת. ערכים מוגבלים כדי שלא אפשר יהיה "לנפח".
create or replace function public.track_learner_activity(p_user uuid, p_slug text, p_seconds int, p_views int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.learner_activity (user_id, day, lesson_slug, seconds, views, last_seen)
  values (p_user, (now() at time zone 'Asia/Jerusalem')::date, p_slug,
          greatest(0, least(p_seconds, 120)), greatest(0, least(p_views, 1)), now())
  on conflict (user_id, day, lesson_slug) do update
    set seconds = learner_activity.seconds + excluded.seconds,
        views = learner_activity.views + excluded.views,
        last_seen = now();
$$;
revoke all on function public.track_learner_activity(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.track_learner_activity(uuid, text, int, int) to service_role;
