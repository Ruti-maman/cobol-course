import { z } from "zod";
import { getLessonAccess } from "@/lib/access-server";
import { isAdminEmail } from "@/lib/admin-rules";
import { MAX_SECONDS_PER_REPORT } from "@/lib/watch-time";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// דיווח פעילות מהנגן (components/useWatchTime.ts): כניסה לשיעור / זמן צפייה. נשמר רק למשתמשת מחוברת
// עם גישה לשיעור, לא למנהלת. תמיד מחזיר 204 — הנגן לא מחכה לתשובה ולא מושפע מתקלה כאן.

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  seconds: z.number().int().min(0).max(MAX_SECONDS_PER_REPORT),
  view: z.boolean(),
});

const done = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || (!parsed.data.seconds && !parsed.data.view)) return done();
    const { data } = await (await createSupabaseServerClient()).auth.getUser();
    const user = data.user;
    if (!user || isAdminEmail(user.email, process.env.ADMIN_EMAILS)) return done();
    if ((await getLessonAccess(parsed.data.slug)) !== "ok") return done();
    await createSupabaseAdminClient().rpc("track_learner_activity", {
      p_user: user.id,
      p_slug: parsed.data.slug,
      p_seconds: parsed.data.seconds,
      p_views: parsed.data.view ? 1 : 0,
    });
  } catch {
    // הטבלה עוד לא נוצרה (0004_activity.sql) או תקלה זמנית — מתעלמים.
  }
  return done();
}
