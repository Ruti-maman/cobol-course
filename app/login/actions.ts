"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// התחברות בלי סיסמה (CLAUDE.md סעיף 6.3): עם Google, או בקוד חד-פעמי למייל.
// הגבלת קצב: Supabase מגביל שליחת קודים וניסיונות אימות בצד שלו.

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
};

const emailSchema = z.email();
const codeSchema = z.string().regex(/^\d{6,10}$/);

function isRateLimited(error: { status?: number; code?: string }): boolean {
  return error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit";
}

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");

  if (intent === "change-email") return { step: "email" };

  if (intent === "send") {
    const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
    if (!parsed.success) return { step: "email", error: "כתובת המייל לא תקינה. בדקי ונסי שוב." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return {
        step: "email",
        email: parsed.data,
        error: isRateLimited(error)
          ? "נשלחו יותר מדי קודים. המתיני כמה דקות ונסי שוב."
          : "לא הצלחנו לשלוח את הקוד. נסי שוב בעוד רגע.",
      };
    }
    return { step: "code", email: parsed.data };
  }

  if (intent === "verify") {
    const email = emailSchema.safeParse(prev.email ?? "");
    if (!email.success) return { step: "email", error: "נתחיל מחדש — הקלידי את כתובת המייל." };

    const code = codeSchema.safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
    if (!code.success) return { step: "code", email: email.data, error: "הקוד מורכב מספרות בלבד. בדקי ונסי שוב." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
    if (error) {
      return {
        step: "code",
        email: email.data,
        error: isRateLimited(error) ? "יותר מדי ניסיונות. המתיני כמה דקות ונסי שוב." : "הקוד שגוי או שפג תוקפו.",
      };
    }
    // בלי יעד מפורש — ישר לסרטון האחרון שנצפה ("המשיכי מאיפה שעצרת")
    redirect(safeNextPath(formData.get("next"), "/continue"));
  }

  return { step: "email" };
}

/**
 * כניסה עם Google — בלי מייל ובלי סיסמה של האתר, ולכן בלי מגבלת מיילים בשעה.
 * Google מחזיר ל-/login?code=…, ו-proxy.ts מחליף את הקוד בהתחברות ומעביר ליעד (next).
 */
export async function googleLoginAction(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"), "/continue");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${proto}://${host}/login?next=${encodeURIComponent(next)}`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
