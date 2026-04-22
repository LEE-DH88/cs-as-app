import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

type DeleteBody = {
  urls?: string[];
};

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as DeleteBody;
    const urls = (body.urls ?? []).filter(Boolean);

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "삭제할 이미지 URL이 없습니다." },
        { status: 400 }
      );
    }

    await del(urls);

    return NextResponse.json({ ok: true, deletedCount: urls.length });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Blob 이미지 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}