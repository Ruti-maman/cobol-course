import { NextResponse, type NextRequest } from "next/server";
import { isValidReviewPass, REVIEW_COOKIE, reviewExpiry } from "@/lib/review";

// כניסה דרך קישור בדיקה (lib/review.ts): שומר עוגייה עד תאריך התפוגה ומעביר לשיעור הראשון.
export function GET(request: NextRequest) {
  const until = request.nextUrl.searchParams.get("until");
  const sig = request.nextUrl.searchParams.get("sig");
  const target = request.nextUrl.clone();
  target.search = "";

  if (!until || !sig || !isValidReviewPass(process.env.REVIEW_SECRET, until, sig)) {
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  target.pathname = "/lessons/setup";
  const response = NextResponse.redirect(target);
  const end = reviewExpiry(until) ?? Date.now();
  response.cookies.set(REVIEW_COOKIE, `${until}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, Math.floor((end - Date.now()) / 1000)),
  });
  return response;
}
