import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { SiteHeader } from "@/components/SiteHeader";
import { safeNextPath } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";

export const metadata = { title: "כניסה ללומדות · קורס COBOL" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = safeNextPath(next, "/continue");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;

  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap placeholder login">
        <p className="eyebrow">
          <b>◆</b> אזור הלומדות
        </p>
        {email ? (
          <>
            <h1>את מחוברת</h1>
            <p>
              התחברת עם <bdi className="ltr">{email}</bdi>.
            </p>
            <Link className="btn btn-1" href={nextPath}>
              המשיכי ללמוד
            </Link>
            <form action={signOutAction}>
              <button className="login-link" type="submit">
                התנתקי
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>כניסה ללומדות</h1>
            <p>בלי סיסמה: נשלח לך קוד חד-פעמי למייל.</p>
            {error === "link" && (
              <p className="login-error" role="alert">
                הקישור מהמייל כבר שומש או שפג תוקפו. בקשי קוד חדש.
              </p>
            )}
            <LoginForm next={nextPath} />
          </>
        )}
      </main>
    </>
  );
}
