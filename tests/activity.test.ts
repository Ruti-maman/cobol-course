import { beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeActivity } from "@/lib/admin-data";
import { formatWatchTime, playedDelta } from "@/lib/watch-time";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  access: "ok" as "ok" | "login" | "forbidden",
  rpc: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: state.rpc }) }));
vi.mock("@/lib/access-server", () => ({ getLessonAccess: async () => state.access }));

const { POST } = await import("@/app/api/activity/route");
const post = (body: unknown) => POST(new Request("http://x/api/activity", { method: "POST", body: JSON.stringify(body) }));

describe("מדידת זמן צפייה", () => {
  it("נספר רק בזמן ניגון, ופער גדול (מחשב נרדם) לא נספר", () => {
    expect(playedDelta(1000, 2000, true)).toBe(1);
    expect(playedDelta(1000, 2000, false)).toBe(0);
    expect(playedDelta(null, 2000, true)).toBe(0);
    expect(playedDelta(1000, 60_000, true)).toBe(0);
  });
  it("תצוגה בעברית", () => {
    expect(formatWatchTime(0)).toBe("—");
    expect(formatWatchTime(30)).toBe("פחות מדקה");
    expect(formatWatchTime(45 * 60)).toBe("45 דקות");
    expect(formatWatchTime(2 * 3600 + 20 * 60)).toBe("שעתיים ו-20 דקות");
  });
  it("סיכום לכל לומדת: זמן, כניסות, ימים ופעילות אחרונה", () => {
    const map = summarizeActivity([
      { user_id: "u1", day: "2026-10-17", seconds: 600, views: 2, last_seen: "2026-10-17T10:00:00Z" },
      { user_id: "u1", day: "2026-10-18", seconds: 300, views: 1, last_seen: "2026-10-18T09:00:00Z" },
      { user_id: "u1", day: "2026-10-18", seconds: 60, views: 1, last_seen: "2026-10-18T08:00:00Z" },
    ]);
    expect(map.get("u1")).toEqual({ seconds: 960, views: 4, days: 2, lastSeen: "2026-10-18T09:00:00Z" });
  });
});

describe("/api/activity — נרשם רק למי שיש לה גישה", () => {
  beforeEach(() => {
    state.user = { id: "u1", email: "learner@example.com" };
    state.access = "ok";
    state.rpc.mockClear();
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
  });

  it("לומדת מאושרת — נרשם", async () => {
    expect((await post({ slug: "files", seconds: 60, view: false })).status).toBe(204);
    expect(state.rpc).toHaveBeenCalledOnce();
  });
  it("מחוברת שלא אושרה — לא נרשם", async () => {
    state.access = "forbidden";
    await post({ slug: "files", seconds: 60, view: false });
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("לא מחוברת / מנהלת / ערך מנופח — לא נרשם", async () => {
    state.user = null;
    await post({ slug: "files", seconds: 60, view: true });
    state.user = { id: "a", email: "owner@example.com" };
    await post({ slug: "files", seconds: 60, view: true });
    state.user = { id: "u1", email: "learner@example.com" };
    await post({ slug: "files", seconds: 99999, view: false });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
