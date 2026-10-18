"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { allEntitlements, ensureUser, type EntitlementRow } from "@/lib/admin-data";
import {
  extendExpiry,
  isEntitlementActive,
  nextSourceDir,
  parseTopics,
  storageKey,
  UPLOAD_TYPES,
  fileExt,
  validateUpload,
} from "@/lib/admin-rules";
import { audit, requireAdmin } from "@/lib/admin-server";
import { loadPublishedLessons } from "@/lib/lessons-store";
import { MEDIA_BUCKET } from "@/lib/media-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// פעולות צד הניהול. כל פעולה בודקת מחדש בשרת שהמשתמשת מנהלת (requireAdmin), מאמתת קלט (zod)
// ונרשמת ביומן הפעולות. פעולה היא כתובת ציבורית — אסור לסמוך על כך שרק דף הניהול קורא לה.

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params)}`);
}

function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.code === "42P01" || error?.code === "PGRST205";
}

/** כל שינוי בשיעורים — מרענן את האתר כולו (דף הבית, דפי השיעורים). */
function refreshSite() {
  revalidatePath("/", "layout");
}

// ── לומדות ─────────────────────────────────────────────────────────────

const grantSchema = z.object({
  email: z.email().max(200),
  days: z.coerce.number().int().min(1).max(3650),
  note: z.string().trim().max(300),
});

/** אישור מייל: פותח את כל השיעורים המפורסמים כרגע, לתקופה שנבחרה (ברירת מחדל: שנה). */
export async function grantAccess(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = grantSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    days: formData.get("days") ?? 365,
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) back("/admin/learners", { err: "email" });
  const { email, days, note } = parsed.data;

  let user: User;
  try {
    user = await ensureUser(email);
  } catch {
    back("/admin/learners", { err: "user" });
  }
  const lessons = await loadPublishedLessons();
  const expiresAt = extendExpiry(null, days);
  const { error } = await createSupabaseAdminClient()
    .from("lesson_entitlements")
    .upsert(
      lessons.map((l) => ({
        user_id: user.id,
        lesson_slug: l.slug,
        source: "manual",
        expires_at: expiresAt,
        granted_by: admin.email,
        note: note || null,
      })),
      { onConflict: "user_id,lesson_slug" },
    );
  if (error) back("/admin/learners", { err: isMissingColumn(error) ? "migration" : "db" });

  await audit(admin, "grant", { email, days, lessons: lessons.map((l) => l.slug), expiresAt, note });
  back("/admin/learners", { ok: "granted", email });
}

const userSchema = z.object({ userId: z.uuid(), email: z.string().max(200) });

/** הארכה: מהסיום הנוכחי אם עוד בתוקף, אחרת מהיום. רק לשיעורים שכבר פתוחים לה. */
export async function extendAccess(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = userSchema.extend({ days: z.coerce.number().int().min(1).max(3650) }).safeParse({
    userId: formData.get("userId"),
    email: formData.get("email") ?? "",
    days: formData.get("days") ?? 365,
  });
  if (!parsed.success) back("/admin/learners", { err: "input" });
  const { userId, email, days } = parsed.data;

  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("lesson_entitlements").select("expires_at").eq("user_id", userId);
  if (error) back("/admin/learners", { err: isMissingColumn(error) ? "migration" : "db" });
  const latest = (data as { expires_at: string | null }[])
    .map((r) => r.expires_at)
    .filter((d): d is string => !!d && isEntitlementActive(d))
    .toSorted()
    .at(-1);
  const expiresAt = extendExpiry(latest ?? null, days);
  const upd = await db.from("lesson_entitlements").update({ expires_at: expiresAt, granted_by: admin.email }).eq("user_id", userId);
  if (upd.error) back("/admin/learners", { err: "db" });

  await audit(admin, "extend", { email, userId, days, expiresAt });
  back("/admin/learners", { ok: "extended", email });
}

/** ביטול גישה: מוחק את כל הזכאויות של הלומדת. החשבון עצמו נשאר. */
export async function revokeAccess(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = userSchema.safeParse({ userId: formData.get("userId"), email: formData.get("email") ?? "" });
  if (!parsed.success) back("/admin/learners", { err: "input" });
  const { userId, email } = parsed.data;
  const { error } = await createSupabaseAdminClient().from("lesson_entitlements").delete().eq("user_id", userId);
  if (error) back("/admin/learners", { err: "db" });
  await audit(admin, "revoke", { email, userId });
  back("/admin/learners", { ok: "revoked", email });
}

/** הסרת לומדת: מוחק את החשבון כולו — זכאויות ונתוני פעילות נמחקים איתו. אם תתחבר שוב, תופיע כחדשה. */
export async function deleteLearner(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = userSchema.safeParse({ userId: formData.get("userId"), email: formData.get("email") ?? "" });
  if (!parsed.success) back("/admin/learners", { err: "input" });
  const { userId, email } = parsed.data;
  if (email.toLowerCase() === admin.email) back("/admin/learners", { err: "self" });
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(userId);
  if (error) back("/admin/learners", { err: "db" });
  await audit(admin, "learner.delete", { email, userId });
  back("/admin/learners", { ok: "removed", email });
}

// ── שיעורים ────────────────────────────────────────────────────────────

const lessonFields = z.object({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(400),
  topics: z.string().max(600),
});
const slugSchema = z.string().regex(/^[a-z0-9-]{1,60}$/);

type DbLesson = { slug: string; position: number; status: string; source_dir: string };

async function dbLessons(): Promise<DbLesson[] | null> {
  const { data, error } = await createSupabaseAdminClient().from("lessons").select("slug, position, status, source_dir").order("position");
  return error ? null : (data as DbLesson[]);
}

export async function createLesson(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = lessonFields.safeParse({
    title: formData.get("title") ?? "",
    summary: formData.get("summary") ?? "",
    topics: formData.get("topics") ?? "",
  });
  if (!parsed.success) back("/admin/lessons", { err: "title" });
  const existing = await dbLessons();
  if (!existing) back("/admin/lessons", { err: "migration" });

  const slugs = new Set(existing.map((l) => l.slug));
  let n = existing.length;
  while (slugs.has(`lesson-${n}`)) n++;
  const slug = `lesson-${n}`;
  const row = {
    slug,
    position: existing.reduce((max, l) => Math.max(max, l.position), -1) + 1,
    kind: "lesson",
    title: parsed.data.title,
    summary: parsed.data.summary,
    topics: parseTopics(parsed.data.topics),
    status: "draft",
    source_dir: nextSourceDir(existing.map((l) => l.source_dir)),
  };
  const { error } = await createSupabaseAdminClient().from("lessons").insert(row);
  if (error) back("/admin/lessons", { err: "db" });
  await audit(admin, "lesson.create", { slug, title: row.title });
  back(`/admin/lessons/${slug}`, { ok: "created" });
}

export async function updateLesson(formData: FormData) {
  const admin = await requireAdmin();
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) back("/admin/lessons", { err: "input" });
  const parsed = lessonFields.safeParse({
    title: formData.get("title") ?? "",
    summary: formData.get("summary") ?? "",
    topics: formData.get("topics") ?? "",
  });
  if (!parsed.success) back(`/admin/lessons/${slug.data}`, { err: "title" });
  const { error } = await createSupabaseAdminClient()
    .from("lessons")
    .update({ title: parsed.data.title, summary: parsed.data.summary, topics: parseTopics(parsed.data.topics), updated_at: new Date().toISOString() })
    .eq("slug", slug.data);
  if (error) back(`/admin/lessons/${slug.data}`, { err: isMissingColumn(error) ? "migration" : "db" });
  await audit(admin, "lesson.update", { slug: slug.data, title: parsed.data.title });
  refreshSite();
  back(`/admin/lessons/${slug.data}`, { ok: "saved" });
}

export async function setLessonStatus(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({ slug: slugSchema, status: z.enum(["draft", "published"]), from: z.enum(["list", "edit"]) })
    .safeParse({ slug: formData.get("slug"), status: formData.get("status"), from: formData.get("from") ?? "list" });
  if (!parsed.success) back("/admin/lessons", { err: "input" });
  const { slug, status, from } = parsed.data;
  const path = from === "edit" ? `/admin/lessons/${slug}` : "/admin/lessons";
  const { error } = await createSupabaseAdminClient().from("lessons").update({ status, updated_at: new Date().toISOString() }).eq("slug", slug);
  if (error) back(path, { err: isMissingColumn(error) ? "migration" : "db" });
  await audit(admin, status === "published" ? "lesson.publish" : "lesson.hide", { slug });
  refreshSite();
  back(path, { ok: status === "published" ? "published" : "hidden" });
}

export async function moveLesson(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z.object({ slug: slugSchema, dir: z.enum(["up", "down"]) }).safeParse({ slug: formData.get("slug"), dir: formData.get("dir") });
  if (!parsed.success) back("/admin/lessons", { err: "input" });
  const list = await dbLessons();
  if (!list) back("/admin/lessons", { err: "migration" });
  const i = list.findIndex((l) => l.slug === parsed.data.slug);
  const j = parsed.data.dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) back("/admin/lessons", {});
  const order = [...list];
  [order[i], order[j]] = [order[j] as DbLesson, order[i] as DbLesson];
  const db = createSupabaseAdminClient();
  for (const [position, lesson] of order.entries()) {
    if (lesson.position === position) continue;
    const { error } = await db.from("lessons").update({ position }).eq("slug", lesson.slug);
    if (error) back("/admin/lessons", { err: "db" });
  }
  await audit(admin, "lesson.move", { slug: parsed.data.slug, dir: parsed.data.dir });
  refreshSite();
  back("/admin/lessons", { ok: "moved" });
}

/**
 * שיעור חדש לא נפתח אוטומטית למי שכבר קנתה (CLAUDE.md סעיף 4).
 * הפעולה הזו — החלטה מפורשת של המנהלת — פותחת אותו לכל מי שיש לה גישה פעילה, עד אותו תאריך סיום.
 */
export async function openLessonToLearners(formData: FormData) {
  const admin = await requireAdmin();
  const slug = slugSchema.safeParse(formData.get("slug"));
  if (!slug.success) back("/admin/lessons", { err: "input" });
  const path = `/admin/lessons/${slug.data}`;

  let rows: EntitlementRow[];
  try {
    rows = await allEntitlements();
  } catch {
    back(path, { err: "migration" });
  }
  const until = new Map<string, string | null>();
  for (const r of rows) {
    if (!isEntitlementActive(r.expires_at)) continue;
    const prev = until.get(r.user_id);
    if (prev === null) continue; // יש לה גישה בלי תאריך סיום
    until.set(r.user_id, !r.expires_at ? null : !prev || r.expires_at > prev ? r.expires_at : prev);
  }
  if (until.size) {
    const { error } = await createSupabaseAdminClient()
      .from("lesson_entitlements")
      .upsert(
        [...until].map(([user_id, expires_at]) => ({ user_id, lesson_slug: slug.data, source: "manual", expires_at, granted_by: admin.email })),
        { onConflict: "user_id,lesson_slug" },
      );
    if (error) back(path, { err: "db" });
  }
  await audit(admin, "lesson.open-to-all", { slug: slug.data, learners: until.size });
  back(path, { ok: "opened", count: String(until.size) });
}

// ── קבצים (סרטונים ומטלות) ───────────────────────────────────────────

type DirResult = { dir: string } | { error: string };

async function lessonDir(slug: string): Promise<DirResult> {
  if (!slugSchema.safeParse(slug).success) return { error: "שיעור לא תקין." };
  const { data, error } = await createSupabaseAdminClient().from("lessons").select("source_dir").eq("slug", slug).maybeSingle();
  if (error) return { error: "יש להריץ קודם את קובץ ההגדרה 0003_admin.sql במסד הנתונים." };
  if (!data) return { error: "השיעור לא נמצא." };
  return { dir: (data as { source_dir: string }).source_dir };
}

export type UploadTicket = { url: string; contentType: string } | { error: string };

/** שלב 1 בהעלאה: קישור חתום וזמני להעלאה ישירה מהדפדפן לאחסון הפרטי (הקובץ לא עובר דרך השרת שלנו). */
export async function createUploadUrl(slug: string, fileName: string, size: number): Promise<UploadTicket> {
  await requireAdmin();
  const invalid = validateUpload(String(fileName), Number(size));
  if (invalid) return { error: invalid };
  const lesson = await lessonDir(String(slug));
  if ("error" in lesson) return lesson;
  const key = storageKey(lesson.dir, fileName.trim());
  const { data, error } = await createSupabaseAdminClient().storage.from(MEDIA_BUCKET).createSignedUploadUrl(key, { upsert: true });
  if (error || !data) return { error: "לא הצלחנו להכין את ההעלאה. נסי שוב." };
  return { url: data.signedUrl, contentType: UPLOAD_TYPES[fileExt(fileName)] ?? "application/octet-stream" };
}

/** שלב 2: אחרי שהקובץ עלה — מוודאות שהוא באמת באחסון, ורושמות אותו לשיעור. */
export async function finishUpload(slug: string, fileName: string): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin();
  const name = String(fileName).trim();
  if (validateUpload(name, 1)) return { error: "שם קובץ לא תקין." };
  const lesson = await lessonDir(String(slug));
  if ("error" in lesson) return lesson;
  const key = storageKey(lesson.dir, name);
  const db = createSupabaseAdminClient();
  const info = await db.storage.from(MEDIA_BUCKET).info(key);
  if (info.error || !info.data) return { error: "הקובץ לא הגיע לאחסון. נסי להעלות שוב." };
  const size = Number((info.data as { size?: number }).size ?? 0);
  const { error } = await db
    .from("lesson_media")
    .upsert({ lesson_dir: lesson.dir, file_name: name, storage_key: key, size_bytes: size, uploaded_at: new Date().toISOString() }, { onConflict: "storage_key" });
  if (error) return { error: "הקובץ עלה, אבל לא הצלחנו לרשום אותו לשיעור. נסי שוב." };
  await audit(admin, "media.upload", { slug, file: name, size });
  refreshSite();
  return { ok: true };
}

export async function deleteMedia(formData: FormData) {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const file = String(formData.get("file") ?? "");
  const path = `/admin/lessons/${slugSchema.safeParse(slug).success ? slug : ""}`;
  const lesson = await lessonDir(slug);
  if ("error" in lesson) back(path, { err: "db" });
  const db = createSupabaseAdminClient();
  const { data } = await db.from("lesson_media").select("storage_key").eq("lesson_dir", lesson.dir).eq("file_name", file).maybeSingle();
  if (!data) back(path, { err: "file" });
  const key = (data as { storage_key: string }).storage_key;
  await db.storage.from(MEDIA_BUCKET).remove([key]);
  const { error } = await db.from("lesson_media").delete().eq("storage_key", key);
  if (error) back(path, { err: "db" });
  await audit(admin, "media.delete", { slug, file });
  refreshSite();
  back(path, { ok: "deleted" });
}
