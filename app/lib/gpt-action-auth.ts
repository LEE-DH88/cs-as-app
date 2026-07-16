import { createHmac, timingSafeEqual } from "node:crypto";

type DownloadPayload = {
  startDate?: string;
  endDate?: string;
  expiresAt: number;
};

function getApiKey() {
  return (process.env.GPT_ACTION_API_KEY || "").trim();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getRequestToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() || "";
  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, "").trim();
  }

  return request.headers.get("x-api-key")?.trim() || "";
}

export function requireGptActionAuth(request: Request): Response | null {
  const expected = getApiKey();

  if (!expected) {
    return Response.json(
      { error: "GPT_ACTION_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const received = getRequestToken(request);
  if (!received || !safeEqual(received, expected)) {
    return Response.json({ error: "GPT Action 인증에 실패했습니다." }, { status: 401 });
  }

  return null;
}

function sign(value: string) {
  const key = getApiKey();
  if (!key) throw new Error("GPT_ACTION_API_KEY 환경변수가 설정되지 않았습니다.");
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function createDownloadToken(input: {
  startDate?: string;
  endDate?: string;
  ttlSeconds?: number;
}) {
  const payload: DownloadPayload = {
    ...(input.startDate ? { startDate: input.startDate } : {}),
    ...(input.endDate ? { endDate: input.endDate } : {}),
    expiresAt: Date.now() + (input.ttlSeconds || 10 * 60) * 1000,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyDownloadToken(token: string): DownloadPayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) {
    throw new Error("다운로드 주소가 올바르지 않습니다.");
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  ) as DownloadPayload;

  if (!payload.expiresAt || payload.expiresAt < Date.now()) {
    throw new Error("다운로드 주소의 유효시간이 만료되었습니다.");
  }

  return payload;
}
