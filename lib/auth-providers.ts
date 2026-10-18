import { supabaseEnv } from "./supabase/config";

/**
 * האם כניסה עם Google מופעלת ב-Supabase (Authentication → Sign In / Providers).
 * כך הכפתור מופיע רק אחרי שההגדרה הושלמה — ולא מוביל לדף שגיאה. בדיקה חוזרת כל 5 דקות.
 */
export async function isGoogleLoginEnabled(): Promise<boolean> {
  try {
    const { url, key } = supabaseEnv();
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 } });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
