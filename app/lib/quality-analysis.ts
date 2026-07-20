import type { AppReturnRecord } from "@/app/lib/google-storage";

export type QualityAnalysisInput = {
  startDate: string;
  endDate: string;
  productName?: string;
};

type RiskLevel = "일반" | "주의" | "긴급";

type IssueRule = {
  symptom: string;
  keywords: string[];
  safety?: boolean;
};

const ISSUE_RULES: IssueRule[] = [
  {
    symptom: "누전/감전 위험",
    keywords: ["누전", "감전", "전기통함", "전기가 통"],
    safety: true,
  },
  {
    symptom: "탄화/과열/연기",
    keywords: [
      "탄화",
      "그을림",
      "연기",
      "타는 냄새",
      "타는냄새",
      "과열",
      "발열",
      "녹아내림",
    ],
    safety: true,
  },
  {
    symptom: "누수/수분 유입",
    keywords: [
      "누수",
      "물샘",
      "물이 샘",
      "수분유입",
      "수분 유입",
      "침수",
      "물이 들어",
    ],
    safety: true,
  },
  {
    symptom: "파손/균열",
    keywords: ["파손", "깨짐", "균열", "금감", "금이 감", "부러짐"],
    safety: true,
  },
  {
    symptom: "전원 불량",
    keywords: [
      "전원불량",
      "전원 불량",
      "전원안됨",
      "전원 안됨",
      "무반응",
      "작동안함",
      "작동 안함",
      "켜지지",
    ],
  },
  {
    symptom: "충전 불량",
    keywords: [
      "충전불량",
      "충전 불량",
      "충전안됨",
      "충전 안됨",
      "충전이 안",
      "충전단자",
    ],
  },
  {
    symptom: "배터리 불량",
    keywords: [
      "배터리불량",
      "배터리 불량",
      "배터리소모",
      "배터리 소모",
      "방전",
      "배터리팽창",
      "배터리 팽창",
    ],
  },
  {
    symptom: "급수/출수 불량",
    keywords: [
      "급수불량",
      "급수 불량",
      "급수펌프",
      "급수 펌프",
      "급수안됨",
      "급수 안됨",
      "출수불량",
      "출수 불량",
      "출수량",
      "물이 안나",
      "물이 안 나",
    ],
  },
  {
    symptom: "센서 감지 불량",
    keywords: [
      "센서불량",
      "센서 불량",
      "수위센서",
      "수위 센서",
      "감지불량",
      "감지 불량",
      "인식불량",
      "인식 불량",
    ],
  },
  {
    symptom: "가열/온도 불량",
    keywords: [
      "가열불량",
      "가열 불량",
      "가열안됨",
      "가열 안됨",
      "온도불량",
      "온도 불량",
      "온도안올라",
      "온도 안올라",
      "보온불량",
      "보온 불량",
    ],
  },
  {
    symptom: "회전/모터 불량",
    keywords: [
      "회전불량",
      "회전 불량",
      "회전안됨",
      "회전 안됨",
      "모터불량",
      "모터 불량",
      "멈춤",
      "정지",
    ],
  },
  {
    symptom: "소음/이상음",
    keywords: ["소음", "이상음", "잡음", "틱틱", "드르륵", "웅웅"],
  },
  {
    symptom: "디스플레이/버튼 불량",
    keywords: [
      "디스플레이",
      "화면깜빡",
      "화면 깜빡",
      "액정",
      "버튼불량",
      "버튼 불량",
      "버튼무반응",
      "버튼 무반응",
      "터치불량",
      "터치 불량",
    ],
  },
  {
    symptom: "냄새",
    keywords: ["냄새", "악취", "곰팡이 냄새", "쉰내"],
  },
  {
    symptom: "이물/오염",
    keywords: ["이물", "오염", "가루", "녹", "부식", "물때"],
  },
];

