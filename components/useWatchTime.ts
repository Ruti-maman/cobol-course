"use client";

import { useEffect, type RefObject } from "react";
import { FLUSH_EVERY_SECONDS, MAX_SECONDS_PER_REPORT, playedDelta } from "@/lib/watch-time";

function report(slug: string, seconds: number, view: boolean) {
  const body = JSON.stringify({ slug, seconds: Math.min(Math.round(seconds), MAX_SECONDS_PER_REPORT), view });
  try {
    // sendBeacon עובד גם כשסוגרים את הלשונית
    if (navigator.sendBeacon?.("/api/activity", new Blob([body], { type: "application/json" }))) return;
  } catch {}
  void fetch("/api/activity", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

/** רושם כניסה לשיעור, ומדווח לשרת פעם בדקה כמה זמן הסרטון באמת התנגן (לצד הניהול). */
export function useWatchTime(ref: RefObject<HTMLVideoElement | null>, lessonSlug: string) {
  useEffect(() => {
    report(lessonSlug, 0, true);
  }, [lessonSlug]);

  useEffect(() => {
    let pending = 0;
    let last: number | null = null;
    const flush = () => {
      if (pending >= 1) report(lessonSlug, pending, false);
      pending = 0;
    };
    const tick = () => {
      const el = ref.current;
      const now = performance.now();
      const playing = !!el && !el.paused && !el.ended && document.visibilityState === "visible";
      pending += playedDelta(last, now, playing);
      last = playing ? now : null;
      if (pending >= FLUSH_EVERY_SECONDS) flush();
    };
    const timer = window.setInterval(tick, 1000);
    const onHide = () => {
      tick();
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [ref, lessonSlug]);
}
