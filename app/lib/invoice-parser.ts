export type ParsedInvoice = {
  rawText: string;
  trackingNumber: string;
  customerName: string;
  returnType: string;
  orderNumber: string;
  productName: string;
  address: string;
};

const PRODUCT_TYPES = ["휴대용분유포트", "분유쉐이커", "LED분유쉐이커"];

function normalize(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[★☆]/g, "★")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function extractTrackingNumber(text: string) {
  return text.match(/\b\d{4}-\d{4}-\d{4}\b/)?.[0] || "";
}

function extractOrderNumber(text: string) {
  const normalized = text.replace(/\s+/g, " ");

  const shopOrder = normalized.match(/shop-\d{3}-\d{3}-\d{3}-\d{4}/i)?.[0];
  if (shopOrder) return shopOrder;

  const dateOrder = normalized.match(/\b\d{8}-\d{7}\b/)?.[0];
  if (dateOrder) return dateOrder;

  const afterReturnType = normalized.match(
    /(일반반품|변심반품|불량반품|불량교환)\s*★?\s*(\d{8,14})/
  )?.[2];
  if (afterReturnType) return afterReturnType;

  const beforeProduct = normalized.match(
    /\b(\d{8,14})\s*\/\s*(휴대용분유포트|분유쉐이커|LED분유쉐이커)/
  )?.[1];
  if (beforeProduct) return beforeProduct;

  return "";
}

function extractReturnType(text: string) {
  const normalized = text.replace(/\s+/g, " ");

  if (normalized.includes("불량교환")) return "불량교환";
  if (normalized.includes("불량반품")) return "불량반품";
  if (normalized.includes("변심반품") || normalized.includes("변심")) {
    return "변심반품";
  }
  if (normalized.includes("일반반품") || normalized.includes("일반")) {
    return "일반반품";
  }

  return "일반반품";
}

function extractProductName(text: string) {
  const normalized = text.replace(/\s+/g, " ");

  for (const product of PRODUCT_TYPES) {
    if (normalized.includes(product)) return product;
  }

  const slashProduct = normalized.match(/\/\s*([가-힣A-Za-z0-9]+)\s*\//)?.[1];
  if (slashProduct && PRODUCT_TYPES.includes(slashProduct)) {
    return slashProduct;
  }

  return "";
}

function extractCustomerName(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const addressKeywords = [
    "서울",
    "경기",
    "인천",
    "부산",
    "대구",
    "광주",
    "대전",
    "울산",
    "세종",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
  ];

  const blacklist = [
    "박승훈",
    "A1",
    "안성",
    "택배",
    "고객",
    "주소",
    "꿈비",
    "링크맘",
    "엄감",
    "받는분",
    "보내는분",
    "운임",
    "예약",
    "주문",
    "배달",
    "분유포트",
    "분유쉐이커",
    "휴대용분유포트",
    "LED분유쉐이커",
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (addressKeywords.some((keyword) => line.includes(keyword))) {
      const candidate = lines[i - 1]?.replace(/\s/g, "");

      if (
        candidate &&
        /^[가-힣*]{2,5}$/.test(candidate) &&
        !blacklist.includes(candidate)
      ) {
        return candidate;
      }
    }
  }

  const masked = text.match(/[가-힣]\*[가-힣]/)?.[0];
  if (masked && !blacklist.includes(masked)) return masked;

  return "";
}

function extractAddress(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const addressKeywords = [
    "서울",
    "경기",
    "인천",
    "부산",
    "대구",
    "광주",
    "대전",
    "울산",
    "세종",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
  ];

  const addressLine = lines.find((line) =>
    addressKeywords.some((keyword) => line.startsWith(keyword))
  );

  return addressLine || "";
}

export function parseInvoiceText(input: string): ParsedInvoice {
  const rawText = normalize(input);

  return {
    rawText,
    trackingNumber: extractTrackingNumber(rawText),
    customerName: extractCustomerName(rawText),
    returnType: extractReturnType(rawText),
    orderNumber: extractOrderNumber(rawText),
    productName: extractProductName(rawText),
    address: extractAddress(rawText),
  };
}