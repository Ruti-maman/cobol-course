import { beforeEach, describe, expect, it, vi } from "vitest";

// מצב מדומה לבקשה: מי מחוברת, אילו זכאויות יש לה, והאם יש בדפדפן עוגיית קישור בדיקה בתוקף.
const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  rows: [] as { lesson_slug: string; expires_at: string | null }[],
  reviewPass: false,
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "x" }) }) }));
vi.mock("@/lib/review", () => ({
  REVIEW_COOKIE: "review",
  parseReviewCookie: () => ({ until: "u", sig: "s" }),
  isValidReviewPass: () => state.reviewPass,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    const query = { eq: () => query, in: async () => ({ data: state.rows, error: null }) };
    return {
      auth: { getUser: async () => ({ data: { user: state.user } }) },
      from: () => ({ select: () => query }),
    };
  },
}));

const { getLessonAccess } = await import("@/lib/access-server");

describe("getLessonAccess — קישור בדיקה לא עוקף זכאות", () => {
  beforeEach(() => {
    state.user = null;
    state.rows = [];
    state.reviewPass = false;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
  });

  it("מחוברת בלי אישור + עוגיית בדיקה בדפדפן → אין גישה", async () => {
    state.user = { id: "u1", email: "learner@example.com" };
    state.reviewPass = true;
    expect(await getLessonAccess("files")).toBe("forbidden");
  });

  it("מחוברת שאושרה → יש גישה", async () => {
    state.user = { id: "u1", email: "learner@example.com" };
    state.rows = [{ lesson_slug: "files", expires_at: "2099-01-01T00:00:00Z" }];
    expect(await getLessonAccess("files")).toBe("ok");
  });

  it("מבקר לא מחובר עם קישור בדיקה בתוקף (נטפרי) → יש גישה", async () => {
    state.reviewPass = true;
    expect(await getLessonAccess("files")).toBe("ok");
  });

  it("מנהלת בלי שום אישור → גישה מלאה", async () => {
    state.user = { id: "a1", email: "Owner@Example.com" };
    expect(await getLessonAccess("files")).toBe("ok");
  });

  it("מבקר לא מחובר בלי קישור → להתחבר", async () => {
    expect(await getLessonAccess("files")).toBe("login");
  });
});
