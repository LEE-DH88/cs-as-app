export type ParsedInvoice = {
  rawText: string;
  trackingNumber: string;
  customerName: string;
  returnType: string;
  orderNumber: string;
  productName: string;
  address: string;
  memo: string;
};

function cleanText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function findTrackingNumber(text: string) {
  return text.match(/\d{4}-\d{4}-\d{4}/)?.[0] ?? "";
}

function findReturnType(text: string) {
  return text.match(/(일반반품|변심반품|불량반품|불량교환|AS|검수)/)?.[0] ?? "";
}

function findOrderNumber(text: string) {
  return (
    text.match(/shop-\d{3}-\d{3}-\d{3}-\d{4}/i)?.[0] ??
    text.match(/\d{8}-\d{7}/)?.[0] ??
    ""
  );
}

function findProductName(text: string, orderNumber: string) {
  if (!orderNumber) return "";

  const escaped = orderNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex1 = new RegExp(`${escaped}\\s*\\/\\s*([^\\n\\/]+)`);
  const regex2 = new RegExp(`${escaped}\\s+([^\\n\\/]+)`);

  const match1 = text.match(regex1)?.[1]?.trim();
  if (match1) return match1.replace(/^\//, "").trim();

  const match2 = text.match(regex2)?.[1]?.trim();
  if (match2) return match2.replace(/^\//, "").trim();

  return "";
}

function findCustomerName(text: string) {
  const lines = text
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/운송장번호|받는분|보내는분|주소|전화|박스|수량|예약번호/.test(line)) continue;

    const masked = line.match(/\b[가-힣]\*[가-힣]{1,2}\b/);
    if (masked?.[0]) return masked[0];

    const plain = line.match(/\b[가-힣]{2,4}\b/);
    if (
      plain?.[0] &&
      !/일반반품|변심반품|불량반품|불량교환|링크맘|엄감|주식회사|꿈비|착지신용/.test(
        plain[0]
      )
    ) {
      return plain[0];
    }
  }

  return "";
}

function findAddress(text: string) {
  const addressMatch = text.match(
    /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]+/
  );
  return addressMatch?.[0]?.trim() ?? "";
}

function buildMemo(returnType: string, orderNumber: string, productName: string, customerName: string) {
  switch (returnType) {
    case "일반반품":
      return orderNumber ? `★일반반품 링크맘 엄감★${orderNumber}` : "";
    case "변심반품":
      return orderNumber ? `★변심반품 링크맘 엄감★${orderNumber}` : "";
    case "불량반품":
      return orderNumber
        ? `★불량반품★${orderNumber}${productName ? ` / ${productName}` : ""}`
        : "";
    case "불량교환":
      return orderNumber
        ? `★불량교환★${orderNumber}${productName ? ` / ${productName}` : ""}`
        : "";
    case "AS":
      return customerName
        ? `★AS 링크맘 엄감★ ${customerName}고객님${productName ? ` / ${productName}` : ""}`
        : "";
    case "검수":
      return customerName
        ? `★검수 링크맘 엄감★ ${customerName}고객님${productName ? ` / ${productName}` : ""}`
        : "";
    default:
      return "";
  }
}

export function parseInvoiceText(input: string): ParsedInvoice {
  const rawText = cleanText(input);

  const trackingNumber = findTrackingNumber(rawText);
  const returnType = findReturnType(rawText);
  const orderNumber = findOrderNumber(rawText);
  const productName = findProductName(rawText, orderNumber);
  const customerName = findCustomerName(rawText);
  const address = findAddress(rawText);
  const memo = buildMemo(returnType, orderNumber, productName, customerName);

  return {
    rawText,
    trackingNumber,
    customerName,
    returnType,
    orderNumber,
    productName,
    address,
    memo,
  };
}