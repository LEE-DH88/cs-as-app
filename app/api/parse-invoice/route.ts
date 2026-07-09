import { NextRequest, NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { parseInvoiceText } from "@/lib/invoice-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParsedInvoiceLike = {
  trackingNumber?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  customerName?: string;
  returnType?: string;
  productName?: string;
  rawText?: string;
};

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

function cleanInvoiceText(text?: string) {
  return (text || "")
    .normalize("NFKC")
    .replace(/\r/g, "\n")
    .replace(/[|｜]/g, " ")
    .replace(/[＊﹡✱✲]/g, "*")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function cleanOrderNumberCandidate(candidate: string) {
  const normalized = (candidate || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[.,;:：)\]}]+$/g, "")
    .replace(/^[^A-Z0-9]+/i, "");

  if (/^P[O0]20\d{8,18}$/i.test(normalized)) {
    return normalized.replace(/^P[O0]/i, "PO");
  }

  return normalized;
}

function extractPoOrderNumber(rawText: string) {
  const raw = cleanInvoiceText(rawText);
  const candidates: { value: string; score: number }[] = [];
  const pattern = /P\s*[O0]\s*20\d[\d\s-]{8,18}/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const value = cleanOrderNumberCandidate(match[0]);
    if (!/^PO20\d{8,18}$/i.test(value)) continue;

    const start = Math.max(0, match.index - 65);
    const end = Math.min(raw.length, match.index + match[0].length + 65);
    const context = raw.slice(start, end);

    let score = 200 + value.length;
    if (/주문번호|링크맘|엄감|일반반품|변심반품|불량반품|불량교환|검수/i.test(context)) score += 120;
    if (/품명|모델명|분유포트|쉐이커|쿨시트|쿨링커버|아기띠/i.test(context)) score += 40;
    if (/운송장번호|송장번호|전화|010|050|1588|1644/i.test(context)) score -= 35;

    candidates.push({ value, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value || "";
}

function normalizeCustomerNameCandidate(name: string) {
  return (name || "")
    .normalize("NFKC")
    .replace(/[＊﹡✱✲]/g, "*")
    .replace(/\s+/g, "")
    .replace(/^[^가-힣]+|[^가-힣*]+$/g, "");
}

function isValidCustomerNameCandidate(name: string) {
  const normalizedName = normalizeCustomerNameCandidate(name);
  const unmaskedName = normalizedName.replace(/\*/g, "");
  const blacklist = [
    "박승훈",
    "주식회사",
    "꿈비",
    "한진택배",
    "대한통운",
    "운송장",
    "주문번호",
    "예약번호",
    "받는분",
    "보내는분",
    "안성시",
    "고삼면",
    "하남시",
    "하남사이",
    "하산국",
    "링크맘",
    "엄감",
    "분리형",
    "휴대용",
    "분유포트",
    "쉐이커",
  ];

  if (!/^[가-힣][가-힣*]{1,5}$/.test(normalizedName)) return false;
  if (!/^[가-힣]{2,4}$/.test(unmaskedName)) return false;
  if (blacklist.some((word) => normalizedName.includes(word) || unmaskedName.includes(word) || word.includes(unmaskedName))) return false;

  return true;
}

function extractMaskedCustomerName(rawText: string) {
  const raw = cleanInvoiceText(rawText);
  const nameCapture = "([가-힣][가-힣\\s*]{1,7})";
  const patterns = [
    new RegExp(`(?:보내는분|보낸분|보내는\\s*분|발송인|발신인|고객명)\\s*[:：]?\\s*${nameCapture}`, "g"),
    new RegExp(`${nameCapture}\\s*(?:050\\d|010\\d|050-\\d|010-\\d)`, "g"),
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw)) !== null) {
      const name = normalizeCustomerNameCandidate(match[1]);
      if (isValidCustomerNameCandidate(name)) return name;
    }
  }

  return "";
}

