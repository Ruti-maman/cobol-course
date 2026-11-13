"use client";

import { useFormStatus } from "react-dom";

/** כפתור שליחה שמראה בבירור שהלחיצה נקלטה: בזמן השמירה — מסתובב, טקסט "בתהליך" ולא ניתן ללחוץ שוב. */
export function SubmitButton({
  className,
  pendingText,
  icon,
  children,
}: {
  className?: string;
  pendingText: string;
  icon?: "check";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${className ?? ""} adm-submit`} disabled={pending} aria-busy={pending}>
      {pending ? (
        <span className="adm-spin" aria-hidden="true" />
      ) : icon === "check" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : null}
      {pending ? pendingText : children}
    </button>
  );
}
