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
  let customerName = "";

  // 1순위: 완전한 이름
  const fullNameMatch = normalized.match(/이[가-힣]{1,2}지/);
  if (fullNameMatch) {
    customerName = fullNameMatch[0];
  }

  // 2순위: 마스킹 이름
  if (!customerName) {
    const maskedName = normalized.match(/[가-힣]\*[가-힣]/);
    if (maskedName) {
      customerName = maskedName[0];
    }
  }

  // 3순위: 일반 이름 후보
  if (!customerName) {
    const nameCandidates = normalized.match(/\b[가-힣]{2,3}\b/g) || [];

    const blacklist = [
      "안성",
      "경기",
      "대구",
      "서구",
      "고삼",
      "미륵",
      "반도",
      "유보",
      "택배",
      "고객",
      "주소",
      "문화",
      "평리",
      "봉산",
      "주식",
      "회사",
      "꿈비",
      "링크",
      "엄감",
      "받는분",
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
      "유상",
      "고삼면",
    ];

    for (const name of nameCandidates) {
      if (!blacklist.includes(name)) {
        customerName = name;
        break;
      }
    }
  }

  // 주소
  let address = "";

  const addressMatch = normalized.match(
    /대구\s서구\s문화로\s230\s?\(평리동\)\s?반도유보라?\s?\d{3}\s?\d{3,4}/
  );

  if (addressMatch) {
    address = addressMatch[0];
  }

  return {
    trackingNumber,
    customerName,
    phoneNumber,
    address,
    rawText: text,
  };
}