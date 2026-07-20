const NOTION_VERSION = "2026-03-11";
const REPORT_DATA_SOURCE_ID = "1df869bc-dc1e-4a3a-9c2e-fde320da6a11";

export type RiskLevel = "일반" | "주의" | "긴급";

export type AsQualityReportInput = {
  title: string;
  startDate: string;
  endDate: string;
  productName: string;
  mainSymptom: string;
  occurrenceCount: number;
  previousCount?: number;
  changeRatePercent?: number;
  risk: RiskLevel;
  confirmedFacts: string[];
  estimatedCauses: string[];
  inspectionProblems: string[];
  recommendations: string[];
  references: string[];
};

type NormalizedReport = AsQualityReportInput;

type NotionPage = {
  id: string;
  url?: string;
  properties?: Record<string, unknown>;
};

type NotionDataSource = {
  id: string;
  properties?: Record<string, { type?: string }>;
};

type NotionQueryResponse = {
  results: NotionPage[];
};

export class DuplicateQualityReportError extends Error {
  duplicate: { pageId: string; url: string };

  constructor(page: NotionPage) {
    super("같은 보고서명의 노션 페이지가 이미 존재합니다.");
    this.name = "DuplicateQualityReportError";
    this.duplicate = {
      pageId: page.id,
      url: page.url || "",
    };
  }
}

const REQUIRED_PROPERTIES: Record<string, string> = {
  보고서명: "title",
  작성일: "date",
  분석시작일: "date",
  분석종료일: "date",
  제품명: "rich_text",
  주요증상: "rich_text",
  발생건수: "number",
  증감률: "number",
  위험도: "select",
  참고자료: "rich_text",
  상태: "select",
  작성주체: "rich_text",
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 누락되었습니다.`);
  return value;
}

function normalized(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeText(value: unknown, maxLength = 500) {
  return normalized(value)
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, "[연락처 숨김]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 숨김]")
    .replace(/\bPO\d{8,}\b/gi, "[주문번호 숨김]")
    .replace(/\b\d{10,16}\b/g, "[번호 숨김]")
    .replace(/(고객명|송장번호|주문번호)\s*[:：]\s*\S+/gi, "$1: [숨김]")
    .slice(0, maxLength);
}

function sanitizeList(values: unknown, fieldName: string) {
  if (!Array.isArray(values)) {
    throw new Error(`${fieldName} 항목은 목록 형식이어야 합니다.`);
  }

  return values
    .map((value) => sanitizeText(value, 700))
    .filter(Boolean)
    .slice(0, 12);
}

function validateDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName}은 YYYY-MM-DD 형식이어야 합니다.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName}이 유효하지 않습니다.`);
  }

  return value;
}

function validateNonNegativeInteger(value: unknown, fieldName: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName}은 0 이상의 정수여야 합니다.`);
  }
  return number;
}

function validateOptionalNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName}은 숫자여야 합니다.`);
  }
  return Math.round(number * 10) / 10;
}

function validateRisk(value: unknown): RiskLevel {
  if (value !== "일반" && value !== "주의" && value !== "긴급") {
    throw new Error("위험도는 일반, 주의, 긴급 중 하나여야 합니다.");
  }
  return value;
}

function normalizeReportInput(input: Partial<AsQualityReportInput>): NormalizedReport {
  const startDate = validateDate(
    sanitizeText(input.startDate, 10),
    "분석시작일"
  );
  const endDate = validateDate(
    sanitizeText(input.endDate, 10),
    "분석종료일"
  );

  if (startDate > endDate) {
    throw new Error("분석시작일은 분석종료일보다 늦을 수 없습니다.");
  }

  const productName = sanitizeText(input.productName, 300);
  const mainSymptom = sanitizeText(input.mainSymptom, 300);

  if (!productName) throw new Error("제품명이 필요합니다.");
  if (!mainSymptom) throw new Error("주요증상이 필요합니다.");

  const title =
    sanitizeText(input.title, 300) ||
    `${productName} ${mainSymptom} 품질 이슈 보고서`;

  return {
    title,
    startDate,
    endDate,
    productName,
    mainSymptom,
    occurrenceCount: validateNonNegativeInteger(
      input.occurrenceCount,
      "발생건수"
    ),
    previousCount:
      input.previousCount === undefined
        ? undefined
        : validateNonNegativeInteger(input.previousCount, "직전기간 발생건수"),
    changeRatePercent: validateOptionalNumber(
      input.changeRatePercent,
      "증감률"
    ),
    risk: validateRisk(input.risk),
    confirmedFacts: sanitizeList(input.confirmedFacts, "확인된 사실"),
    estimatedCauses: sanitizeList(input.estimatedCauses, "추정 원인"),
    inspectionProblems: sanitizeList(
      input.inspectionProblems,
      "품질검수 보완점"
    ),
    recommendations: sanitizeList(input.recommendations, "권장 조치"),
    references: sanitizeList(input.references, "참고 자료"),
  };
}

