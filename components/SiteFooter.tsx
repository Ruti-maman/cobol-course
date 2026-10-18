import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <span>
          קורס COBOL דיגיטלי · © כל הזכויות שמורות · <Link href="/privacy">מדיניות פרטיות</Link>
        </span>
        <span className="mono ltr">IDENTIFICATION DIVISION.</span>
      </div>
    </footer>
  );
}
