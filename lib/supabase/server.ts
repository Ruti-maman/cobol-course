import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authCookieOptions, supabaseEnv } from "./config";

// לקוח Supabase לצד השרת (דפים, routes, Server Actions). לקוח חדש לכל בקשה — לעולם לא משותף.
// ההתחברות נשמרת בעוגיות HttpOnly; הקוד בדפדפן לא ניגש אליהן.

export async function createSupabaseServerClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, { ...options, ...authCookieOptions });
          }
        } catch {
          // בתוך רכיב שרת אי אפשר לכתוב עוגיות — proxy.ts מרענן את ההתחברות בכל בקשה.
        }
      },
    },
  });
}
