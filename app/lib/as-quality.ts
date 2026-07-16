import type { AppReturnRecord } from "@/app/lib/google-storage";

const NOTION_VERSION = "2026-03-11";
const REPORT_DATA_SOURCE_ID = "1df869bc-dc1e-4a3a-9c2e-fde320da6a11";

type NotionRichText = { plain_text?: string };
type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

type SearchResult = {
  id: string;
  object: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
};

type SearchResponse = {
  results: SearchResult[];
  has_more: boolean;
  next_cursor: string | null;
};

export type KnowledgeItem = {
  pageId: string;
  title: string;
  url: string;
  lastEditedTime: string;
  excerpt: string;
};

export type IssueSummary = {
  productName: string;
  symptom: string;
  count: number;
  risk: "일반" | "주의" | "긴급";
  examples: string[];
};

export type AsQualityReportInput = {
  title: string;
  startDate: string;
  endDate: string;
  productName: string;
  mainSymptom: string;
  occurrenceCount: number;
  changeRate?: number;
  risk: "일반" | "주의" | "긴급";
  confirmedFacts: string[];
  estimatedCauses: string[];
  inspectionProblems: string[];
  recommendations: string[];
  references: string[];
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 누락되었습니다.`);
  return value;
}

function normalized(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function redactSensitive(text: string) {
  return text
    .replace(/(password|passwd|pw|비밀번호)\s*[:=]\s*\S+/gi, "$1: [숨김]")
    .replace(/(token|secret|api[_ -]?key)\s*[:=]\s*\S+/gi, "$1: [숨김]")
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, "[연락처 숨김]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 숨김]");
}

async function notionRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${requiredEnv("NOTION_API_TOKEN")}`);
  headers.set("Notion-Version", NOTION_VERSION);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(
      `Notion API ${response.status}: ${normalized(payload?.message || response.statusText)}`
    );
  }
  return payload as T;
}

function plainText(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items.map((item) => normalized((item as NotionRichText)?.plain_text)).join("").trim();
}

function pageTitle(properties: Record<string, unknown> = {}) {
  for (const property of Object.values(properties)) {
    if (!property || typeof property !== "object") continue;
    const title = (property as { title?: unknown }).title;
    const text = plainText(title);
    if (text) return text;
  }
  return "제목 없음";
}

function blockText(block: NotionBlock) {
  const value = block[block.type];
  if (!value || typeof value !== "object") return "";
  return plainText((value as { rich_text?: unknown }).rich_text);
}

