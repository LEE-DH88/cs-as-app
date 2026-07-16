import { verifyDownloadToken } from "@/app/lib/gpt-action-auth";
import { listReturnRecords } from "@/app/lib/google-storage";
import {
  buildExcelFilename,
  buildReturnRecordWorkbook,
} from "@/app/lib/return-record-gpt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || "";
    const payload = verifyDownloadToken(token);
    const records = await listReturnRecords({
      startDate: payload.startDate,
      endDate: payload.endDate,
    });
    const workbook = buildReturnRecordWorkbook(records, url.origin);
    const filename = buildExcelFilename(payload.startDate, payload.endDate);

    return new Response(workbook, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "엑셀 다운로드 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
