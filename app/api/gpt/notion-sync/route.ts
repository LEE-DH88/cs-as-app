import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import { listReturnRecords } from "@/app/lib/google-storage";
import {
  checkNotionAccess,
  syncReturnRecordsToNotion,
} from "@/app/lib/notion-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type SyncRequest = {
  startDate?: string;
  endDate?: string;
  dryRun?: boolean;
};

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    return Response.json(await checkNotionAccess());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "노션 연결 확인 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as SyncRequest;
    const startDate = body.startDate || "2026-07-14";
    const endDate = body.endDate || todayInSeoul();
    const dryRun = body.dryRun !== false;
    const records = await listReturnRecords({ startDate, endDate });
    const result = await syncReturnRecordsToNotion(records, {
      startDate,
      endDate,
      dryRun,
    });
    return Response.json({ success: result.errors.length === 0, ...result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "노션 반영 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
