import { notFound, redirect } from "next/navigation";
import { devAccessBypass } from "./access";
import { isAdminEmail } from "./admin-rules";
import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";

// מי מנהלת: משתמשת מחוברת שהמייל שלה ברשימה ADMIN_EMAILS (משתנה סביבה בשרת).
// בלי ADMIN_EMAILS — אף אחת לא מנהלת. כל דף וכל פעולה בצד הניהול בודקים את זה בשרת (CLAUDE.md סעיף 6.1).

export type Admin = { email: string };
type AdminState = { kind: "admin"; admin: Admin } | { kind: "login" } | { kind: "denied" };

async function adminState(): Promise<AdminState> {
  if (devAccessBypass(process.env)) return { kind: "admin", admin: { email: "dev@localhost" } };
  try {
    const { data } = await (await createSupabaseServerClient()).auth.getUser();
    const email = data.user?.email;
    if (!email) return { kind: "login" };
    return isAdminEmail(email, process.env.ADMIN_EMAILS) ? { kind: "admin", admin: { email: email.toLowerCase() } } : { kind: "denied" };
  } catch {
    return { kind: "denied" };
  }
}

/** האם הבקשה הנוכחית היא של מנהלת (בלי להפנות לשום מקום). */
export async function isAdminRequest(): Promise<boolean> {
  return (await adminState()).kind === "admin";
}

/** לדפים ולפעולות של צד הניהול: לא מחוברת → להתחברות; מחוברת שאינה מנהלת → "לא נמצא" (לא חושפים שיש כאן משהו). */
export async function requireAdmin(): Promise<Admin> {
  const state = await adminState();
  if (state.kind === "admin") return state.admin;
  if (state.kind === "login") redirect("/login?next=/admin");
  notFound();
}

/** רישום ביומן הפעולות (CLAUDE.md סעיף 6.6). תקלה ביומן לא עוצרת את הפעולה. */
export async function audit(admin: Admin, action: string, details: Record<string, unknown> = {}): Promise<void> {
  try {
    await createSupabaseAdminClient().from("admin_audit").insert({ admin_email: admin.email, action, details });
  } catch {
    // הטבלה עוד לא נוצרה (0003_admin.sql) — ממשיכים.
  }
}
