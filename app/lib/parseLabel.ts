export function parseLabelText(text: string) {
  const normalized = normalizeText(text);

  const trackingNumber = extractTrackingNumber(normalized);
  const phoneNumber = extractPhoneNumber(normalized);
  const memo = extractReturnMemo(normalized);
  const returnType = extractReturnType(normalized);
  const orderNumber = extractOrderNumber(normalized, memo);
  const productName = extractProductName(normalized, memo);
  const customerName = extractCustomerName(text, normalized);
  const address = extractAddress(normalized);

  return {
    trackingNumber,
    invoiceNumber: trackingNumber,

    customerName,
    phoneNumber,
    address,

    returnType,
    orderNumber,
    productName,
    memo,

    rawText: text,
  };
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[［\[\]］]/g, " ")
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/[－–—]/g, "-")
    .replace(/[＊]/g, "*")
    .replace(/[★☆]/g, "★")
    .replace(/주\s*문\s*번\s*호/g, "주문번호")
    .replace(/송\s*장\s*번\s*호/g, "송장번호")
    .replace(/운\s*송\s*장\s*번\s*호/g, "운송장번호")
    .replace(/예\s*약\s*번\s*호/g, "예약번호")
    .replace(/보\s*내\s*는\s*분/g, "보내는분")
    .replace(/보\s*낸\s*분/g, "보낸분")
    .replace(/받\s*는\s*분/g, "받는분")
    .replace(/분\s*리\s*형/g, "분리형")
    .replace(/분\s*리\s*함/g, "분리형")
    .replace(/분\s*리\s*형/g, "분리형")
    .replace(/휴\s*대\s*용/g, "휴대용")
    .replace(/분\s*유\s*포\s*트/g, "분유포트")
    .replace(/분\s*유\s*포\s*드/g, "분유포트")
    .replace(/분\s*유\s*쉐\s*이\s*커/g, "분유쉐이커")
    .replace(/분\s*유\s*셰\s*이\s*커/g, "분유쉐이커")
    .replace(/엘\s*이\s*디/g, "LED")
    .replace(/L\s*E\s*D/gi, "LED")
    .replace(/A\s*\/\s*S/gi, "AS")
    .replace(/A\s+S/gi, "AS")
    .replace(/에\s*이\s*에\s*스/g, "AS")
    .replace(/검\s*수/g, "검수")
    .replace(/\s+/g, " ")
    .replace(/★\s+/g, "★")
    .replace(/\s+★/g, "★")
    .trim();
}

function extractTrackingNumber(text: string) {
  const hyphenMatch = text.match(/\b\d{4}-\d{4}-\d{4}\b/);
  if (hyphenMatch) return hyphenMatch[0];

  const compactMatch = text.match(/\b\d{12}\b/);
  if (compactMatch) {
    const num = compactMatch[0];
    return `${num.slice(0, 4)}-${num.slice(4, 8)}-${num.slice(8, 12)}`;
  }

  const brokenMatch = text.match(/\b\d{4}\s+\d{4}\s+\d{4}\b/);
  if (brokenMatch) {
    const num = brokenMatch[0].replace(/\s+/g, "");
    return `${num.slice(0, 4)}-${num.slice(4, 8)}-${num.slice(8, 12)}`;
  }

  return "";
}

function extractPhoneNumber(text: string) {
  const phoneMatch =
    text.match(/\b01[0-9]-?\d{3,4}-?\d{4}\b/) ||
    text.match(/\b050[0-9]-?\d{3,4}-?\d{4}\b/) ||
    text.match(/\b02-?\d{3,4}-?\d{4}\b/);

  return phoneMatch ? phoneMatch[0] : "";
}

function extractReturnMemo(text: string) {
  const memoPatterns = [
    /★[^★]*(일반반품|변심반품|불량반품|불량교환|AS|검수)[^★]*★\s*[0-9A-Za-z가-힣\-_/() ]{4,}/,
    /(일반반품|변심반품|불량반품|불량교환|AS|검수)[가-힣A-Za-z0-9\s★/_()\-]{4,}/,
  ];

  for (const pattern of memoPatterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }

  return "";
}

