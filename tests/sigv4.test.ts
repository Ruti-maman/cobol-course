import { describe, expect, it } from "vitest";
import { presignUrl } from "@/lib/sigv4";

describe("presignUrl (AWS Signature V4)", () => {
  // הדוגמה הרשמית של AWS: "Authenticating Requests: Using Query Parameters"
  it("זהה לחתימה בדוגמה הרשמית", () => {
    const url = presignUrl({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      expiresSeconds: 86400,
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(url).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });

  it("שם קובץ עם רווחים / עברית מקודד כראוי", () => {
    const url = presignUrl({
      method: "GET",
      host: "acc.r2.cloudflarestorage.com",
      path: "/course-media/less1/פתרון (1).mp4",
      region: "auto",
      accessKeyId: "k",
      secretAccessKey: "s",
      expiresSeconds: 60,
    });
    expect(url).toMatch(/^https:\/\/acc\.r2\.cloudflarestorage\.com\/course-media\/less1\/%D7%A4[^ ]*%281%29\.mp4\?/);
  });
});
