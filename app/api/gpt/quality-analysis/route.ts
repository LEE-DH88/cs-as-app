import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import { analyzeRecurringIssues } from "@/app/lib/as-quality";
import { listReturnRecords } from "@/app/lib/google-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  startDate: string;
  endDate: string;
  productName?: string;
};

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Body;
    if (!body.startDate || !body.endDate) {
      return Response.json({ error: "startDate와 endDate가 필요합니다." }, { status: 400 });
    }

    const records = await listReturnRecords({
      startDate: body.startDate,
      endDate: body.endDate,
    });
    return Response.json({
      success: true,
      period: { startDate: body.startDate, endDate: body.endDate },
      productName: body.productName || "",
      ...analyzeRecurringIssues(records, body.productName),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "반복 품질 문제 분석 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
