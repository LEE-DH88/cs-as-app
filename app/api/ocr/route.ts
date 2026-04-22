import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";

export const runtime = "nodejs";

type OcrParsedResult = {
  success: boolean;
  rawText: string;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  returnType: string;
  productName: string;
  matchedKeywords: string[];
};

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function extractInvoiceNumber(text: string) {
  const compact = text.replace(/\s/g, "");

  const patterns = [
    /\b(\d{10,14})\b/g,
    /송장번호[:\s]*([0-9\-]{10,20})/gi,
    /운송장번호[:\s]*([0-9\-]{10,20})/gi,
    /등기번호[:\s]*([0-9\-]{10,20})/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...compact.matchAll(pattern)];
    if (matches.length > 0) {
      const value = matches[0][1]?.replace(/[^0-9]/g, "");
      if (value && value.length >= 10) return value;
    }
  }

  return "";
}

function extractOrderNumber(text: string) {
  const patterns = [
    /주문번호[:\s]*([A-Z0-9\-]{6,30})/i,
    /주문번호\s*([A-Z0-9\-]{6,30})/i,
    /오더번호[:\s]*([A-Z0-9\-]{6,30})/i,
    /\b(20\d{6,8}[-_]\d{3,6})\b/i,
    /\b([A-Z]{2,5}\d{6,14})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function extractCustomerName(text: string) {
  const patterns = [
    /받는분[:\s]*([가-힣a-zA-Z]{2,10})/i,
    /수령인[:\s]*([가-힣a-zA-Z]{2,10})/i,
    /고객명[:\s]*([가-힣a-zA-Z]{2,10})/i,
    /이름[:\s]*([가-힣a-zA-Z]{2,10})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function detectReturnType(text: string) {
  const normalized = text.replace(/\s/g, "").toLowerCase();

  if (normalized.includes("불량교환")) return "불량교환";
  if (normalized.includes("불량반품")) return "불량반품";
  if (normalized.includes("변심반품")) return "변심반품";
  if (normalized.includes("일반반품")) return "일반반품";

  if (normalized.includes("교환")) return "불량교환";
  if (normalized.includes("불량")) return "불량반품";
  if (normalized.includes("변심")) return "변심반품";
  if (normalized.includes("반품")) return "일반반품";

  return "";
}

function detectProductName(text: string) {
  const normalized = text.replace(/\s/g, "").toLowerCase();

  const productMap = [
    { keywords: ["휴대용분유포트", "분유포트"], value: "휴대용분유포트" },
    { keywords: ["분유쉐이커", "분유셰이커", "쉐이커"], value: "분유쉐이커" },
    { keywords: ["led분유쉐이커", "led분유셰이커", "led쉐이커"], value: "LED분유쉐이커" },
  ];

  for (const item of productMap) {
    for (const keyword of item.keywords) {
      if (normalized.includes(keyword)) {
        return item.value;
      }
    }
  }

  return "";
}

function collectMatchedKeywords(text: string) {
  const normalized = text.replace(/\s/g, "").toLowerCase();
  const keywords = [
    "휴대용분유포트",
    "분유포트",
    "분유쉐이커",
    "분유셰이커",
    "led분유쉐이커",
    "led분유셰이커",
    "일반반품",
    "변심반품",
    "불량반품",
    "불량교환",
    "교환",
    "불량",
    "반품",
  ];

  return keywords.filter((keyword) => normalized.includes(keyword));
}

async function parseImageToText(base64Image: string) {
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId = process.env.GOOGLE_VISION_PROJECT_ID;

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error("Google Vision 환경변수가 설정되지 않았습니다.");
  }

  const client = new ImageAnnotatorClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    projectId,
  });

  const [result] = await client.documentTextDetection({
    image: {
      content: base64Image,
    },
  });

  const fullText = result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "";
  return normalizeText(fullText);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const imageBase64 = body?.imageBase64;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { success: false, message: "이미지 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const cleanedBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const rawText = await parseImageToText(cleanedBase64);

    const invoiceNumber = extractInvoiceNumber(rawText);
    const orderNumber = extractOrderNumber(rawText);
    const customerName = extractCustomerName(rawText);
    const returnType = detectReturnType(rawText);
    const productName = detectProductName(rawText);
    const matchedKeywords = collectMatchedKeywords(rawText);

    const response: OcrParsedResult = {
      success: true,
      rawText,
      invoiceNumber,
      orderNumber,
      customerName,
      returnType,
      productName,
      matchedKeywords,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("OCR API error:", error);

    const message =
      error instanceof Error ? error.message : "OCR 처리 중 오류가 발생했습니다.";

    return NextResponse.json(
      {
        success: false,
        message,
        rawText: "",
        invoiceNumber: "",
        orderNumber: "",
        customerName: "",
        returnType: "",
        productName: "",
        matchedKeywords: [],
      },
      { status: 500 }
    );
  }
}