"use client";

import { useState } from "react";
import { parsePic } from "@/lib/pic";

const EXAMPLES = ["S9(5)V99", "9(3)", "X(10)", "9(7)V99", "A(5)"];

/** מעבדת PIC: מקלידים הגדרת שדה ורואים מיד גודל, טווח ודוגמה. */
export function PicLab() {
  const [pic, setPic] = useState("S9(5)V99");
  const r = parsePic(pic);

  return (
    <div className="lab">
      <div className="lab-input">
        <label htmlFor="pic-input">הגדרת השדה</label>
        <div className="lab-field ltr">
          <span className="lab-prefix">
            <span className="lab-prefix-long">01 WS-FIELD </span>PIC
          </span>
          <input
            id="pic-input"
            value={pic}
            onChange={(e) => setPic(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            maxLength={40}
            aria-describedby="pic-result"
          />
          <span className="lab-prefix">.</span>
        </div>
        <div className="lab-examples" role="group" aria-label="דוגמאות">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="ltr" aria-pressed={pic === ex} onClick={() => setPic(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      <output id="pic-result" className="lab-out" aria-live="polite">
        {!r.ok ? (
          <p className="lab-error">{r.error}</p>
        ) : r.kind === "numeric" ? (
          <>
            <div className="lab-stat">
              <span>סוג</span>
              <b>מספרי{r.signed ? " עם סימן" : ""}</b>
            </div>
            <div className="lab-stat">
              <span>ספרות</span>
              <b>
                {r.intDigits} שלמות{r.decDigits ? ` + ${r.decDigits} אחרי הנקודה` : ""}
              </b>
            </div>
            <div className="lab-stat">
              <span>גודל בזיכרון</span>
              <b className="lab-big">{r.bytes === 1 ? "בית אחד" : `${r.bytes} בתים`}</b>
            </div>
            <div className="lab-stat">
              <span>טווח</span>
              <b className="ltr">
                {r.min} … {r.max}
              </b>
            </div>
            <div className="lab-stat">
              <span>ערך לדוגמה</span>
              <b className="ltr">{r.example}</b>
            </div>
            <p className="lab-note">
              {r.decDigits > 0 && "ה-V מסמן נקודה עשרונית משתמעת — היא לא תופסת מקום בזיכרון. "}
              {r.signed && "הסימן (S) משולב בספרה האחרונה ולא מוסיף בית."}
            </p>
          </>
        ) : (
          <>
            <div className="lab-stat">
              <span>סוג</span>
              <b>{r.kind === "alphabetic" ? "אותיות בלבד" : "תווים (אותיות, ספרות וסימנים)"}</b>
            </div>
            <div className="lab-stat">
              <span>אורך</span>
              <b className="lab-big">{r.length === 1 ? "תו אחד" : `${r.length} תווים`}</b>
            </div>
            <div className="lab-stat">
              <span>גודל בזיכרון</span>
              <b>{r.bytes === 1 ? "בית אחד" : `${r.bytes} בתים`}</b>
            </div>
            <div className="lab-stat">
              <span>ערך לדוגמה</span>
              <b className="ltr lab-sample">&apos;{r.example}&apos;</b>
            </div>
          </>
        )}
      </output>
    </div>
  );
}
