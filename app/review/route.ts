import { NextResponse, type NextRequest } from "next/server";

// קישורי הבדיקה (נטפרי) נסגרו. קישור ישן מוביל לדף הכניסה ומוחק את העוגייה שנשארה בדפדפן.
export function GET(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.search = "";
  target.pathname = "/login";
  const response = NextResponse.redirect(target);
  response.cookies.delete("review_pass");
  return response;
}
