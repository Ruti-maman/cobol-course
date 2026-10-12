"use client";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeToggle() {
  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // אחסון חסום (גלישה בסתר וכו') — הבחירה תחול רק בדף הנוכחי.
    }
  }

  return (
    <button className="kbtn" type="button" onClick={toggle} aria-label="החלפה בין מצב בהיר לכהה">
      <span aria-hidden="true">◐</span>
    </button>
  );
}
