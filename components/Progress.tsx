"use client";

import { coursePercent, lessonDone } from "@/lib/progress";
import { useWatched } from "./useWatched";

/** פס התקדמות לשיעור אחד ברשימת השיעורים — מופיע רק אחרי שהתחלת לצפות בו. */
export function LessonProgress({ slug, videoCount }: { slug: string; videoCount: number }) {
  const watched = useWatched();
  const done = lessonDone(watched, slug, videoCount);
  if (done === 0 || videoCount === 0) return null;
  const complete = done === videoCount;
  return (
    <div className={`progress${complete ? " complete" : ""}`}>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={videoCount} aria-valuenow={done} aria-label="התקדמות בשיעור">
        <i style={{ inlineSize: `${(done / videoCount) * 100}%` }} />
      </div>
      <span>{complete ? "✓ השיעור הושלם" : `צפית ב-${done} מתוך ${videoCount} חלקים`}</span>
    </div>
  );
}

/** ההתקדמות בקורס כולו — מופיעה בראש הדף רק אחרי שהתחלת ללמוד. */
export function CourseProgress({ lessons }: { lessons: { slug: string; videoCount: number }[] }) {
  const watched = useWatched();
  const percent = coursePercent(watched, lessons);
  if (percent === 0) return null;
  return (
    <div className="course-progress">
      <span>
        {percent === 100 ? "סיימת את כל הסרטונים בקורס 🎉" : <>התקדמת <b>{percent}%</b> מהקורס</>}
      </span>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="התקדמות בקורס">
        <i style={{ inlineSize: `${percent}%` }} />
      </div>
    </div>
  );
}
