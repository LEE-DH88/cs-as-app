import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import {
  createAsQualityReport,
  previewAsQualityReport,
  type AsQualityReportInput,
} from "@/app/lib/as-quality";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = AsQualityReportInput & {
  mode: "preview" | "create";
  confirmed?: boolean;
};

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Body;
    const { mode, confirmed, ...input } = body;

    if (mode === "preview") {
      return Response.json(previewAsQualityReport(input));
    }

    if (mode === "create" && confirmed === true) {
      return Response.json(await createAsQualityReport(input), { status: 201 });
    }

    return Response.json(
      {
        error:
          "실제 등록은 mode=create와 confirmed=true가 모두 필요합니다. 먼저 preview로 사용자에게 내용을 보여주세요.",
      },
      { status: 400 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AS 품질 보고서 처리 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
