import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/** wide — ברוחב של דף השיעור, כדי שהסרגל יהיה מיושר לתוכן */
export function SiteHeader({ wide = false }: { wide?: boolean }) {
  return (
    <header className="bar">
      <div className={`wrap bar-in${wide ? " wide" : ""}`}>
        <Link className="brand" href="/">
          <span className="sig ltr" aria-hidden="true">
            CB
          </span>
          <b>קורס COBOL</b>
        </Link>
        <nav aria-label="ניווט ראשי">
          <a href="#lessons">תוכנית הלימודים</a>
          <a href="#lab">מעבדת PIC</a>
          <a href="#how">איך זה עובד</a>
        </nav>
        <div className="tools">
          <ThemeToggle />
          <Link className="kbtn" href="/login">
            כניסה ללומדות
          </Link>
        </div>
      </div>
    </header>
  );
}
