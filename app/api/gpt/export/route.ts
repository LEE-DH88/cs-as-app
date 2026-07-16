import {
  createDownloadToken,
  requireGptActionAuth,
} from "@/app/lib/gpt-action-auth";
import { listReturnRecords } from "@/app/lib/google-storage";
import {
  buildExcelFilename,
  summarizeReturnRecords,
} from "@/app/lib/return-record-gpt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportRequest = {
  startDate?: string;
  endDate?: string;
};

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const input = (await request.json()) as ExportRequest;
    const records = await listReturnRecords({
      startDate: input.startDate,
      endDate: input.endDate,
    });
    const token = createDownloadToken({
      startDate: input.startDate,
      endDate: input.endDate,
      ttlSeconds: 10 * 60,
    });
    const origin = new URL(request.url).origin;

    return Response.json({
      success: true,
      filename: buildExcelFilename(input.startDate, input.endDate),
      summary: summarizeReturnRecords(records),
      downloadUrl: `${origin}/api/gpt/export/file?token=${encodeURIComponent(token)}`,
      expiresInMinutes: 10,
      note: "다운로드 주소는 10분 동안 유효하며 파일을 서버에 영구 저장하지 않습니다.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "엑셀 생성 준비 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
