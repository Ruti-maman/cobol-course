import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // SAMEORIGIN: האתר עצמו מציג משימות PDF בתוך מסגרת; אתרים אחרים לא יכולים להטמיע אותו.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // קובצי הקורס לעולם לא נארזים לתוך קוד השרת (CLAUDE.md סעיף 6.4) — הם נקראים בזמן ריצה מהאחסון.
  outputFileTracingExcludes: {
    "/*": ["./content-source/**/*", "./content-processed/**/*", "./content-enhanced/**/*", "./audio-samples/**/*", "./desktop/**/*", "./scripts/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
