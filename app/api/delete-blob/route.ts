import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

type DeleteRequestBody = {
  urls?: string[];
};

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as DeleteRequestBody;
    const urls = (body.urls ?? []).filter(Boolean);

    if (!urls.length) {
      return NextResponse.json(
        { error: "삭제할 파일 URL이 없습니다." },
        { status: 400 },
      );
    }

    await del(urls);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Blob 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}