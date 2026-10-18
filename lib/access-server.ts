import { cookies } from "next/headers";
import { devAccessBypass, loadLessonAccess, type AccessSource, type LessonAccess } from "./access";
import { activeSlugs, isAdminEmail } from "./admin-rules";
import { isValidReviewPass, parseReviewCookie, REVIEW_COOKIE } from "./review";
import { createSupabaseServerClient } from "./supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type EntitlementRow = { lesson_slug: string; expires_at?: string | null };

function supabaseAccessSource(supabase: ServerClient, userId: string | null): AccessSource {
  return {
    async currentUserId() {
      return userId;
    },
    async entitledLessons(userId, lessonSlugs) {
      // RLS מחזיר רק שורות של המשתמשת המחוברת; הסינון לפי user_id הוא שכבת הגנה נוספת.
      const query = (columns: string) =>
        supabase.from("lesson_entitlements").select(columns).eq("user_id", userId).in("lesson_slug", [...lessonSlugs]);
      let { data, error } = await query("lesson_slug, expires_at");
      // עמודת התוקף נוספת ב-0003_admin.sql; עד שהקובץ רץ — זכאויות בלי תוקף, כמו קודם.
      if (error?.code === "42703") ({ data, error } = await query("lesson_slug"));
      if (error || !data) return null;
      return activeSlugs(data as unknown as EntitlementRow[]);
    },
  };
}

/** קישור בדיקה בתוקף (lib/review.ts) — נבדק מול הסוד שבשרת בכל בקשה. */
async function hasReviewPass(): Promise<boolean> {
  const { until, sig } = parseReviewCookie((await cookies()).get(REVIEW_COOKIE)?.value);
  return isValidReviewPass(process.env.REVIEW_SECRET, until, sig);
}

/** בדיקת זכאות לשיעור עבור הבקשה הנוכחית (לפי עוגיות ההתחברות). */
export async function getLessonAccess(lessonSlug: string): Promise<LessonAccess> {
  if (devAccessBypass(process.env)) return "ok";
  try {
    if (await hasReviewPass()) return "ok";
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    // המנהלת רואה כל שיעור (גם טיוטה, לתצוגה מקדימה).
    if (isAdminEmail(data.user?.email, process.env.ADMIN_EMAILS)) return "ok";
    return await loadLessonAccess(supabaseAccessSource(supabase, data.user?.id ?? null), lessonSlug);
  } catch {
    return "forbidden";
  }
}
