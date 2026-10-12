import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./config";

// לקוח עם המפתח הסודי — עוקף RLS. בצד השרת בלבד: אסור לייבא את הקובץ הזה מרכיב לקוח,
// והמפתח לעולם לא מתחיל ב-NEXT_PUBLIC_ (כדי שלא ייארז לדפדפן). CLAUDE.md סעיף 6.6.

export function createSupabaseAdminClient() {
  const { url } = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("חסר SUPABASE_SECRET_KEY — ראו .env.example");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
