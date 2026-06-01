export function parseLabelText(text: string) {
  const normalized = normalizeText(text);

  const trackingNumber = extractTrackingNumber(normalized);
  const phoneNumber = extractPhoneNumber(normalized);
  const memo = extractReturnMemo(normalized);
  const returnType = extractReturnType(normalized);
  const orderNumbers = extractOrderNumbers(normalized, memo);
  const orderNumber = orderNumbers[0] || "";
  const productName = extractProductName(normalized, memo);

  // 원본 OCR + 보정된 OCR을 같이 사용해서 고객명 추출률 보강
  const customerName = extractCustomerName(`${normalized}\n${text}`);

  const address = extractAddress(normalized);

  return {
    trackingNumber,
    customerName,
    phoneNumber,
    address,

    // 아래 항목들은 자동 분류/주문번호 입력에 필요해서 같이 반환
    returnType,
    orderNumber,

    // 주문번호가 2개 이상 있는 송장 대비용
    // page.tsx에서 사용하지 않아도 기존 동작에는 영향 없음
    orderNumbers,

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

    // 자주 깨지는 라벨 정규화
    .replace(/주\s*문\s*번\s*호/g, "주문번호")
    .replace(/주\s*문\s*번\s*오/g, "주문번호")
    .replace(/주\s*문\s*버\s*호/g, "주문번호")
    .replace(/주\s*문\s*N\s*O/gi, "주문NO")
    .replace(/주\s*문\s*N\s*0/gi, "주문NO")
    .replace(/송\s*장\s*번\s*호/g, "송장번호")
    .replace(/운\s*송\s*장\s*번\s*호/g, "운송장번호")
    .replace(/예\s*약\s*번\s*호/g, "예약번호")

    // 반품유형 OCR 보정
    .replace(/일\s*반\s*반\s*품/g, "일반반품")
    .replace(/변\s*심\s*반\s*품/g, "변심반품")
    .replace(/불\s*량\s*반\s*품/g, "불량반품")
    .replace(/불\s*량\s*교\s*환/g, "불량교환")
    .replace(/불량\s*교환/g, "불량교환")
    .replace(/불량\s*반품/g, "불량반품")
    .replace(/변심\s*반품/g, "변심반품")
    .replace(/일반\s*반품/g, "일반반품")

    // 자주 쓰는 메모 문구 OCR 보정
    .replace(/링\s*크\s*맘/g, "링크맘")
    .replace(/엄\s*감/g, "엄감")

    // 제품명 OCR 보정
    .replace(/분\s*리\s*형/g, "분리형")
    .replace(/분\s*리\s*행/g, "분리형")
    .replace(/분\s*리\s*헝/g, "분리형")
    .replace(/분\s*리\s*식/g, "분리식")
    .replace(/탈\s*착\s*형/g, "탈착형")
    .replace(/휴\s*대\s*용/g, "휴대용")
    .replace(/분\s*유\s*포\s*트/g, "분유포트")
    .replace(/분\s*유\s*포\s*드/g, "분유포드")
    .replace(/분\s*유\s*쉐\s*이\s*커/g, "분유쉐이커")
    .replace(/분\s*유\s*셰\s*이\s*커/g, "분유셰이커")
    .replace(/엘\s*이\s*디/g, "LED")
    .replace(/L\s*E\s*D/gi, "LED")

    // AS/검수
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
  // 예: 5737-4457-2796
  const hyphenMatch = text.match(/\b\d{4}-\d{4}-\d{4}\b/);
  if (hyphenMatch) return hyphenMatch[0];

  // 예: 573744572796
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
  // ★변심반품 링크맘 엄감★C2026021834143301 / 분유쉐이커
  // ★변심반품 링크맘 엄감★20260521-0001178 / 20260519-0000797 / 휴대용분유포트
  // ★불량교환★20260517-0000592 / 분리형 휴대용분유포트
  // ★변심반품 링크맘 엄감★2026051689680791 / 분리형 휴대용분유포트
  const starMemoMatch = text.match(
    /★[^★]*(일반반품|변심반품|불량반품|불량교환|AS|검수)[^★]*★\s*[0-9A-Za-z가-힣\-_/() ]{5,}/
  );

  if (starMemoMatch) {
    return starMemoMatch[0].trim();
  }

  // 별표 OCR이 깨졌거나 일부만 인식된 경우
  const fallbackMatch = text.match(
    /(일반반품|변심반품|불량반품|불량교환|AS|검수)[가-힣A-Za-z0-9\s★/_()\-]{5,}/
  );

  if (fallbackMatch) {
    return fallbackMatch[0].trim();
  }

  // 한진 송장 특이사항 칸에서 반품유형 이후만 길게 잡기
  const specialMemoMatch = text.match(
    /(관리기종|이웃|기타|특이사항)[가-힣A-Za-z0-9\s★/_()\-]{0,80}(일반반품|변심반품|불량반품|불량교환|AS|검수)[가-힣A-Za-z0-9\s★/_()\-]{5,}/
  );

  return specialMemoMatch ? specialMemoMatch[0].trim() : "";
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
    if (text.includes(type) || compact.includes(type)) return type;
  }

  return "";
}

