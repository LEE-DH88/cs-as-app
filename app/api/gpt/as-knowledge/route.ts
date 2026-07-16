import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import {
  checkAsQualityNotionAccess,
  searchAsKnowledge,
} from "@/app/lib/as-quality";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() || "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "5"), 1), 10);

    if (!query) {
      return Response.json(await checkAsQualityNotionAccess());
    }

    const items = await searchAsKnowledge(query, limit);
    return Response.json({
      success: true,
      query,
      count: items.length,
      items,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AS 노션 지식 조회 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
