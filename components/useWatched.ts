"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseWatched, readWatchedRaw, subscribeWatched } from "@/lib/progress";

/** הסרטונים שנצפו במכשיר הזה. בשרת ובטעינה הראשונה — ריק (ואז מתעדכן). */
export function useWatched(): Set<string> {
  const raw = useSyncExternalStore(subscribeWatched, readWatchedRaw, () => "");
  return useMemo(() => parseWatched(raw), [raw]);
}