async function notionRequest<T>(apiPath: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${requiredEnv("NOTION_API_TOKEN")}`);
  headers.set("Notion-Version", NOTION_VERSION);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`https://api.notion.com/v1${apiPath}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? normalized((payload as { message?: unknown }).message)
        : response.statusText;

    throw new Error(`Notion API ${response.status}: ${message}`);
  }

  return payload as T;
}

export async function checkQualityReportDataSource() {
  try {
    const source = await notionRequest<NotionDataSource>(
      `/data_sources/${REPORT_DATA_SOURCE_ID}`
    );

    const missingProperties: string[] = [];
    const wrongTypeProperties: string[] = [];

    for (const [name, expectedType] of Object.entries(REQUIRED_PROPERTIES)) {
      const property = source.properties?.[name];
      if (!property) {
        missingProperties.push(name);
      } else if (property.type && property.type !== expectedType) {
        wrongTypeProperties.push(
          `${name}: ${property.type} → ${expectedType} 필요`
        );
      }
    }

    return {
      accessible: true,
      schemaValid:
        missingProperties.length === 0 && wrongTypeProperties.length === 0,
      dataSourceId: source.id,
      missingProperties,
      wrongTypeProperties,
    };
  } catch (error) {
    return {
      accessible: false,
      schemaValid: false,
      dataSourceId: REPORT_DATA_SOURCE_ID,
      missingProperties: [],
      wrongTypeProperties: [],
      error:
        error instanceof Error
          ? error.message
          : "AS 품질 보고서 데이터베이스 확인 중 오류가 발생했습니다.",
    };
  }
}

function kstDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function textObject(content: string) {
  return [
    {
      type: "text",
      text: {
        content: sanitizeText(content, 1900),
      },
    },
  ];
}

function heading(content: string) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: textObject(content),
    },
  };
}

function paragraph(content: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: textObject(content),
    },
  };
}

function bullet(content: string) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: textObject(content),
    },
  };
}

function sectionBlocks(title: string, values: string[]) {
  return [
    heading(title),
    ...(values.length > 0
      ? values.map((value) => bullet(value))
      : [bullet("기재된 내용 없음")]),
  ];
}

function reportBlocks(report: NormalizedReport) {
  const overview = [
    `분석기간: ${report.startDate} ~ ${report.endDate}`,
    `제품명: ${report.productName}`,
    `주요증상: ${report.mainSymptom}`,
    `현재기간 발생건수: ${report.occurrenceCount}건`,
    report.previousCount === undefined
      ? ""
      : `직전기간 발생건수: ${report.previousCount}건`,
    report.changeRatePercent === undefined
      ? ""
      : `직전기간 대비 증감률: ${report.changeRatePercent}%`,
    `위험도: ${report.risk}`,
  ].filter(Boolean);

  return [
    paragraph(
      "본 보고서는 확인된 사실과 추정 원인을 구분해 작성한 초안입니다. 최종 공유 전 담당자 검토가 필요합니다."
    ),
    ...sectionBlocks("분석 개요", overview),
    ...sectionBlocks("확인된 사실", report.confirmedFacts),
    ...sectionBlocks("추정 원인", report.estimatedCauses),
    ...sectionBlocks("품질검수 보완점", report.inspectionProblems),
    ...sectionBlocks("권장 조치", report.recommendations),
    ...sectionBlocks("참고 자료", report.references),
  ];
}

