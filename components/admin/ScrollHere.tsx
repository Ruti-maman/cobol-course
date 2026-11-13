"use client";

import { useEffect, useRef } from "react";

/** גולל את ההודעה לאמצע המסך כשהיא מופיעה — כדי שהמנהלת תראה מיד שהפעולה הצליחה. */
export function ScrollHere({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, []);
  return <div ref={ref}>{children}</div>;
}