function normalized(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compact(value: unknown) {
  return normalized(value).replace(/\s+/g, "").toLowerCase();
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("날짜는 YYYY-MM-DD 형식으로 입력해주세요.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("유효하지 않은 날짜입니다.");
  }

  return date;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function recordDate(record: AppReturnRecord) {
  const value = normalized(record.createdAt);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatDate(date);
}

export function buildQualityAnalysisWindow(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (start > end) {
    throw new Error("분석 시작일은 종료일보다 늦을 수 없습니다.");
  }

  const days =
    Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  if (days > 180) {
    throw new Error("한 번에 분석할 수 있는 기간은 최대 180일입니다.");
  }

  const comparisonEnd = addDays(start, -1);
  const comparisonStart = addDays(comparisonEnd, -(days - 1));

  return {
    startDate,
    endDate,
    days,
    comparisonStartDate: formatDate(comparisonStart),
    comparisonEndDate: formatDate(comparisonEnd),
  };
}

function sanitizeEvidence(value: string) {
  return normalized(value)
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, "[연락처 숨김]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 숨김]")
    .replace(/\bPO\d{8,}\b/gi, "[주문번호 숨김]")
    .replace(/\b\d{10,16}\b/g, "[번호 숨김]")
    .slice(0, 180);
}

function recordText(record: AppReturnRecord) {
  return normalized(
    [
      record.inspectionResult,
      record.processAction,
      record.note,
    ].join(" ")
  );
}

function extractIssueHits(record: AppReturnRecord) {
  const text = recordText(record);
  const haystack = compact(text);
  const hits = new Map<string, { symptom: string; safety: boolean }>();

  for (const rule of ISSUE_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(compact(keyword)))) {
      hits.set(rule.symptom, {
        symptom: rule.symptom,
        safety: Boolean(rule.safety),
      });
    }
  }

  const errorCodes = new Set<string>();
  for (const match of text.toUpperCase().matchAll(/\bE\s*([0-9]{1,2})\b/g)) {
    errorCodes.add(`E${match[1]}`);
  }

  for (const code of errorCodes) {
    hits.set(`${code} 오류`, {
      symptom: `${code} 오류`,
      safety: false,
    });
  }

  if (
    hits.size === 0 &&
    compact(record.inspectionResult).includes("불량")
  ) {
    hits.set("기타 불량", {
      symptom: "기타 불량",
      safety: false,
    });
  }

  return [...hits.values()];
}

type Aggregate = {
  productName: string;
  symptom: string;
  safety: boolean;
  currentCount: number;
  previousCount: number;
  evidenceSamples: string[];
};

function riskRank(risk: RiskLevel) {
  return risk === "긴급" ? 3 : risk === "주의" ? 2 : 1;
}

