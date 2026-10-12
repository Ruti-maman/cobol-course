import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, supabaseEnv } from "@/lib/supabase/config";

// מרענן את עוגיות ההתחברות לפני כל בקשה, כדי שההתחברות לא תפוג באמצע שיעור.
// זו לא בדיקת הרשאה: הבדיקה עצמה נעשית בדף השיעור וב-/api/media (lib/access.ts).

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, { ...options, ...authCookieOptions });
        }
      },
    },
  });

  // כניסה מקישור במייל: Supabase מחזיר לאתר עם ?code=… — מחליפים אותו בהתחברות ומנקים את הכתובת.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/api/")) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    const target = request.nextUrl.clone();
    target.search = "";
    target.pathname = "/login";
    if (error) target.searchParams.set("error", "link");
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"],
};
