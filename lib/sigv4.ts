import { createHash, createHmac } from "node:crypto";

// חתימת קישורים זמניים בתקן S3 (AWS Signature V4, "presigned URL") — כך עובד האחסון של Cloudflare R2.
// בלי ספרייה חיצונית: כמה פעולות גיבוב של node:crypto. נבדק מול הדוגמה הרשמית של AWS (tests/sigv4.test.ts).

type PresignInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  host: string;
  /** הנתיב בלי קידוד, למשל "/course-media/less1/abc.mp4" */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds: number;
  now?: Date;
  /** פרמטרים נוספים שנחתמים (למשל response-content-disposition) */
  query?: Record<string, string>;
};

/** קידוד לפי S3: כמו encodeURIComponent, וגם !'()* מקודדים. */
function enc(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

const sha256 = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

export function presignUrl(input: PresignInput): string {
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20130524T000000Z
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${input.region}/s3/aws4_request`;

  const params: Record<string, string> = {
    ...input.query,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${input.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(input.expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .toSorted()
    .map((k) => `${enc(k)}=${enc(params[k] ?? "")}`)
    .join("&");
  const canonicalPath = input.path.split("/").map(enc).join("/");

  const canonicalRequest = [input.method, canonicalPath, canonicalQuery, `host:${input.host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${input.secretAccessKey}`, day);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return `https://${input.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
