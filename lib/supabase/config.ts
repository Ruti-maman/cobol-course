// הגדרות משותפות ללקוח השרת (server.ts) ול-proxy.ts.

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("חסרות הגדרות Supabase — ראו .env.example");
  }
  return { url, key };
}

/** הגדרות העוגיות של ההתחברות — HttpOnly, Secure באתר החי, SameSite=Lax (CLAUDE.md סעיף 6.6). */
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
