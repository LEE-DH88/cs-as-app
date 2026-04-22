import { NextRequest, NextResponse } from "next/server";
import vision from "@google-cloud/vision";

const client = new vision.ImageAnnotatorClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

type ParsedInvoice = {
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  returnType: string;
  productName: string;
  rawText: string;
};

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function findInvoiceNumber(text: string) {
  const patterns = [
    /\b\d{10,14}\b/g,
    /\b\d{3,4}-\d{4}-\d{4}\b/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches?.length) return matches[0];
  }
  return "";
}

function findOrderNumber(text: string) {
  const patterns = [
    /주문번호[:\s]*([A-Z0-9\-]{6,})/i,
    /주문번호\s*([A-Z0-9\-]{6,})/i,
    /\b20\d{6,}-\d+\b/g,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    if (match[1]) return match[1];
    if (match[0]) return match[0];
  }

  return "";
}

function findCustomerName(text: string) {
  const patterns = [
    /받는분[:\s]*([가-힣]{2,5})/i,
    /수취인[:\s]*([가-힣]{2,5})/i,
    /고객명[:\s]*([가-힣]{2,5})/i,
    /성명[:\s]*([가-힣]{2,5})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

function findReturnType(text: string) {
  if (text.includes("불량교환")) return "불량교환";
  if (text.includes("불량반품")) return "불량반품";
  if (text.includes("변심반품")) return "변심반품";
  if (text.includes("일반반품")) return "일반반품";
  if (text.includes("AS")) return "AS";
  if (text.includes("검수")) return "검수";
  return "";
}

function findProductName(text: string) {
  const products = [
    "휴대용분유포트",
    "분유쉐이커",
    "LED분유쉐이커",
    "젖병살균세척기",
    "출수형 분유포트",
    "젖병세척기",
    "음식물처리기",
    "에어쿨매트",
    "아기욕조",
  ];

  const found = products.find((product) => text.includes(product));
  return found ?? "";
}

function parseInvoiceText(rawText: string): ParsedInvoice {
  const text = cleanText(rawText);

  return {
    invoiceNumber: findInvoiceNumber(text),
    orderNumber: findOrderNumber(text),
    customerName: findCustomerName(text),
    returnType: findReturnType(text),
    productName: findProductName(text),
    rawText: text,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "이미지 파일이 없습니다." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    const [result] = await client.textDetection({
      image: { content: bytes },
    });

    const rawText = result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";

    if (!rawText) {
      return NextResponse.json(
        { error: "이미지에서 텍스트를 찾지 못했습니다." },
        { status: 200 }
      );
    }

    const parsed = parseInvoiceText(rawText);

    return NextResponse.json({
      success: true,
      parsed,
    });
  } catch (error) {
    console.error("OCR API ERROR:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "OCR 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}