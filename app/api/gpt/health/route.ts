import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  return Response.json({
    ok: true,
    service: "cs-as-app GPT Actions",
    timestamp: new Date().toISOString(),
  });
}
