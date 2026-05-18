export function parseLabelText(text: string) {
  const normalized = normalizeText(text);

  const trackingNumber = extractTrackingNumber(normalized);
  const phoneNumber = extractPhoneNumber(normalized);
  const memo = extractReturnMemo(normalized);
  const returnType = extractReturnType(normalized);
  const orderNumber = extractOrderNumber(normalized, memo);
  const productName = extractProductName(normalized, memo);
  const customerName = extractCustomerName(text);
  const address = extractAddress(normalized);

  return {
    trackingNumber,
    customerName,
    phoneNumber,
    address,

    // 아래 항목들은 자동 분류/주문번호 입력에 필요해서 같이 반환
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
    .replace(/\s+/g, " ")
    .replace(/★\s+/g, "★")
    .replace(/\s+★/g, "★")
    .trim();
}

function extractTrackingNumber(text: string) {
  // 예: 5737-1043-3181
  const hyphenMatch = text.match(/\b\d{4}-\d{4}-\d{4}\b/);
  if (hyphenMatch) return hyphenMatch[0];

  // 예: 573710433181
  const compactMatch = text.match(/\b\d{12}\b/);
  if (compactMatch) {
    const num = compactMatch[0];
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
  // 예:
  // ★변심반품 링크맘 엄감★2026041325853071
  // ★일반반품 링크맘 엄감★20260123-0002995 / 휴대용분유포트
  // ★일반반품 링크맘 엄감★20260123-0002995 / (분리형) 휴대용분유포트
  const starMemoMatch = text.match(
    /★[^★]*(일반반품|변심반품|불량반품|불량교환|AS|검수)[^★]*★\s*[0-9A-Za-z가-힣\-_/() ]{5,}/
  );

  if (starMemoMatch) {
    return starMemoMatch[0].trim();
  }

  // 별표 OCR이 깨졌을 때 대비
  const fallbackMatch = text.match(
    /(일반반품|변심반품|불량반품|불량교환|AS|검수)[가-힣A-Za-z0-9\s★/_()\-]{5,}/
  );

  return fallbackMatch ? fallbackMatch[0].trim() : "";
}

function extractReturnType(text: string) {
  const returnTypes = [
    "불량교환",
    "불량반품",
    "변심반품",
    "일반반품",
    "AS",
    "검수",
  ];

  for (const type of returnTypes) {
    if (text.includes(type)) return type;
  }

  return "";
}

function extractOrderNumber(text: string, memo: string) {
  const target = memo || text;

  // 배송메모 뒤 주문번호 우선 추출
  const starOrderMatch = target.match(
    /★[^★]*(?:일반반품|변심반품|불량반품|불량교환|AS|검수)[^★]*★\s*([0-9]{8,}(?:-[0-9]+)?)/i
  );

  if (starOrderMatch) return starOrderMatch[1];

  // 예: 20260123-0002995
  const dashOrderMatch = target.match(/\b20\d{6}-\d{4,}\b/);
  if (dashOrderMatch) return dashOrderMatch[0];

  // 예: 2026041325853071
  const longOrderMatch = target.match(/\b20\d{12,}\b/);
  if (longOrderMatch) return longOrderMatch[0];

  return "";
}

function extractProductName(text: string, memo: string) {
  const target = `${memo || ""} ${text || ""}`;

  const compact = target
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]［］]/g, "")
    .toUpperCase();

  // 중요:
  // 분리형은 "휴대용분유포트"라는 단어도 같이 포함될 수 있어서
  // 반드시 기존 휴대용분유포트보다 먼저 검사해야 함
  if (
    compact.includes("분리형휴대용분유포트") ||
    compact.includes("분리형분유포트") ||
    compact.includes("분리형")
  ) {
    return "(분리형) 휴대용분유포트";
  }

  // LED분유쉐이커는 "분유쉐이커"도 포함되므로 일반 분유쉐이커보다 먼저 검사
  if (
    compact.includes("LED분유쉐이커") ||
    compact.includes("엘이디분유쉐이커") ||
    compact.includes("LED쉐이커")
  ) {
    return "LED분유쉐이커";
  }

  if (
    compact.includes("분유쉐이커") ||
    compact.includes("쉐이커")
  ) {
    return "분유쉐이커";
  }

  if (
    compact.includes("휴대용분유포트") ||
    compact.includes("휴대용포트") ||
    compact.includes("분유포트")
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

  // 너무 길게 잡히는 것 방지
  address = address
    .replace(/운송장번호.*$/g, "")
    .replace(/예약번호.*$/g, "")
    .replace(/주문번호.*$/g, "")
    .replace(/수량.*$/g, "")
    .trim();

  return address;
}

