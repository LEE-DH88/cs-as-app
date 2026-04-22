import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      urls?: string[];
    };

    const urls = body?.urls || [];

    if (!urls.length) {
      return NextResponse.json(
        { error: "삭제할 파일 URL이 없습니다." },
        { status: 400 }
      );
    }

    await del(urls);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Blob 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}