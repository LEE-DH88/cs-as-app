import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import {
  checkAsNotionAccess,
  searchAsKnowledge,
} from "@/app/lib/as-notion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() || "";
    const limit = Number(url.searchParams.get("limit") || "5");

    if (!query) {
      return Response.json(await checkAsNotionAccess());
    }

    return Response.json({
      success: true,
      ...(await searchAsKnowledge(query, limit)),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AS 노션 자료 조회 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
