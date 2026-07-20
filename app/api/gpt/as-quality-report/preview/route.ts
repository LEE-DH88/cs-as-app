import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import {
  previewQualityReport,
  type AsQualityReportInput,
} from "@/app/lib/as-quality-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Partial<AsQualityReportInput>;
    return Response.json(await previewQualityReport(body));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AS 품질 보고서 미리보기 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
