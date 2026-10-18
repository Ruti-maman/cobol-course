import { presignUrl } from "./sigv4";
import { createSupabaseAdminClient } from "./supabase/admin";

// האחסון הפרטי של קובצי הקורס — אותו ממשק לשני ספקים, לפי MEDIA_SOURCE:
//   supabase — הדלי course-media ב-Supabase (ברירת המחדל לאתר החי עד היום)
//   r2       — Cloudflare R2 (צפייה בלי עלות יציאה). הגדרות: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// בשני המקרים הקבצים פרטיים: רק השרת יוצר קישורים זמניים, אחרי בדיקת זכאות.
// המפתחות זהים בשני הספקים (less1/<hash>.mp4), כך שהמעבר הוא העתקה בלבד.

export const MEDIA_BUCKET = "course-media";

export type ObjectStore = {
  /** קישור זמני לקריאה (השרת מושך ממנו בעצמו — לא נשלח לדפדפן) */
  signedGetUrl(key: string, expiresIn: number, downloadName?: string): Promise<string | undefined>;
  /** קישור זמני להעלאה ישירה מהדפדפן (PUT) — לממשק הניהול */
  signedPutUrl(key: string): Promise<string | undefined>;
  /** גודל הקובץ, או undefined אם אינו קיים */
  size(key: string): Promise<number | undefined>;
  download(key: string): Promise<Blob | undefined>;
  remove(key: string): Promise<void>;
};

function supabaseStore(): ObjectStore {
  const bucket = () => createSupabaseAdminClient().storage.from(MEDIA_BUCKET);
  return {
    async signedGetUrl(key, expiresIn, downloadName) {
      const { data, error } = await bucket().createSignedUrl(key, expiresIn, downloadName ? { download: downloadName } : undefined);
      return error || !data ? undefined : data.signedUrl;
    },
    async signedPutUrl(key) {
      const { data, error } = await bucket().createSignedUploadUrl(key, { upsert: true });
      return error || !data ? undefined : data.signedUrl;
    },
    async size(key) {
      const { data, error } = await bucket().info(key);
      return error || !data ? undefined : Number((data as { size?: number }).size ?? 0);
    },
    async download(key) {
      const { data, error } = await bucket().download(key);
      return error || !data ? undefined : data;
    },
    async remove(key) {
      await bucket().remove([key]);
    },
  };
}

export function r2Config(env: Record<string, string | undefined> = process.env) {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return undefined;
  return { host: `${accountId}.r2.cloudflarestorage.com`, bucket: env.R2_BUCKET || MEDIA_BUCKET, accessKeyId, secretAccessKey };
}

function r2Store(): ObjectStore {
  const sign = (method: "GET" | "PUT" | "HEAD" | "DELETE", key: string, expiresSeconds: number, query?: Record<string, string>) => {
    const c = r2Config();
    if (!c) throw new Error("חסרות הגדרות R2 — ראו .env.example");
    return presignUrl({ method, host: c.host, path: `/${c.bucket}/${key}`, region: "auto", accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, expiresSeconds, query });
  };
  return {
    async signedGetUrl(key, expiresIn, downloadName) {
      const query = downloadName ? { "response-content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` } : undefined;
      return sign("GET", key, expiresIn, query);
    },
    async signedPutUrl(key) {
      return sign("PUT", key, 15 * 60);
    },
    async size(key) {
      const res = await fetch(sign("HEAD", key, 60), { method: "HEAD" });
      return res.ok ? Number(res.headers.get("content-length") ?? 0) : undefined;
    },
    async download(key) {
      const res = await fetch(sign("GET", key, 60));
      return res.ok ? res.blob() : undefined;
    },
    async remove(key) {
      await fetch(sign("DELETE", key, 60), { method: "DELETE" });
    },
  };
}

export function objectStore(): ObjectStore {
  return process.env.MEDIA_SOURCE === "r2" ? r2Store() : supabaseStore();
}