function extractReturnType(text: string) {
  const compact = text.replace(/\s+/g, "");

  const returnTypes = [
    "불량교환",
    "불량반품",
    "변심반품",
    "일반반품",
    "AS",
    "검수",
  ];

  for (const type of returnTypes) {
    if (compact.includes(type)) return type;
  }

  return "";
}

function extractOrderNumber(text: string, memo: string) {
  const targets = [
    memo,
    text,
    memo.replace(/\s+/g, ""),
    text.replace(/\s+/g, ""),
  ].filter(Boolean);

  for (const target of targets) {
    const found = findOrderNumberInText(target);
    if (found) return found;
  }

  return "";
}

function cleanOrderNumber(value: string) {
  const cleaned = value
    .replace(/[Oo]/g, "0")
    .replace(/[Il]/g, "1")
    .replace(/[^0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleaned) return "";

  // 예: 20260517-0000592
  if (/^20\d{6}-\d{3,}$/.test(cleaned)) return cleaned;

  // 예: 2026052160689381, 2026051689680791
  if (/^20\d{8,}$/.test(cleaned)) return cleaned;

  // 예: OCR이 짧게 잡은 2026052339
  if (/^20\d{8}$/.test(cleaned)) return cleaned;

  return "";
}

function findOrderNumberInText(target: string) {
  const labelPattern =
    "(?:주문\\s*번호|주문번호|주문\\s*NO|주문\\s*No|주문\\s*no|주문\\s*넘버|ORDER\\s*NO|ORDER\\s*NUMBER|ORDER|오더\\s*번호|오더)";

  // 1순위: 직접 주문번호 라벨
  const labeledOrderMatch = target.match(
    new RegExp(`${labelPattern}[^0-9]{0,30}([0-9][0-9\\s-]{7,30})`, "i")
  );

  if (labeledOrderMatch) {
    const cleaned = cleanOrderNumber(labeledOrderMatch[1]);
    if (cleaned) return cleaned;
  }

  // tb_ggumbi_32424 같은 내부 주문번호는 제외
  const withoutTbOrder = target.replace(/tb_?ggumbi_?\d+/gi, " ");

  // 2순위: 별표 메모 뒤 주문번호
  const starOrderMatch = withoutTbOrder.match(
    /★[^★]*(?:일반반품|변심반품|불량반품|불량교환|AS|검수)[^★]*★[^0-9]{0,30}([0-9][0-9\s-]{7,30})/i
  );

  if (starOrderMatch) {
    const cleaned = cleanOrderNumber(starOrderMatch[1]);
    if (cleaned) return cleaned;
  }

  // 3순위: 반품유형 뒤 주문번호
  const returnTypeOrderMatch = withoutTbOrder.match(
    /(?:일반반품|변심반품|불량반품|불량교환|AS|검수)[^0-9]{0,70}([0-9][0-9\s-]{7,30})/
  );

  if (returnTypeOrderMatch) {
    const cleaned = cleanOrderNumber(returnTypeOrderMatch[1]);
    if (cleaned) return cleaned;
  }

  // 4순위: 링크맘 엄감 뒤 주문번호
  const linkmomOrderMatch = withoutTbOrder.match(
    /링크맘\s*엄감[^0-9]{0,70}([0-9][0-9\s-]{7,30})/
  );

  if (linkmomOrderMatch) {
    const cleaned = cleanOrderNumber(linkmomOrderMatch[1]);
    if (cleaned) return cleaned;
  }

  // 5순위: 배송메모 라인에 붙은 긴 숫자
  const memoLineMatch = withoutTbOrder.match(
    /(?:변심반품|일반반품|불량반품|불량교환|AS|검수|링크맘|엄감)[^0-9]{0,80}(20\d[\d\s-]{7,25})/
  );

  if (memoLineMatch) {
    const cleaned = cleanOrderNumber(memoLineMatch[1]);
    if (cleaned) return cleaned;
  }

  // 6순위: 예: 20260517-0000592
  const dashOrderMatch = withoutTbOrder.match(/\b20\d{6}\s*-\s*\d{3,}\b/);
  if (dashOrderMatch) {
    const cleaned = cleanOrderNumber(dashOrderMatch[0]);
    if (cleaned) return cleaned;
  }

  // 7순위: 긴 주문번호, 송장번호보다 먼저 20으로 시작하는 숫자만 인정
  const longOrderMatches = withoutTbOrder.match(/\b20\d{8,18}\b/g) || [];
  for (const item of longOrderMatches) {
    const cleaned = cleanOrderNumber(item);
    if (cleaned) return cleaned;
  }

  // 8순위: 숫자 사이에 공백이 낀 주문번호
  const spacedLongOrderMatch = withoutTbOrder.match(/\b2\s*0(?:\s*\d){8,20}\b/);
  if (spacedLongOrderMatch) {
    const cleaned = cleanOrderNumber(spacedLongOrderMatch[0]);
    if (cleaned) return cleaned;
  }

  return "";
}

function extractProductName(text: string, memo: string) {
  const target = `${memo || ""} ${text || ""}`;

  const compact = target
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]［］]/g, "")
    .toUpperCase();

  const hasSeparateKeyword =
    compact.includes("분리형") ||
    compact.includes("분리함") ||
    compact.includes("분리식") ||
    compact.includes("탈착형") ||
    compact.includes("배터리분리") ||
    compact.includes("분리형휴대용") ||
    compact.includes("분리형분유") ||
    compact.includes("분리형포트");

  if (hasSeparateKeyword) {
    return "(분리형) 휴대용분유포트";
  }

  if (
    compact.includes("LED분유쉐이커") ||
    compact.includes("LED분유셰이커") ||
    compact.includes("엘이디분유쉐이커") ||
    compact.includes("엘이디분유셰이커") ||
    compact.includes("LED쉐이커") ||
    compact.includes("LED셰이커") ||
    compact.includes("LED")
  ) {
    return "LED분유쉐이커";
  }

  if (
    compact.includes("분유쉐이커") ||
    compact.includes("분유셰이커") ||
    compact.includes("쉐이커") ||
    compact.includes("셰이커")
  ) {
    return "분유쉐이커";
  }

  if (
    compact.includes("휴대용분유포트") ||
    compact.includes("휴대용분유포드") ||
    compact.includes("휴대용포트") ||
    compact.includes("분유포트") ||
    compact.includes("분유포드") ||
    compact.includes("분유폿")
  ) {
    return "휴대용분유포트";
  }

  return "";
}

