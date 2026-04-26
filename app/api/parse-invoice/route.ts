import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { parseInvoiceText } from "@/lib/invoice-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getVisionClient() {
  const credentialsText = process.env.GOOGLE_VISION_CREDENTIALS;

  if (!credentialsText) {
    throw new Error("GOOGLE_VISION_CREDENTIALS 환경변수가 누락되었습니다.");
  }

  const credentials = JSON.parse(credentialsText);

  return new ImageAnnotatorClient({
    credentials,
    projectId: credentials.project_id,
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "이미지 파일이 없습니다." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const client = getVisionClient();

    const [result] = await client.textDetection({
      image: { content: bytes },
    });

    const text = result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";

    if (!text) {
      return NextResponse.json(
        { success: false, message: "텍스트를 인식하지 못했습니다." },
        { status: 400 }
      );
    }

    const parsed = parseInvoiceText(text);

    return NextResponse.json({
      success: true,
      parsed,
    });
  } catch (error) {
    console.error("parse-invoice error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "송장 파싱 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}