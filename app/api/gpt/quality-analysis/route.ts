import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import { listReturnRecords } from "@/app/lib/google-storage";
import {
  analyzeRecurringProductIssues,
  buildQualityAnalysisWindow,
  type QualityAnalysisInput,
} from "@/app/lib/quality-analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Partial<QualityAnalysisInput>;

    if (!body.startDate || !body.endDate) {
      return Response.json(
        { error: "startDate와 endDate가 필요합니다." },
        { status: 400 }
      );
    }

    const input: QualityAnalysisInput = {
      startDate: body.startDate,
      endDate: body.endDate,
      productName: body.productName?.trim() || "",
    };

    const window = buildQualityAnalysisWindow(
      input.startDate,
      input.endDate
    );

    // Google Sheets 조회는 비교기간을 포함해 한 번만 실행합니다.
    const records = await listReturnRecords({
      startDate: window.comparisonStartDate,
      endDate: window.endDate,
    });

    return Response.json({
      success: true,
      ...analyzeRecurringProductIssues(records, input),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "반복 품질 문제 분석 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