function extractAddress(text: string) {
  const addressMatch = text.match(
    /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣0-9\s\-().,]+/
  );

  if (!addressMatch) return "";

  let address = addressMatch[0].trim();

  address = address
    .replace(/운송장번호.*$/g, "")
    .replace(/예약번호.*$/g, "")
    .replace(/주문번호.*$/g, "")
    .replace(/수량.*$/g, "")
    .trim();

  return address;
}

function extractCustomerName(originalText: string, normalizedText: string) {
  const originalLines = originalText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedLines = normalizedText
    .split(/[\n]/)
    .map((line) => line.trim())
    .filter(Boolean);

  const oneLine = normalizedText.replace(/\s+/g, " ");

  const blacklist = getNameBlacklist();

  // 1순위: 보내는분 / 보낸분 라벨 뒤쪽
  const senderPatterns = [
    /보내는분\s*([가-힣*]{2,5})/,
    /보낸분\s*([가-힣*]{2,5})/,
    /보내는\s*분\s*([가-힣*]{2,5})/,
    /보낸\s*분\s*([가-힣*]{2,5})/,
  ];

  for (const pattern of senderPatterns) {
    const match = oneLine.match(pattern);
    if (match) {
      const name = cleanName(match[1]);
      if (isValidNameCandidate(name, blacklist)) return name;
    }
  }

  // 2순위: 보내는분/보낸분/보내/발송 근처 줄
  const allLines = [...originalLines, ...normalizedLines];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];

    if (
      line.includes("보내는분") ||
      line.includes("보낸분") ||
      line.includes("보내") ||
      line.includes("발송")
    ) {
      const nearby = [
        line,
        allLines[i + 1] || "",
        allLines[i + 2] || "",
        allLines[i - 1] || "",
        allLines[i - 2] || "",
      ].join(" ");

      const name = findBestNameCandidate(nearby, blacklist);
      if (name) return name;
    }
  }

  // 3순위: 주소 라인 주변에서 고객명 찾기
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

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];

    if (addressKeywords.some((keyword) => line.includes(keyword))) {
      const candidates = [
        allLines[i - 3] || "",
        allLines[i - 2] || "",
        allLines[i - 1] || "",
        allLines[i + 1] || "",
        allLines[i + 2] || "",
      ];

      for (const candidateLine of candidates) {
        const name = findBestNameCandidate(candidateLine, blacklist);
        if (name) return name;
      }
    }
  }

  // 4순위: 마스킹 이름
  const maskedPatterns = [
    /[가-힣]\*{1,2}[가-힣]/g,
    /[가-힣]\*{1,2}/g,
    /[가-힣]{2,3}\*/g,
  ];

  for (const pattern of maskedPatterns) {
    const matches = normalizedText.match(pattern) || [];

    for (const match of matches) {
      const clean = cleanName(match);
      if (isValidNameCandidate(clean, blacklist)) {
        return clean;
      }
    }
  }

  // 5순위: 전체 텍스트 일반 이름 후보
  const normalName = findBestNameCandidate(normalizedText, blacklist);
  if (normalName) return normalName;

  return "";
}