function reportText(report: NormalizedReport) {
  const lines = [
    `[${report.risk}] ${report.title}`,
    "",
    `분석기간: ${report.startDate} ~ ${report.endDate}`,
    `제품명: ${report.productName}`,
    `주요증상: ${report.mainSymptom}`,
    `현재기간 발생건수: ${report.occurrenceCount}건`,
  ];

  if (report.previousCount !== undefined) {
    lines.push(`직전기간 발생건수: ${report.previousCount}건`);
  }

  if (report.changeRatePercent !== undefined) {
    lines.push(`증감률: ${report.changeRatePercent}%`);
  }

  const addSection = (title: string, values: string[]) => {
    lines.push("", `## ${title}`);
    lines.push(...(values.length ? values.map((value) => `- ${value}`) : ["- 없음"]));
  };

  addSection("확인된 사실", report.confirmedFacts);
  addSection("추정 원인", report.estimatedCauses);
  addSection("품질검수 보완점", report.inspectionProblems);
  addSection("권장 조치", report.recommendations);
  addSection("참고 자료", report.references);

  return lines.join("\n");
}

export async function previewQualityReport(
  input: Partial<AsQualityReportInput>
) {
  const report = normalizeReportInput(input);
  const dataSource = await checkQualityReportDataSource();

  return {
    success: true,
    previewOnly: true,
    message: "미리보기입니다. 아직 노션에 등록하지 않았습니다.",
    canCreateReport: dataSource.accessible && dataSource.schemaValid,
    dataSource,
    report,
    previewText: reportText(report),
    approvalInstruction:
      "내용을 확인한 뒤 실제 등록을 원할 때 '노션에 등록해줘'처럼 명시적으로 승인해야 합니다.",
  };
}

async function findDuplicateReport(title: string) {
  const response = await notionRequest<NotionQueryResponse>(
    `/data_sources/${REPORT_DATA_SOURCE_ID}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        page_size: 5,
        filter: {
          property: "보고서명",
          title: {
            equals: title,
          },
        },
      }),
    }
  );

  return response.results[0];
}

export async function createQualityReport(
  input: Partial<AsQualityReportInput>,
  options?: { allowDuplicate?: boolean }
) {
  const report = normalizeReportInput(input);
  const dataSource = await checkQualityReportDataSource();

  if (!dataSource.accessible) {
    throw new Error(
      dataSource.error ||
        "AS 품질 보고서 데이터베이스에 접근할 수 없습니다."
    );
  }

  if (!dataSource.schemaValid) {
    throw new Error(
      `AS 품질 보고서 데이터베이스 구조가 일치하지 않습니다. 누락: ${
        dataSource.missingProperties.join(", ") || "없음"
      } / 형식 오류: ${
        dataSource.wrongTypeProperties.join(", ") || "없음"
      }`
    );
  }

  if (!options?.allowDuplicate) {
    const duplicate = await findDuplicateReport(report.title);
    if (duplicate) throw new DuplicateQualityReportError(duplicate);
  }

  const referenceText = report.references.join(" | ").slice(0, 1900);

  const properties: Record<string, unknown> = {
    보고서명: {
      title: textObject(report.title),
    },
    작성일: {
      date: {
        start: kstDate(),
      },
    },
    분석시작일: {
      date: {
        start: report.startDate,
      },
    },
    분석종료일: {
      date: {
        start: report.endDate,
      },
    },
    제품명: {
      rich_text: textObject(report.productName),
    },
    주요증상: {
      rich_text: textObject(report.mainSymptom),
    },
    발생건수: {
      number: report.occurrenceCount,
    },
    위험도: {
      select: {
        name: report.risk,
      },
    },
    참고자료: {
      rich_text: textObject(referenceText),
    },
    상태: {
      select: {
        name: "초안",
      },
    },
    작성주체: {
      rich_text: textObject("꿈비 AS·품질 분석 직원"),
    },
  };

  if (report.changeRatePercent !== undefined) {
    properties.증감률 = {
      number: report.changeRatePercent,
    };
  }

  const page = await notionRequest<NotionPage>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: {
        type: "data_source_id",
        data_source_id: REPORT_DATA_SOURCE_ID,
      },
      properties,
      children: reportBlocks(report),
    }),
  });

  return {
    success: true,
    message: "AS 품질 이슈 보고서를 노션에 초안 상태로 등록했습니다.",
    pageId: page.id,
    url: page.url || "",
    report,
  };
}
