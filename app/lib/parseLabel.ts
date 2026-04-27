export function parseLabelText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  // 송장번호
  const trackingMatch =
    normalized.match(/\b\d{4}-\d{4}-\d{4}\b/) ||
    normalized.match(/\b\d{12}\b/);

  const trackingNumber = trackingMatch ? trackingMatch[0] : "";

  // 휴대폰 번호
  const phoneMatch =
    normalized.match(/\b01[0-9]-?\d{3,4}-?\d{4}\b/) ||
    normalized.match(/\b050[0-9]-?\d{3,4}-?\d{4}\b/);

  const phoneNumber = phoneMatch ? phoneMatch[0] : "";

  // 고객명
  const customerName = extractCustomerName(text);

  // 주소
  let address = "";

  const addressMatch =
    normalized.match(
      /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣0-9\s\-().,]+/
    ) ||
    normalized.match(
      /대구\s서구\s문화로\s230\s?\(평리동\)\s?반도유보라?\s?\d{3}\s?\d{3,4}/
    );

  if (addressMatch) {
    address = addressMatch[0].trim();
  }

  return {
    trackingNumber,
    customerName,
    phoneNumber,
    address,
    rawText: text,
  };
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
    "주식회사",
    "꿈비",
    "링크맘",
    "엄감",
    "받는분",
    "보내는분",
    "발지",
    "착지",
    "수량",
    "운임",
    "예약",
    "주문",
    "인수",
    "배달",
    "휴대용",
    "분유포트",
    "분유쉐이커",
  ];

  // 1순위: 주소 바로 위 줄
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

  // 2순위: 마스킹 이름
  const maskedName = text.match(/[가-힣]\*[가-힣]/);
  if (maskedName && !blacklist.includes(maskedName[0])) {
    return maskedName[0];
  }

  return "";
}