async function readBlockChildren(blockId: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];
  const lines: string[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (cursor) params.set("start_cursor", cursor);
    const data = await notionRequest<{
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/blocks/${blockId}/children?${params}`);

    for (const block of data.results) {
      const text = blockText(block);
      if (text) lines.push(text);
      if (block.has_children) {
        lines.push(...(await readBlockChildren(block.id, depth + 1)));
      }
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor && lines.join(" ").length < 12000);

  return lines;
}

export async function checkAsQualityNotionAccess() {
  const report = await notionRequest<{ id: string; object: string }>(
    `/data_sources/${REPORT_DATA_SOURCE_ID}`
  );
  return {
    ok: true,
    notionVersion: NOTION_VERSION,
    reportDataSource: report.id,
  };
}

export async function searchAsKnowledge(query: string, limit = 5): Promise<KnowledgeItem[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const data = await notionRequest<SearchResponse>("/search", {
    method: "POST",
    body: JSON.stringify({
      query: normalized(query),
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: Math.min(safeLimit * 3, 30),
    }),
  });

  const items: KnowledgeItem[] = [];
  for (const page of data.results) {
    if (items.length >= safeLimit) break;
    const title = pageTitle(page.properties);
    const titleCompact = title.replace(/\s+/g, "").toLowerCase();
    const queryCompact = normalized(query).replace(/\s+/g, "").toLowerCase();
    if (queryCompact && !titleCompact.includes(queryCompact) && !queryCompact.includes(titleCompact)) {
      // Notion 검색 결과의 관련성이 느슨할 수 있으므로 본문도 읽고 판단한다.
    }

    let lines: string[] = [];
    try {
      lines = await readBlockChildren(page.id);
    } catch {
      lines = [];
    }
    const excerpt = redactSensitive(lines.join("\n")).slice(0, 6000);

    items.push({
      pageId: page.id,
      title,
      url: page.url || "",
      lastEditedTime: page.last_edited_time || "",
      excerpt,
    });
  }

  return items;
}

const SYMPTOMS: Array<{ name: string; words: string[]; risk: "일반" | "주의" | "긴급" }> = [
  { name: "누전/감전 위험", words: ["누전", "감전"], risk: "긴급" },
  { name: "탄화/타는 냄새", words: ["탄화", "타는냄새", "타는 냄새", "연기"], risk: "긴급" },
  { name: "과열", words: ["과열", "뜨거움", "고온"], risk: "긴급" },
  { name: "누수/수분 유입", words: ["누수", "수분유입", "수분 유입", "물샘"], risk: "주의" },
  { name: "전원 불량", words: ["전원불량", "전원 불량", "무반응", "작동안됨"], risk: "주의" },
  { name: "충전 불량", words: ["충전불량", "충전 불량", "충전안됨"], risk: "주의" },
  { name: "회전/모터 불량", words: ["회전불량", "회전 불량", "모터", "멈춤"], risk: "주의" },
  { name: "소음", words: ["소음", "이상음", "틱틱"], risk: "일반" },
  { name: "파손", words: ["파손", "깨짐", "금감"], risk: "주의" },
  { name: "이물/오염", words: ["이물", "오염", "가루"], risk: "일반" },
];

export function analyzeRecurringIssues(records: AppReturnRecord[], productName?: string) {
  const filtered = records.filter((record) => {
    if (!productName) return true;
    return record.productName.includes(productName);
  });

  const map = new Map<string, IssueSummary>();
  for (const record of filtered) {
    const text = `${record.inspectionResult} ${record.note} ${record.processAction || ""}`.toLowerCase();

    for (const symptom of SYMPTOMS) {
      if (!symptom.words.some((word) => text.includes(word.toLowerCase()))) continue;
      const key = `${record.productName}|||${symptom.name}`;
      const current = map.get(key) || {
        productName: record.productName,
        symptom: symptom.name,
        count: 0,
        risk: symptom.risk,
        examples: [],
      };
      current.count += 1;
      if (record.note && current.examples.length < 3) {
        current.examples.push(redactSensitive(record.note).slice(0, 240));
      }
      map.set(key, current);
    }
  }

  const issues = [...map.values()].sort((a, b) => {
    const rank = { 긴급: 3, 주의: 2, 일반: 1 };
    return rank[b.risk] - rank[a.risk] || b.count - a.count;
  });

  return {
    sourceRecords: filtered.length,
    recurringThreshold: 3,
    issues,
    recurringIssues: issues.filter((item) => item.count >= 3 || item.risk === "긴급"),
  };
}

function richText(value: string) {
  return {
    rich_text: [{ type: "text", text: { content: value.slice(0, 2000) } }],
  };
}

function title(value: string) {
  return {
    title: [{ type: "text", text: { content: value.slice(0, 2000) } }],
  };
}

function reportMarkdown(input: AsQualityReportInput) {
  const section = (name: string, values: string[]) =>
    `## ${name}\n${values.length ? values.map((v) => `- ${v}`).join("\n") : "- 없음"}`;

  return [
    `## 분석 개요`,
    `- 분석기간: ${input.startDate} ~ ${input.endDate}`,
    `- 제품명: ${input.productName}`,
    `- 주요증상: ${input.mainSymptom}`,
    `- 발생건수: ${input.occurrenceCount}건`,
    `- 위험도: ${input.risk}`,
    input.changeRate === undefined ? "" : `- 증감률: ${input.changeRate}%`,
    section("확인된 사실", input.confirmedFacts),
    section("추정 원인", input.estimatedCauses),
    section("품질검수 문제점", input.inspectionProblems),
    section("권장 조치", input.recommendations),
    section("참고 자료", input.references),
  ].filter(Boolean).join("\n\n");
}

export function previewAsQualityReport(input: AsQualityReportInput) {
  return {
    approved: false,
    message: "미리보기입니다. 아직 노션에 등록하지 않았습니다.",
    report: input,
    markdown: reportMarkdown(input),
  };
}

export async function createAsQualityReport(input: AsQualityReportInput) {
  const properties: Record<string, unknown> = {
    보고서명: title(input.title),
    작성일: { date: { start: new Date().toISOString().slice(0, 10) } },
    분석시작일: { date: { start: input.startDate } },
    분석종료일: { date: { start: input.endDate } },
    제품명: richText(input.productName),
    주요증상: richText(input.mainSymptom),
    발생건수: { number: input.occurrenceCount },
    위험도: { select: { name: input.risk } },
    상태: { select: { name: "초안" } },
    작성주체: richText("꿈비 AS·품질 분석 직원"),
    참고자료: richText(input.references.join(" | ")),
  };
  if (input.changeRate !== undefined) properties.증감률 = { number: input.changeRate };

  const page = await notionRequest<{ id: string; url?: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: REPORT_DATA_SOURCE_ID },
      properties,
      children: reportMarkdown(input)
        .split("\n\n")
        .slice(0, 80)
        .map((paragraph) => ({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: paragraph.slice(0, 2000) } }],
          },
        })),
    }),
  });

  return {
    success: true,
    message: "AS 품질 이슈 보고서를 노션에 등록했습니다.",
    pageId: page.id,
    url: page.url || "",
  };
}
