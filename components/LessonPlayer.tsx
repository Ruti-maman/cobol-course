"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCourseApp } from "@/lib/desktop-app";
import { applyPlaybackRate, loadPlaybackRate, savePlaybackRate } from "@/lib/playback-rate";

type Video = { title: string; src: string };

/** כמה שניות לחכות במסך הסיום לפני מעבר אוטומטי לסרטון הבא */
const AUTOPLAY_SECONDS = 8;

/**
 * שכבת הרתעה בצד הלקוח — לא תחליף ל-DRM.
 * מכסה את הסרטון בלבן כשהחלון מאבד פוקוס (כלי חיתוך, מעבר חלון) או כשנלחצים
 * מקש Windows / PrintScreen. לא חוסמת תוכנות הקלטה או מצלמה חיצונית — לכן גם סימן מים.
 */
function useCaptureShield(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [shielded, setShielded] = useState(false);
  const releaseTimer = useRef<number | undefined>(undefined);

  const raise = useCallback(() => {
    window.clearTimeout(releaseTimer.current);
    videoRef.current?.pause();
    setShielded(true);
  }, [videoRef]);

  const releaseSoon = useCallback((delay: number) => {
    window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      if (document.hasFocus() && document.visibilityState === "visible") setShielded(false);
    }, delay);
  }, []);

  useEffect(() => {
    // באפליקציית המחשב מערכת ההפעלה כבר מוציאה את החלון מכל צילום — אין צורך בכיסוי הזה.
    if (getCourseApp()) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "OS" || e.key === "PrintScreen") raise();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        raise();
        // מנסה לדרוס את מה שהועתק ללוח. עלול להיכשל בלי הרשאה — זה בסדר.
        navigator.clipboard?.writeText(" ").catch(() => {});
        releaseSoon(2000);
      } else if (e.key === "Meta" || e.key === "OS") {
        releaseSoon(1200);
      }
    };
    const onBlur = () => raise();
    const onFocus = () => releaseSoon(400);
    const onVisibility = () => (document.visibilityState === "hidden" ? raise() : releaseSoon(400));

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(releaseTimer.current);
    };
  }, [raise, releaseSoon]);

  return shielded;
}

/** באפליקציית המחשב: רשימת תוכנות ההקלטה הפתוחות. בזמן שיש כאלה — הסרטון עצור ומכוסה. */
function useRecorderBlock(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [recorders, setRecorders] = useState<string[]>([]);
  useEffect(() => getCourseApp()?.onCaptureState(setRecorders), []);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || recorders.length === 0) return;
    el.pause();
    const block = () => el.pause();
    el.addEventListener("play", block);
    return () => el.removeEventListener("play", block);
  }, [recorders, videoRef]);
  return recorders;
}

