import type { User } from "@supabase/supabase-js";
import { isEntitlementActive } from "./admin-rules";
import { createSupabaseAdminClient } from "./supabase/admin";

// שאילתות של צד הניהול — בשרת בלבד, עם המפתח הסודי. נקרא רק אחרי requireAdmin().

export type MigrationStatus = { lessonsTable: boolean; expiryColumn: boolean; auditTable: boolean };

/** האם 0003_admin.sql כבר רץ במסד הנתונים. */
export async function migrationStatus(): Promise<MigrationStatus> {
  const db = createSupabaseAdminClient();
  const [lessons, expiry, auditRes] = await Promise.all([
    db.from("lessons").select("slug").limit(1),
    db.from("lesson_entitlements").select("expires_at").limit(1),
    db.from("admin_audit").select("id").limit(1),
  ]);
  return { lessonsTable: !lessons.error, expiryColumn: !expiry.error, auditTable: !auditRes.error };
}

/** כל המשתמשות הרשומות (מתחברות בקוד למייל). */
export async function listAllUsers(): Promise<User[]> {
  const db = createSupabaseAdminClient();
  const perPage = 1000;
  const all: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return all;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const target = email.trim().toLowerCase();
  return (await listAllUsers()).find((u) => u.email?.toLowerCase() === target);
}

/** המשתמשת לפי מייל — ואם עוד לא נרשמה, יוצרים לה חשבון (היא תתחבר בקוד למייל, בלי סיסמה). */
export async function ensureUser(email: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { data, error } = await createSupabaseAdminClient().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return data.user;
}

export type EntitlementRow = {
  user_id: string;
  lesson_slug: string;
  expires_at: string | null;
  note: string | null;
  created_at: string;
};

export async function allEntitlements(): Promise<EntitlementRow[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("lesson_entitlements")
    .select("user_id, lesson_slug, expires_at, note, created_at");
  if (error) throw error;
  return (data ?? []) as EntitlementRow[];
}

export type ActivityRow = { user_id: string; day: string; seconds: number; views: number; last_seen: string };
export type Activity = { seconds: number; views: number; days: number; lastSeen: string | null };

/** פעילות כל הלומדות (0004_activity.sql). לפני שהקובץ רץ — ריק. */
export async function allActivity(): Promise<ActivityRow[]> {
  const { data, error } = await createSupabaseAdminClient().from("learner_activity").select("user_id, day, seconds, views, last_seen");
  if (error) return [];
  return (data ?? []) as ActivityRow[];
}

export function summarizeActivity(rows: readonly ActivityRow[]): Map<string, Activity> {
  const map = new Map<string, Activity>();
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    const a = map.get(r.user_id) ?? { seconds: 0, views: 0, days: 0, lastSeen: null };
    const d = days.get(r.user_id) ?? new Set<string>();
    d.add(r.day);
    days.set(r.user_id, d);
    a.seconds += r.seconds;
    a.views += r.views;
    a.days = d.size;
    if (!a.lastSeen || r.last_seen > a.lastSeen) a.lastSeen = r.last_seen;
    map.set(r.user_id, a);
  }
  return map;
}

export type LearnerStatus = "active" | "expired" | "pending";

export type Learner = {
  id: string;
  email: string;
  registeredAt: string;
  lastSignIn: string | null;
  lessons: number;
  /** הסיום המאוחר ביותר מבין הזכאויות; null = בלי תאריך סיום */
  expiresAt: string | null;
  note: string | null;
  status: LearnerStatus;
  activity: Activity;
};

/** סיכום לכל לומדת: ממתינה לאישור (נרשמה, אין זכאות) / פעילה / שהתוקף שלה פג. */
const NO_ACTIVITY: Activity = { seconds: 0, views: 0, days: 0, lastSeen: null };

export function summarizeLearners(
  users: readonly User[],
  rows: readonly EntitlementRow[],
  now: number = Date.now(),
  activity: ReadonlyMap<string, Activity> = new Map(),
): Learner[] {
  const byUser = new Map<string, EntitlementRow[]>();
  for (const row of rows) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);

  return users
    .filter((u) => u.email)
    .map((u) => {
      const own = byUser.get(u.id) ?? [];
      const active = own.filter((r) => isEntitlementActive(r.expires_at, now));
      const noEnd = own.some((r) => !r.expires_at);
      const latest = own.reduce<string | null>((max, r) => (r.expires_at && (!max || r.expires_at > max) ? r.expires_at : max), null);
      const status: LearnerStatus = own.length === 0 ? "pending" : active.length ? "active" : "expired";
      return {
        id: u.id,
        email: u.email ?? "",
        registeredAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
        lessons: active.length,
        expiresAt: noEnd ? null : latest,
        note: own.find((r) => r.note)?.note ?? null,
        status,
        activity: activity.get(u.id) ?? NO_ACTIVITY,
      };
    })
    .toSorted((a, b) => b.registeredAt.localeCompare(a.registeredAt));
}

export type AuditEntry = { id: number; admin_email: string; action: string; details: Record<string, unknown>; created_at: string };

export async function recentAudit(limit = 200): Promise<AuditEntry[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("admin_audit")
    .select("id, admin_email, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AuditEntry[];
}

export type MediaRow = { file_name: string; storage_key: string; size_bytes: number; uploaded_at: string };

export async function lessonMedia(dir: string): Promise<MediaRow[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("lesson_media")
    .select("file_name, storage_key, size_bytes, uploaded_at")
    .eq("lesson_dir", dir);
  if (error) return [];
  return (data ?? []) as MediaRow[];
}
