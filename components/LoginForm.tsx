"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initial: LoginState = { step: "email" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  if (state.step === "code") {
    return (
      <form className="login-form" action={action}>
        <input type="hidden" name="next" value={next} />
        <p>
          שלחנו קוד כניסה אל <bdi className="ltr">{state.email}</bdi>. הקלידי אותו כאן:
        </p>
        <label htmlFor="code">קוד כניסה</label>
        <input
          id="code"
          name="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,12}"
          required
          autoFocus
          aria-describedby={state.error ? "login-error" : undefined}
        />
        {state.error && (
          <p id="login-error" className="login-error" role="alert">
            {state.error}
          </p>
        )}
        <button className="btn btn-1" type="submit" name="intent" value="verify" disabled={pending}>
          {pending ? "בבדיקה…" : "כניסה"}
        </button>
        <button className="login-link" type="submit" name="intent" value="change-email" formNoValidate disabled={pending}>
          לא קיבלת? החליפי כתובת או שלחי שוב
        </button>
      </form>
    );
  }

  return (
    <form className="login-form" action={action}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">כתובת מייל</label>
      <input
        id="email"
        name="email"
        type="email"
        dir="ltr"
        autoComplete="email"
        defaultValue={state.email}
        required
        autoFocus
        aria-describedby={state.error ? "login-error" : undefined}
      />
      {state.error && (
        <p id="login-error" className="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-1" type="submit" name="intent" value="send" disabled={pending}>
        {pending ? "בשליחה…" : "שלחי לי קוד"}
      </button>
    </form>
  );
}
