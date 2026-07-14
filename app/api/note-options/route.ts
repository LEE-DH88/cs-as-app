import { readStringArrayConfig, writeStringArrayConfig } from "@/app/lib/google-storage";
import { NextResponse } from "next/server";

const CONFIG_NAME = "추가 불량 비고 목록";
const BASE_OPTIONS = ["전원불량", "사용감", "소음", "누수", "충전불량", "회전불량", "수분유입", "이물질"];

function normalize(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value).replace(/\s+/g, " ").trim())
        .filter((value) => value && !BASE_OPTIONS.includes(value))
    )
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ customDefectiveNoteOptions: await readStringArrayConfig(CONFIG_NAME) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "비고 문구 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const current = await readStringArrayConfig(CONFIG_NAME);
    const incoming = [
      ...(typeof body?.option === "string" ? [body.option] : []),
      ...(Array.isArray(body?.options) ? body.options : []),
    ];
    const customDefectiveNoteOptions = await writeStringArrayConfig(CONFIG_NAME, normalize([...current, ...incoming]));
    return NextResponse.json({ customDefectiveNoteOptions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "비고 문구 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
