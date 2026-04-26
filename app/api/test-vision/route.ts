import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";

export async function GET() {
  try {
    const raw = process.env.GOOGLE_VISION_CREDENTIALS;

    if (!raw) {
      return NextResponse.json({
        success: false,
        error: "GOOGLE_VISION_CREDENTIALS 가 없습니다.",
      });
    }

    const parsed = JSON.parse(raw);

    const client = new ImageAnnotatorClient({
      projectId: parsed.project_id,
      credentials: {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, "\n"),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Google Vision 클라이언트 생성 성공",
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    });
  }
}