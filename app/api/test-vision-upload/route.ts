import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { parseLabelText } from "@/app/lib/parseLabel";

export async function POST(req: NextRequest) {
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

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({
        success: false,
        error: "파일이 없습니다.",
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const [result] = await client.textDetection({
      image: { content: buffer },
    });

    const text =
      result.fullTextAnnotation?.text ||
      result.textAnnotations?.[0]?.description ||
      "";

    const extracted = parseLabelText(text);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      text,
      extracted,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    });
  }
}