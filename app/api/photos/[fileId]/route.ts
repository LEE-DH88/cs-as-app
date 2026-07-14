import { getDrivePhoto } from "@/app/lib/google-storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await context.params;
    if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return NextResponse.json({ error: "사진 ID가 올바르지 않습니다." }, { status: 400 });
    }

    const photo = await getDrivePhoto(fileId);
    return new NextResponse(photo.body, {
      headers: {
        "Content-Type": photo.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(photo.filename)}`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Drive 사진을 불러오지 못했습니다." },
      { status: 404 }
    );
  }
}