function extractReturnType(rawText: string) {
  const compact = cleanInvoiceText(rawText).replace(/\s+/g, "");

  if (compact.includes("불량교환")) return "불량교환";
  if (compact.includes("불량반품")) return "불량반품";
  if (compact.includes("변심반품")) return "변심반품";
  if (compact.includes("일반반품")) return "일반반품";
  if (/AS|에이에스|수리/i.test(compact)) return "AS";
  if (compact.includes("검수")) return "검수";

  return "";
}

function cleanProductCandidateText(value?: string) {
  return (value || "")
    .normalize("NFKC")
    .replace(/[＊﹡✱✲]/g, "*")
    .replace(/품\s*명\s*[:：]?/gi, "")
    .replace(/제품명\s*[:：]?|상품명\s*[:：]?|모델명\s*[:：]?/gi, "")
    .replace(/주문번호\s*[:：]?\s*P\s*[O0]\s*20\d[\d\s-]{8,18}/gi, "")
    .replace(/P\s*[O0]\s*20\d[\d\s-]{8,18}/gi, "")
    .replace(/\b20\d[\d\s-]{8,18}\b/g, "")
    .replace(/링크맘|엄감|일반반품|변심반품|불량반품|불량교환|검수|가품X|출고반품|반품/g, " ")
    .replace(/[★☆]/g, " ")
    .replace(/^[\s\/／\\|｜:：\-]+|[\s\/／\\|｜:：\-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProductText(rawText: string) {
  const raw = cleanInvoiceText(rawText);
  const candidates: string[] = [];
  const pushCandidate = (value?: string) => {
    const clean = cleanProductCandidateText(value);
    if (clean && clean.length >= 2 && !candidates.includes(clean)) candidates.push(clean);
  };

  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    if (/품\s*명|제품명|상품명|모델명/i.test(line)) {
      const afterLabel = line.replace(/^.*?(품\s*명|제품명|상품명|모델명)\s*[:：]?\s*/i, "");
      pushCandidate(afterLabel);
      pushCandidate(`${afterLabel} ${lines[index + 1] || ""}`);
    }

    if (/링크맘|엄감|일반반품|변심반품|불량반품|불량교환|검수|P\s*[O0]\s*20/i.test(line)) {
      const parts = line.split(/[\/／|｜]/g).map((part) => part.trim()).filter(Boolean);
      parts.forEach((part) => {
        if (/P\s*[O0]\s*20|20\d{8,18}|링크맘|엄감|일반반품|변심반품|불량반품|불량교환|검수/i.test(part)) return;
        pushCandidate(part);
      });

      const afterPo = line.match(/P\s*[O0]\s*20\d[\d\s-]{8,18}\s*[\/／|｜]?\s*([^\/／|｜\n]+)/i);
      if (afterPo?.[1]) pushCandidate(afterPo[1]);
    }
  });

  const productLabelPattern = /(?:품\s*명|제품명|상품명|모델명)\s*[:：]?\s*([^\n]+)/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = productLabelPattern.exec(raw)) !== null) {
    pushCandidate(labelMatch[1]);
  }

  const afterPoPattern = /P\s*[O0]\s*20\d[\d\s-]{8,18}\s*[\/／|｜]?\s*([^\/／|｜\n]+)/gi;
  let afterPoMatch: RegExpExecArray | null;
  while ((afterPoMatch = afterPoPattern.exec(raw)) !== null) {
    pushCandidate(afterPoMatch[1]);
  }

  return candidates[0] || "";
}

function repairParsedInvoiceText(parsed: ParsedInvoiceLike, rawText: string): ParsedInvoiceLike {
  const poOrderNumber = extractPoOrderNumber(rawText);
  const maskedCustomerName = extractMaskedCustomerName(rawText);
  const returnType = extractReturnType(rawText);
  const productText = extractProductText(rawText);

  return {
    ...parsed,
    rawText: parsed.rawText || cleanInvoiceText(rawText),
    orderNumber: poOrderNumber || parsed.orderNumber || "",
    customerName: maskedCustomerName || parsed.customerName || "",
    returnType: parsed.returnType || returnType,
    productName: productText || parsed.productName || "",
  };
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

    const parsed = repairParsedInvoiceText(parseInvoiceText(text) as ParsedInvoiceLike, text);

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
