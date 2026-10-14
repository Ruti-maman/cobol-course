import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// גופן מסוף אחד לכל האתר — עברית ואנגלית באותו כתב מרובע, כמו במסך העריכה של COBOL.
// Miriam Mono CLM מפרויקט Culmus (GPL עם חריגת גופנים — מותר להטמעה באתר; הרישיון ב-app/fonts).
const term = localFont({
  src: [
    { path: "./fonts/miriam-mono-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/miriam-mono-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

// גופן עברי מודרני לטקסט הרגיל; המונוספייס נשאר לקוד, לתוויות ולמספרים (רענון 2026).
const sans = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "קורס COBOL דיגיטלי",
  description: "קורס מקוון ללימוד שפת COBOL בעברית — סרטונים, מטלות ותרגול, בקצב שלך.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#F3F7EE" },
  ],
};

// מחיל את ערכת הצבעים שנבחרה לפני הציור הראשון, כדי שלא יהיה הבהוב.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`${term.variable} ${sans.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          דלגי לתוכן
        </a>
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="veil" aria-hidden="true" />
        {/* מספרי שורות בשוליים — כמו עמודות 1–6 בקוד COBOL (קישוט בלבד, במסכים רחבים) */}
        <div className="seu-gutter" aria-hidden="true">
          {Array.from({ length: 240 }, (_, i) => (
            <span key={i}>{String((i + 1) * 10).padStart(4, "0")}.00</span>
          ))}
        </div>
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
