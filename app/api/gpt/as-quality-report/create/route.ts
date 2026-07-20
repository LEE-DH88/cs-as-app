import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import {
  createQualityReport,
  DuplicateQualityReportError,
  type AsQualityReportInput,
} from "@/app/lib/as-quality-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type CreateBody = Partial<AsQualityReportInput> & {
  approvalConfirmed?: boolean;
  approvalText?: string;
  allowDuplicate?: boolean;
};

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as CreateBody;

    if (
      body.approvalConfirmed !== true ||
      body.approvalText?.trim() !== "노션 등록 승인"
    ) {
      return Response.json(
        {
          error:
            "실제 등록에는 사용자의 명시적 승인이 필요합니다. 미리보기를 먼저 보여준 뒤 approvalConfirmed=true, approvalText='노션 등록 승인'으로 호출하세요.",
        },
        { status: 400 }
      );
    }

    const {
      approvalConfirmed: _approvalConfirmed,
      approvalText: _approvalText,
      allowDuplicate,
      ...report
    } = body;

    return Response.json(
      await createQualityReport(report, { allowDuplicate }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DuplicateQualityReportError) {
      return Response.json(
        {
          error: error.message,
          duplicate: error.duplicate,
          instruction:
            "중복 등록이 꼭 필요한 경우 사용자에게 다시 확인한 뒤 allowDuplicate=true로 호출하세요.",
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AS 품질 보고서 등록 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
