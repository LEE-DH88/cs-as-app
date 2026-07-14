import {
  listReturnRecords,
  saveReturnRecord,
  trashReturnRecord,
  type AppReturnRecord,
} from "@/app/lib/google-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const records = await listReturnRecords({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    });
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "기록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AppReturnRecord;

    if (!body?.id) {
      return NextResponse.json({ error: "기록 ID가 없습니다." }, { status: 400 });
    }

    const record = await saveReturnRecord(body);
    return NextResponse.json({ success: true, record });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "기록 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const record = (await request.json()) as AppReturnRecord;

    if (!record?.id) {
      return NextResponse.json({ error: "삭제할 기록 ID가 없습니다." }, { status: 400 });
    }

    await trashReturnRecord(record);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "기록 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
