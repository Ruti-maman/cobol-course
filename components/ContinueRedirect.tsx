"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { lessonHref, loadLastWatched } from "@/lib/last-watched";

/** מעביר לסרטון האחרון שנצפה במכשיר הזה; אם אין — לשיעור הראשון. */
export function ContinueRedirect({ fallback, knownSlugs }: { fallback: string; knownSlugs: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const last = loadLastWatched();
    router.replace(last && knownSlugs.includes(last.slug) ? lessonHref(last) : fallback);
  }, [router, fallback, knownSlugs]);
  return null;
}