function extractCustomerName(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blacklist = [
    "박승훈",
    "이지어드민",
    "주식회사",
    "꿈비",
    "한진택배",
    "택배",
    "링크맘",
    "엄감",
    "A1",
    "SS",
    "MA",
    "착지신용",
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
    "주소",
    "전화",
    "고객",
    "안성",
    "고삼",
    "미록로",
    "봉산리",
    "휴대용",
    "분유포트",
    "분유쉐이커",
    "LED",
    "일반반품",
    "변심반품",
    "불량반품",
    "불량교환",
    "검수",
    "분리형",
  ];

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

  // 1순위: "보내는분 / 보낸분" 근처에서 찾기
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      line.includes("보내는분") ||
      line.includes("보낸분") ||
      line.includes("보내") ||
      line.includes("발송")
    ) {
      const nearby = [
        line,
        lines[i + 1] || "",
        lines[i + 2] || "",
        lines[i - 1] || "",
      ].join(" ");

      const name = findBestNameCandidate(nearby, blacklist);
      if (name) return name;
    }
  }

  // 2순위: 주소 바로 위/아래 줄에서 찾기
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (addressKeywords.some((keyword) => line.includes(keyword))) {
      const candidates = [
        lines[i - 2] || "",
        lines[i - 1] || "",
        lines[i + 1] || "",
      ];

      for (const candidateLine of candidates) {
        const name = findBestNameCandidate(candidateLine, blacklist);
        if (name) return name;
      }
    }
  }

  // 3순위: 전체 텍스트에서 마스킹 이름 찾기
  const maskedPatterns = [
    /[가-힣]\*{1,2}[가-힣]/g, // 김*정, 이**영
    /[가-힣]\*{1,2}/g, // 김**, 이*
    /[가-힣]{2,3}\*/g, // 김영*
  ];

  for (const pattern of maskedPatterns) {
    const matches = text.match(pattern) || [];

    for (const match of matches) {
      const clean = match.replace(/\s/g, "");
      if (isValidNameCandidate(clean, blacklist)) {
        return clean;
      }
    }
  }

  // 4순위: 일반 한글 이름 후보
  const normalName = findBestNameCandidate(text, blacklist);
  if (normalName) return normalName;

  return "";
}

function findBestNameCandidate(text: string, blacklist: string[]) {
  const cleaned = text
    .replace(/[0-9]/g, " ")
    .replace(/[A-Za-z]/g, " ")
    .replace(/[(){}\[\]<>.,:;|/_\-]/g, " ")
    .replace(/\s+/g, " ");

  const candidates = cleaned.match(/[가-힣*]{2,5}/g) || [];

  for (const candidate of candidates) {
    const name = candidate.replace(/\s/g, "");

    if (isValidNameCandidate(name, blacklist)) {
      return name;
    }
  }

  return "";
}

function isValidNameCandidate(name: string, blacklist: string[]) {
  if (!name) return false;

  if (name.length < 2 || name.length > 5) return false;

  // 한글 또는 *만 허용
  if (!/^[가-힣*]+$/.test(name)) return false;

  // 별만 있는 경우 제외
  if (/^\*+$/.test(name)) return false;

  // 고정 제외어 포함 시 제외
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
  ];

  if (badWords.some((word) => name.includes(word) || word.includes(name))) {
    return false;
  }

  return true;
}