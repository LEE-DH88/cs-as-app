import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.GOOGLE_VISION_CREDENTIALS;

  return NextResponse.json({
    exists: !!raw,
    type: typeof raw,
    first50: raw ? raw.slice(0, 50) : null,
    first10Chars: raw ? raw.slice(0, 10).split("") : null,
    startsWithBrace: raw ? raw.trim().startsWith("{") : false,
    endsWithBrace: raw ? raw.trim().endsWith("}") : false,
  });
}