export function analyzeRecurringProductIssues(
  records: AppReturnRecord[],
  input: QualityAnalysisInput
) {
  const window = buildQualityAnalysisWindow(input.startDate, input.endDate);
  const productFilter = compact(input.productName || "");

  const inProductScope = (record: AppReturnRecord) =>
    !productFilter || compact(record.productName).includes(productFilter);

  const scoped = records.filter(inProductScope);
  const currentRecords = scoped.filter((record) => {
    const date = recordDate(record);
    return date >= window.startDate && date <= window.endDate;
  });
  const previousRecords = scoped.filter((record) => {
    const date = recordDate(record);
    return (
      date >= window.comparisonStartDate &&
      date <= window.comparisonEndDate
    );
  });

  const aggregates = new Map<string, Aggregate>();

  const addRecords = (
    source: AppReturnRecord[],
    period: "current" | "previous"
  ) => {
    for (const record of source) {
      for (const hit of extractIssueHits(record)) {
        const productName = normalized(record.productName) || "제품명 미입력";
        const key = `${compact(productName)}|||${hit.symptom}`;

        const aggregate =
          aggregates.get(key) || {
            productName,
            symptom: hit.symptom,
            safety: hit.safety,
            currentCount: 0,
            previousCount: 0,
            evidenceSamples: [],
          };

        if (period === "current") {
          aggregate.currentCount += 1;
          const evidence = sanitizeEvidence(record.note || record.inspectionResult);
          if (
            evidence &&
            aggregate.evidenceSamples.length < 3 &&
            !aggregate.evidenceSamples.includes(evidence)
          ) {
            aggregate.evidenceSamples.push(evidence);
          }
        } else {
          aggregate.previousCount += 1;
        }

        aggregate.safety = aggregate.safety || hit.safety;
        aggregates.set(key, aggregate);
      }
    }
  };

  addRecords(currentRecords, "current");
  addRecords(previousRecords, "previous");

  const issues = [...aggregates.values()]
    .filter((item) => item.currentCount > 0)
    .map((item) => {
      const changeRatePercent =
        item.previousCount > 0
          ? Math.round(
              ((item.currentCount - item.previousCount) /
                item.previousCount) *
                1000
            ) / 10
          : undefined;

      const triggerReasons: string[] = [];

      if (item.safety) {
        triggerReasons.push("안전 관련 증상 1건 이상");
      }

      if (item.currentCount >= 3) {
        triggerReasons.push("동일 제품·증상 3건 이상");
      }

      if (
        changeRatePercent !== undefined &&
        changeRatePercent >= 50 &&
        item.currentCount > item.previousCount
      ) {
        triggerReasons.push("직전 동일 기간 대비 50% 이상 증가");
      }

      const isAlert = triggerReasons.length > 0;
      const risk: RiskLevel = item.safety
        ? "긴급"
        : isAlert
          ? "주의"
          : "일반";

      const trend =
        item.previousCount === 0
          ? "신규"
          : item.currentCount > item.previousCount
            ? "증가"
            : item.currentCount < item.previousCount
              ? "감소"
              : "동일";

      return {
        productName: item.productName,
        symptom: item.symptom,
        currentCount: item.currentCount,
        previousCount: item.previousCount,
        ...(changeRatePercent === undefined
          ? {}
          : { changeRatePercent }),
        trend,
        risk,
        isAlert,
        triggerReasons,
        evidenceSamples: item.evidenceSamples,
      };
    })
    .sort(
      (a, b) =>
        riskRank(b.risk) - riskRank(a.risk) ||
        Number(b.isAlert) - Number(a.isAlert) ||
        b.currentCount - a.currentCount ||
        a.productName.localeCompare(b.productName, "ko")
    );

  const alerts = issues.filter((item) => item.isAlert);

  return {
    period: {
      startDate: window.startDate,
      endDate: window.endDate,
      days: window.days,
    },
    comparisonPeriod: {
      startDate: window.comparisonStartDate,
      endDate: window.comparisonEndDate,
      days: window.days,
    },
    filters: {
      productName: normalized(input.productName || ""),
    },
    thresholds: {
      recurringCount: 3,
      increaseRatePercent: 50,
      safetySingleCaseAlert: true,
    },
    sourceRecords: {
      current: currentRecords.length,
      previous: previousRecords.length,
    },
    summary: {
      detectedIssueGroups: issues.length,
      alerts: alerts.length,
      urgentAlerts: alerts.filter((item) => item.risk === "긴급").length,
      cautionAlerts: alerts.filter((item) => item.risk === "주의").length,
    },
    alerts,
    issues,
    note:
      currentRecords.length === 0
        ? "선택한 기간과 제품 조건에 해당하는 반품검사 기록이 없습니다."
        : alerts.length === 0
          ? "설정된 반복·증가·안전 기준에 해당하는 경고는 없습니다."
          : "경고는 반품검사 기록의 제품명, 검사결과와 비고 키워드를 기준으로 계산한 결과입니다. 최종 품질 판정 전 원본 기록 확인이 필요합니다.",
  };
}