function extractOrderNumber(text: string, memo: string) {
  return extractOrderNumbers(text, memo)[0] || "";
}

function extractOrderNumbers(text: string, memo: string) {
  const results: string[] = [];

  const add = (value: string) => {
    if (!value) return;
    if (!results.includes(value)) results.push(value);
  };

  const targets = [memo, text].filter(Boolean);

  for (const target of targets) {
    findOrderNumbersInText(target).forEach(add);
  }

  // OCR에서 숫자 사이에 공백이 들어간 경우 대비
  const compactText = text.replace(/\s+/g, "");
  const compactMemo = memo.replace(/\s+/g, "");
  const compactTargets = [compactMemo, compactText].filter(Boolean);

  for (const target of compactTargets) {
    findOrderNumbersInText(target).forEach(add);
  }

  return results;
}

function cleanOrderNumber(value: string, allowShort = false) {
  const cleaned = value
    .replace(/[^0-9C-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  // 예: C2026021834143301
  if (/^C20\d{8,}$/.test(cleaned)) return cleaned;

  // 예: 20260517-0000592
  if (/^20\d{6}-\d{3,}$/.test(cleaned)) return cleaned;

  // 예: 2026051689680791
  if (/^20\d{11,}$/.test(cleaned)) return cleaned;

  // 예: OCR이 하이픈을 빼고 읽은 202605170000592
  if (/^20\d{13,}$/.test(cleaned)) return cleaned;

  // 예: 2026052339
  // 짧은 주문번호는 반품유형/링크맘/별표 근처에서 잡힌 경우에만 허용
  if (allowShort && /^20\d{8,18}$/.test(cleaned)) return cleaned;

  return "";
}

function findOrderNumbersInText(target: string) {
  const found: string[] = [];

  const add = (value: string, allowShort = false) => {
    const cleaned = cleanOrderNumber(value, allowShort);
    if (cleaned && !found.includes(cleaned)) {
      found.push(cleaned);
    }
  };

  const compactTarget = target.replace(/\s+/g, "");

  const labelPattern =
    "(?:주문\\s*번호|주문번호|주문\\s*NO|주문NO|주문\\s*No|주문\\s*no|주문\\s*N0|주문N0|주문|ORDER\\s*NO|ORDER\\s*NUMBER|ORDER|오더\\s*번호|오더)";

  // 1순위: 주문번호 라벨 뒤
  const labeledOrderMatches = target.matchAll(
    new RegExp(`${labelPattern}[^0-9C]{0,40}([C]?[0-9][0-9\\s\\-]{7,35})`, "gi")
  );

  for (const match of labeledOrderMatches) {
    add(match[1], true);
  }

  // 2순위: 배송메모 별표 뒤 주문번호
  const starOrderMatches = target.matchAll(
    /★[^★]*(?:일반반품|변심반품|불량반품|불량교환|AS|검수)[^★]*★[^0-9C]{0,40}([C]?[0-9][0-9\s-]{7,35})/gi
  );

  for (const match of starOrderMatches) {
    add(match[1], true);
  }

  // 3순위: 반품유형 글자 뒤에 바로 나오는 주문번호
  const returnTypeOrderMatches = target.matchAll(
    /(?:일반반품|변심반품|불량반품|불량교환|AS|검수)[^0-9C]{0,120}([C]?[0-9][0-9\s-]{7,35})/gi
  );

  for (const match of returnTypeOrderMatches) {
    add(match[1], true);
  }

  // 4순위: 링크맘 엄감 뒤에 나오는 주문번호
  const linkmomOrderMatches = target.matchAll(
    /링크맘\s*엄감[^0-9C]{0,120}([C]?[0-9][0-9\s-]{7,35})/gi
  );

  for (const match of linkmomOrderMatches) {
    add(match[1], true);
  }

  // 5순위: 반품/제품명 근처 긴 숫자 주문번호
  const contextualLongMatches = target.matchAll(
    /(?:일반반품|변심반품|불량반품|불량교환|링크맘|엄감|분리형|휴대용|분유포트|분유쉐이커|LED)[^0-9]{0,160}(20\d{8,18})/g
  );

  for (const match of contextualLongMatches) {
    add(match[1], true);
  }

  // 6순위: C로 시작하는 쿠팡 주문번호
  const coupangOrderMatches = target.matchAll(/\bC\s*20[0-9\s-]{8,25}\b/gi);

  for (const match of coupangOrderMatches) {
    add(match[0], false);
  }

  // 7순위: 20260517-0000592
  const dashOrderMatches = target.matchAll(/\b20\d{6}\s*-\s*\d{3,}\b/g);

  for (const match of dashOrderMatches) {
    add(match[0], false);
  }

  // 8순위: 2026051689680791 같은 긴 숫자 주문번호
  const longOrderMatches = target.matchAll(/\b20\d{8,18}\b/g);

  for (const match of longOrderMatches) {
    const around = getAroundText(target, match.index || 0, 100);

    // 날짜, 전화번호, 송장번호 오인식 방지
    // 주변에 반품/제품/링크맘/엄감이 있으면 주문번호로 인정
    if (
      /(일반반품|변심반품|불량반품|불량교환|AS|검수|링크맘|엄감|분리형|휴대용|분유포트|분유쉐이커|LED)/.test(
        around
      )
    ) {
      add(match[0], true);
    }
  }

  // 9순위: 숫자 사이에 공백이 낀 긴 주문번호
  const spacedLongOrderMatches = target.matchAll(/\b2\s*0(?:\s*\d){8,18}\b/g);

  for (const match of spacedLongOrderMatches) {
    add(match[0], true);
  }

  // 10순위: 공백 제거 버전에서도 한 번 더
  const compactLongMatches = compactTarget.matchAll(/20\d{8,18}/g);

  for (const match of compactLongMatches) {
    add(match[0], true);
  }

  return found;
}

function getAroundText(text: string, index: number, size = 100) {
  const start = Math.max(0, index - size);
  const end = Math.min(text.length, index + size);
  return text.slice(start, end);
}

function extractProductName(text: string, memo: string) {
  const target = `${memo || ""} ${text || ""}`;

  const compact = target
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]［］]/g, "")
    .toUpperCase();

  const hasSeparateKeyword =
    compact.includes("분리형") ||
    compact.includes("분리식") ||
    compact.includes("탈착형") ||
    compact.includes("분리행") ||
    compact.includes("분리헝") ||
    compact.includes("분리형휴대용") ||
    compact.includes("분리형분유") ||
    compact.includes("분리형포트");

  // OCR 원문에 "분리형" 계열 글자가 보이면 우선 분리형으로 분류
  if (hasSeparateKeyword) {
    return "(분리형) 휴대용분유포트";
  }

  // LED분유쉐이커는 "분유쉐이커"도 포함되므로 일반 분유쉐이커보다 먼저 검사
  if (
    compact.includes("LED분유쉐이커") ||
    compact.includes("LED분유셰이커") ||
    compact.includes("LED쉐이커") ||
    compact.includes("LED셰이커") ||
    compact.includes("엘이디분유쉐이커") ||
    compact.includes("엘이디분유셰이커") ||
    compact.includes("엘이디쉐이커") ||
    compact.includes("엘이디셰이커")
  ) {
    return "LED분유쉐이커";
  }

  if (
    compact.includes("분유쉐이커") ||
    compact.includes("분유셰이커") ||
    compact.includes("쉐이커") ||
    compact.includes("셰이커")
  ) {
    return "[꿈비] 분유쉐이커";
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

  // 너무 길게 잡히는 것 방지
  address = address
    .replace(/운송장번호.*$/g, "")
    .replace(/예약번호.*$/g, "")
    .replace(/주문번호.*$/g, "")
    .replace(/수량.*$/g, "")
    .replace(/운임.*$/g, "")
    .replace(/받는분.*$/g, "")
    .replace(/보내분.*$/g, "")
    .replace(/보내는분.*$/g, "")
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
    "보내분",
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

  // 1순위: "보내분 / 보내는분 / 보낸분" 근처에서 찾기
  // 한진 회수 송장은 받는분이 꿈비/안성이고, 보내분이 실제 고객인 경우가 많음
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      line.includes("보내는분") ||
      line.includes("보낸분") ||
      line.includes("보내분") ||
      line.includes("보내") ||
      line.includes("발송")
    ) {
      const nearby = [
        line,
        lines[i + 1] || "",
        lines[i + 2] || "",
        lines[i + 3] || "",
        lines[i - 1] || "",
      ].join(" ");

      const name = findBestNameCandidate(nearby, blacklist);
      if (name) return name;
    }
  }

  // 2순위: 한 줄 OCR에서 "보내분 ... 고객명" 구조 직접 추출
  const senderAreaMatches = text.matchAll(
    /(보내분|보내는분|보낸분|보내)[가-힣0-9A-Za-z\s\-().,*]{0,120}/g
  );

  for (const match of senderAreaMatches) {
    const area = match[0];
    const name = findBestNameCandidate(area, blacklist);
    if (name) return name;
  }

  // 3순위: 주소 바로 위/아래 줄에서 찾기
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (addressKeywords.some((keyword) => line.includes(keyword))) {
      const candidates = [
        lines[i - 2] || "",
        lines[i - 1] || "",
        lines[i + 1] || "",
        lines[i + 2] || "",
      ];

      for (const candidateLine of candidates) {
        const name = findBestNameCandidate(candidateLine, blacklist);
        if (name) return name;
      }
    }
  }

  // 4순위: 전체 텍스트에서 마스킹 이름 찾기
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

  // 5순위: 일반 한글 이름 후보
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
    "백범로",
    "마포구",
    "성동구",
    "시청대로",
    "운송장",
    "송장번호",
    "예약번호",
    "주문번호",
    "받는분",
    "보낸분",
    "보내는",
    "보내분",
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
    "셰이커",
    "휴대용",
    "분리형",
    "링크맘",
    "엄감",
    "관리기종",
    "이웃",
    "기타",
    "특이사항",
    "착지신용",
  ];

  if (badWords.some((word) => name.includes(word) || word.includes(name))) {
    return false;
  }

  return true;
}