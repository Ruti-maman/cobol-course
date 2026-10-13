import { cookies } from "next/headers";
import { devAccessBypass, loadLessonAccess, type AccessSource, type LessonAccess } from "./access";
import { isValidReviewPass, parseReviewCookie, REVIEW_COOKIE } from "./review";
import { createSupabaseServerClient } from "./supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function supabaseAccessSource(supabase: ServerClient): AccessSource {
  return {
    async currentUserId() {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    async entitledLessons(userId, lessonSlugs) {
      // RLS מחזיר רק שורות של המשתמשת המחוברת; הסינון לפי user_id הוא שכבת הגנה נוספת.
      const { data, error } = await supabase
        .from("lesson_entitlements")
        .select("lesson_slug")
        .eq("user_id", userId)
        .in("lesson_slug", [...lessonSlugs]);
      if (error || !data) return null;
      return data.map((row: { lesson_slug: string }) => row.lesson_slug);
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
    return await loadLessonAccess(supabaseAccessSource(await createSupabaseServerClient()), lessonSlug);
  } catch {
    return "forbidden";
  }
}