function cleanName(value: string) {
  return value
    .replace(/[0-9A-Za-z]/g, "")
    .replace(/[(){}\[\]<>.,:;|/_\-]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function findBestNameCandidate(text: string, blacklist: string[]) {
  const cleaned = text
    .replace(/[0-9]/g, " ")
    .replace(/[A-Za-z]/g, " ")
    .replace(/[(){}\[\]<>.,:;|/_\-]/g, " ")
    .replace(/\s+/g, " ");

  const candidates = cleaned.match(/[가-힣*]{2,5}/g) || [];

  for (const candidate of candidates) {
    const name = cleanName(candidate);

    if (isValidNameCandidate(name, blacklist)) {
      return name;
    }
  }

  return "";
}

function getNameBlacklist() {
  return [
    "박승훈",
    "착지신용",
    "이지어드민",
    "주식회사",
    "꿈비",
    "한진택배",
    "택배",
    "링크맘",
    "엄감",
    "회수상품",
    "운송장번호",
    "예약번호",
    "주문번호",
    "수량",
    "운임",
    "발지",
    "착지",
    "배달",
    "인수자",
    "받는분",
    "보내는분",
    "보낸분",
    "보낸분용",
    "주소",
    "전화",
    "고객",
    "고객용",
    "안성",
    "안성시",
    "고삼",
    "고삼면",
    "미록로",
    "봉산리",
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
    "휴대용",
    "분유포트",
    "분유쉐이커",
    "쉐이커",
    "포트",
    "분유",
    "LED",
    "일반반품",
    "변심반품",
    "불량반품",
    "불량교환",
    "검수",
    "분리형",
    "휴대용분유포트",
    "분리형휴대용분유포트",
    "관계",
    "가족",
    "이웃",
    "기타",
    "운임",
    "선불",
    "착불",
    "보류내용",
    "폐기",
    "바랍니다",
  ];
}

function isValidNameCandidate(name: string, blacklist: string[]) {
  if (!name) return false;

  if (name.length < 2 || name.length > 5) return false;

  if (!/^[가-힣*]+$/.test(name)) return false;

  if (/^\*+$/.test(name)) return false;

  if (
    blacklist.some((bad) => {
      return name.includes(bad) || bad.includes(name);
    })
  ) {
    return false;
  }

  const badWords = [
    "경기",
    "서울",
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
    "안성시",
    "고삼면",
    "미록로",
    "봉산리",
    "두미포",
    "금강로",
    "방안로",
    "테리로",
    "운송장",
    "송장번호",
    "예약번호",
    "주문번호",
    "받는분",
    "보낸분",
    "보내는",
    "반품",
    "상품",
    "회수",
    "택배",
    "발지",
    "착지",
    "운임",
    "수량",
    "주소",
    "전화",
    "고객명",
    "고객님",
    "분유",
    "포트",
    "쉐이커",
    "휴대용",
    "분리형",
    "관계",
    "기타",
    "보류",
    "내용",
  ];

  if (badWords.some((word) => name.includes(word) || word.includes(name))) {
    return false;
  }

  return true;
}