/** סימן מים שמחליף מיקום כל כמה שניות, כדי שאי אפשר יהיה לחתוך אותו החוצה. */
function useWanderingPosition(intervalMs: number) {
  const [pos, setPos] = useState({ top: 12, left: 10 });
  useEffect(() => {
    const id = window.setInterval(() => {
      setPos({ top: 8 + Math.random() * 76, left: 6 + Math.random() * 60 });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return pos;
}

export function LessonPlayer({
  lessonSlug,
  videos,
  watermark,
  nextLesson,
  onOpenAssignment,
  assignmentIsFinal,
  sidebar,
}: {
  lessonSlug: string;
  videos: Video[];
  watermark?: string;
  /** השיעור הבא — מוצג במסך הסיום של הסרטון האחרון */
  nextLesson?: { href: string; label: string };
  /** אם לשיעור יש משימה — בסוף הסרטון האחרון הלחיצה פותחת אותה */
  onOpenAssignment?: () => void;
  /** המשימה של השיעור היא פרויקט הסיום — ניסוח חגיגי במסך הסיום */
  assignmentIsFinal?: boolean;
  /** תוכן נוסף לעמודת הצד, מתחת לרשימת הסרטונים (משימה, מעבר בין שיעורים) */
  sidebar?: React.ReactNode;
}) {
  const [current, setCurrent] = useState(0);
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const autoplayRef = useRef(false);
  // אייקון ▶/❚❚ שמהבהב במרכז המסך אחרי לחיצה (כמו ביוטיוב). id משתנה כדי להפעיל את האנימציה מחדש.
  const [flash, setFlash] = useState<{ kind: "play" | "pause"; id: number } | null>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const shielded = useCaptureShield(ref);
  const recorders = useRecorderBlock(ref);
  const markPos = useWanderingPosition(4000);
  const video = videos[current];
  const nextVideo = videos[current + 1];
  const storageKey = video ? `pos:${lessonSlug}:${video.src}` : "";

  // שמירת נקודת הצפייה בכל סרטון — "המשיכי מאיפה שעצרת".
  useEffect(() => {
    const el = ref.current;
    if (!el || !storageKey) return;
    const restore = () => {
      // המהירות שנבחרה קודם ממשיכה גם לסרטון הזה
      applyPlaybackRate(el, loadPlaybackRate());
      try {
        const saved = Number(localStorage.getItem(storageKey));
        if (saved > 0 && saved < el.duration - 5) el.currentTime = saved;
      } catch {}
    };
    const save = () => {
      try {
        localStorage.setItem(storageKey, String(Math.floor(el.currentTime)));
      } catch {}
    };
    const autoplay = () => {
      if (autoplayRef.current) {
        autoplayRef.current = false;
        void el.play().catch(() => {});
      }
    };
    el.addEventListener("loadedmetadata", restore);
    el.addEventListener("loadeddata", autoplay);
    el.addEventListener("timeupdate", save);
    // מהירות שנבחרה בתפריט ⋮ של הנגן — נשמרת לסרטונים הבאים
    const rememberRate = () => {
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) savePlaybackRate(el.playbackRate);
    };
    el.addEventListener("ratechange", rememberRate);
    // בטעינה ראשונה של הדף הסרטון מתחיל להיטען עוד לפני שהקוד מוכן — אם כבר נטען, מחילים מיד.
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) restore();
    return () => {
      el.removeEventListener("loadedmetadata", restore);
      el.removeEventListener("loadeddata", autoplay);
      el.removeEventListener("timeupdate", save);
      el.removeEventListener("ratechange", rememberRate);
    };
  }, [storageKey]);

  const goTo = useCallback((index: number, autoplay: boolean) => {
    autoplayRef.current = autoplay;
    setEnded(false);
    setCountdown(null);
    setCurrent(index);
  }, []);

  function handleEnded() {
    // סרטון שנצפה עד הסוף — בפעם הבאה יתחיל מההתחלה.
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setEnded(true);
    if (nextVideo) setCountdown(AUTOPLAY_SECONDS);
  }

  /** עצירה/המשך בלחיצה על שטח הסרטון — חוץ מפס הכפתורים התחתון של הנגן. */
  function handleScreenClick(e: React.MouseEvent<HTMLVideoElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const controlsHeight = Math.min(64, rect.height * 0.2);
    if (e.clientY > rect.bottom - controlsHeight) return;
    e.preventDefault();
    togglePlay();
  }

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
      setFlash({ kind: "play", id: Date.now() });
    } else {
      el.pause();
      setFlash({ kind: "pause", id: Date.now() });
    }
  }

  // מקש רווח עוצר וממשיך מכל מקום בדף (חוץ משדות טקסט וכפתורים).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, button, a, [contenteditable]")) return;
      // שלב ה-capture + stopPropagation: הנגן המובנה לא מקבל את הרווח, כדי שלא יפעיל אותו פעם שנייה.
      e.preventDefault();
      e.stopPropagation();
      togglePlay();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  function replay() {
    setEnded(false);
    setCountdown(null);
    const el = ref.current;
    if (el) {
      el.currentTime = 0;
      void el.play().catch(() => {});
    }
  }

  // ספירה לאחור למעבר אוטומטי. נעצרת כשהצפייה מוגנת/חסומה.
  const paused = shielded || recorders.length > 0;
  useEffect(() => {
    if (countdown === null || paused) return;
    const id = window.setTimeout(() => {
      if (countdown <= 1) goTo(current + 1, true);
      else setCountdown(countdown - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [countdown, paused, current, goTo]);

  // מסך מלא על כל המסגרת (ולא על ה-video לבד), כדי שהכיסוי וסימן המים יישארו גם במסך מלא.
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void screenRef.current?.requestFullscreen();
  }

  if (!video) return <p className="empty">אין עדיין סרטונים בשיעור הזה.</p>;

  return (
    <div className="player">
      <div
        className="screen protected"
        ref={screenRef}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <video
          ref={ref}
          key={video.src}
          src={video.src}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          preload="metadata"
          playsInline
          onClick={handleScreenClick}
          onDoubleClick={toggleFullscreen}
          onEnded={handleEnded}
          onPlay={() => setEnded(false)}
        />
        {ended && (
          <div className="endscreen">
            {nextVideo ? (
              <button type="button" className="next-card" onClick={() => goTo(current + 1, true)}>
                <span className="next-label">
                  {countdown !== null ? `הסרטון הבא מתחיל בעוד ${countdown}` : "הסרטון הבא"}
                </span>
                <span
                  className={`next-play${countdown !== null && !paused ? " counting" : ""}`}
                  style={{ ["--autoplay-s" as string]: `${AUTOPLAY_SECONDS}s` }}
                  aria-hidden="true"
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.5v13l10-6.5-10-6.5z" />
                  </svg>
                </span>
                <span className="next-title">{nextVideo.title}</span>
              </button>
            ) : onOpenAssignment ? (
              <button type="button" className="next-card" onClick={onOpenAssignment}>
                <span className="next-label">{assignmentIsFinal ? "סיימת את כל סרטוני הקורס 🏆" : "סיימת את הסרטונים של השיעור 🎉"}</span>
                <span className="next-play" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5zM13.5 3.5V8h4.5M9.5 13h6M9.5 16.5h4" />
                  </svg>
                </span>
                <span className="next-title">{assignmentIsFinal ? "לפרויקט הסיום" : "למשימה של השיעור"}</span>
              </button>
            ) : nextLesson ? (
              <Link className="next-card" href={nextLesson.href}>
                <span className="next-label">סיימת את השיעור 🎉</span>
                <span className="next-play" aria-hidden="true">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.5v13l10-6.5-10-6.5z" />
                  </svg>
                </span>
                <span className="next-title">המשיכי ל{nextLesson.label}</span>
              </Link>
            ) : (
              <div className="next-card done">
                <span className="next-label">סיימת את הקורס 🎉</span>
                <span className="next-title">כל הכבוד על ההתמדה</span>
              </div>
            )}
            <div className="end-actions">
              {countdown !== null && (
                <button type="button" onClick={() => setCountdown(null)}>
                  ביטול
                </button>
              )}
              <button type="button" onClick={replay}>
                ↻ צפי שוב
              </button>
              {!nextVideo && onOpenAssignment && nextLesson && (
                <Link href={nextLesson.href}>לשיעור הבא ←</Link>
              )}
            </div>
          </div>
        )}
        {flash && (
          <span key={flash.id} className="play-flash" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
              {flash.kind === "play" ? <path d="M8 5.5v13l10-6.5-10-6.5z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
            </svg>
          </span>
        )}
        {watermark && (
          <span className="watermark" aria-hidden="true" style={{ top: `${markPos.top}%`, left: `${markPos.left}%` }}>
            {watermark}
          </span>
        )}
        {recorders.length > 0 ? (
          <div className="shield" role="alert">
            <p>זוהתה תוכנת הקלטה</p>
            <span>
              כדי להמשיך לצפות, סגרי את: <b className="ltr">{recorders.join(", ")}</b>
            </span>
          </div>
        ) : shielded && (
          <div className="shield" role="status">
            <p>הצפייה מוגנת</p>
            <span>חזרי לחלון הקורס כדי להמשיך</span>
          </div>
        )}
      </div>
      <aside className="side" aria-label="תוכן השיעור">
        <section className="side-block" aria-labelledby="pl-title">
          <h2 id="pl-title" className="side-title">
            סרטוני השיעור
            <span className="ltr">
              {current + 1}/{videos.length}
            </span>
          </h2>
          <ol className="playlist" role="list">
            {videos.map((v, i) => (
              <li key={v.src}>
                <button type="button" aria-current={i === current ? "true" : undefined} onClick={() => goTo(i, true)}>
                  <span className="idx ltr" aria-hidden="true">
                    {i === current ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 4.5v15l12-7.5-12-7.5z" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="name">{v.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        {sidebar}
      </aside>
    </div>
  );
}
