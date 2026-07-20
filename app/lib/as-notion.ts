const NOTION_VERSION = "2026-03-11";

const KNOWLEDGE_PAGES = [
  { id: "a4cd1cba-8890-4dc1-8bd5-6494374daed6", label: "전자제품 AS관리" },
  { id: "a4a38b07-7a05-440a-aac7-4edc89f3160d", label: "제품별 스크립트" },
] as const;

const QUALITY_DATA_SOURCES = [
  { id: "2ad8bca2-d219-81e5-96c2-000beedf05f2", label: "제품현황판 런칭·검수 자료" },
  { id: "2ad8bca2-d219-8169-a46a-000b6da59025", label: "제품 품질 체크리스트" },
  { id: "7343ae22-b7cc-4d6c-93fc-184834538c28", label: "가전 제품 불량 데이터 분석" },
] as const;

const REPORT_DATA_SOURCE = {
  id: "1df869bc-dc1e-4a3a-9c2e-fde320da6a11",
  label: "AS 품질 이슈 보고서",
} as const;

type NotionPage = {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
};

type QueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

export type AsKnowledgeItem = {
  source: string;
  title: string;
  pageId: string;
  url: string;
  lastEditedTime: string;
  excerpt: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 누락되었습니다.`);
  return value;
}

function normalized(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compact(value: unknown) {
  return normalized(value).replace(/\s+/g, "").toLowerCase();
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

function collectText(value: unknown, output: string[] = []): string[] {
  if (value === null || value === undefined) return output;

  if (typeof value === "string") {
    const text = normalized(value);
    if (text) output.push(text);
    return output;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    output.push(String(value));
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output);
    return output;
  }

  if (typeof value !== "object") return output;

  const record = value as Record<string, unknown>;
  for (const key of ["plain_text", "content", "name", "start"]) {
    if (typeof record[key] === "string") output.push(normalized(record[key]));
  }
  for (const key of [
    "title",
    "rich_text",
    "select",
    "multi_select",
    "status",
    "date",
    "number",
    "formula",
  ]) {
    if (key in record) collectText(record[key], output);
  }

  return output.filter(Boolean);
}

function pageTitle(properties: Record<string, unknown> = {}) {
  for (const property of Object.values(properties)) {
    if (!property || typeof property !== "object") continue;
    const title = collectText((property as { title?: unknown }).title).join(" ").trim();
    if (title) return title;
  }
  return "제목 없음";
}

const SENSITIVE_WORDS = [
  "비밀번호",
  "password",
  "passwd",
  "api key",
  "api_key",
  "secret",
  "token",
  "로그인",
  "계정정보",
  "계정 정보",
  "계약금액",
  "계약 금액",
];

function containsSensitiveWord(text: string) {
  const lower = text.toLowerCase();
  return SENSITIVE_WORDS.some((word) => lower.includes(word.toLowerCase()));
}

function sanitizeLine(text: string) {
  if (containsSensitiveWord(text)) return "";
  return normalized(text)
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, "[연락처 숨김]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 숨김]")
    .replace(/\b\d{6}-?[1-4]\d{6}\b/g, "[개인정보 숨김]");
}

function blockText(block: NotionBlock) {
  const value = block[block.type];
  if (!value || typeof value !== "object") return "";
  return collectText((value as { rich_text?: unknown }).rich_text).join(" ").trim();
}

async function readBlockLines(
  blockId: string,
  depth = 0,
  budget = { chars: 12000 }
): Promise<string[]> {
  if (depth > 2 || budget.chars <= 0) return [];

  const lines: string[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (cursor) params.set("start_cursor", cursor);

    const response = await notionRequest<{
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/blocks/${blockId}/children?${params.toString()}`);

    for (const block of response.results) {
      const safe = sanitizeLine(blockText(block));
      if (safe) {
        lines.push(safe);
        budget.chars -= safe.length;
      }

      if (block.has_children && budget.chars > 0) {
        lines.push(...(await readBlockLines(block.id, depth + 1, budget)));
      }

      if (budget.chars <= 0) break;
    }

    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor && budget.chars > 0);

  return lines;
}

async function checkResource(
  resource: { id: string; label: string },
  type: "page" | "data_source"
) {
  try {
    await notionRequest(
      type === "page" ? `/pages/${resource.id}` : `/data_sources/${resource.id}`
    );
    return { label: resource.label, type, accessible: true };
  } catch (error) {
    return {
      label: resource.label,
      type,
      accessible: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

export async function checkAsNotionAccess() {
  const resources = await Promise.all([
    ...KNOWLEDGE_PAGES.map((item) => checkResource(item, "page")),
    ...QUALITY_DATA_SOURCES.map((item) => checkResource(item, "data_source")),
    checkResource(REPORT_DATA_SOURCE, "data_source"),
  ]);

  return {
    ok: resources.every((item) => item.accessible),
    notionVersion: NOTION_VERSION,
    accessibleCount: resources.filter((item) => item.accessible).length,
    totalCount: resources.length,
    resources,
  };
}

function matchingExcerpt(lines: string[], query: string) {
  const target = compact(query);
  const matches = lines.filter((line) => compact(line).includes(target));
  return (matches.length ? matches : lines.slice(0, 8)).join("\n").slice(0, 5000);
}

async function queryDataSourcePages(dataSourceId: string) {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;
  let requestCount = 0;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const response = await notionRequest<QueryResponse>(
      `/data_sources/${dataSourceId}/query`,
      { method: "POST", body: JSON.stringify(body) }
    );

    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
    requestCount += 1;
  } while (cursor && requestCount < 2);

  return pages;
}

export async function searchAsKnowledge(query: string, limit = 5) {
  const searchWord = normalized(query);
  if (!searchWord) throw new Error("검색어를 입력해주세요.");
  if (containsSensitiveWord(searchWord)) {
    throw new Error("계정, 비밀번호, 토큰 등 민감정보는 검색할 수 없습니다.");
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 5, 1), 10);
  const target = compact(searchWord);
  const items: AsKnowledgeItem[] = [];

  for (const source of KNOWLEDGE_PAGES) {
    if (items.length >= safeLimit) break;
    try {
      const page = await notionRequest<NotionPage>(`/pages/${source.id}`);
      const lines = await readBlockLines(source.id);
      const title = pageTitle(page.properties);
      if (!compact(`${title} ${lines.join(" ")}`).includes(target)) continue;

      items.push({
        source: source.label,
        title,
        pageId: page.id,
        url: page.url || "",
        lastEditedTime: page.last_edited_time || "",
        excerpt: matchingExcerpt(lines, searchWord),
      });
    } catch {
      // 연결 상태 조회에서 접근 실패 자료를 별도로 표시한다.
    }
  }

  for (const source of QUALITY_DATA_SOURCES) {
    if (items.length >= safeLimit) break;
    try {
      const pages = await queryDataSourcePages(source.id);
      for (const page of pages) {
        if (items.length >= safeLimit) break;

        const propertyLines = Object.values(page.properties || {})
          .flatMap((property) => collectText(property))
          .map(sanitizeLine)
          .filter(Boolean);
        const title = pageTitle(page.properties);
        if (!compact(`${title} ${propertyLines.join(" ")}`).includes(target)) continue;

        let bodyLines: string[] = [];
        try {
          bodyLines = await readBlockLines(page.id);
        } catch {
          bodyLines = [];
        }

        items.push({
          source: source.label,
          title,
          pageId: page.id,
          url: page.url || "",
          lastEditedTime: page.last_edited_time || "",
          excerpt: matchingExcerpt([...propertyLines, ...bodyLines], searchWord),
        });
      }
    } catch {
      // 연결 상태 조회에서 접근 실패 자료를 별도로 표시한다.
    }
  }

  return {
    query: searchWord,
    count: items.length,
    items,
    note:
      items.length === 0
        ? "검색 결과가 없거나 해당 노션 자료가 API 통합에 공유되지 않았습니다."
        : "민감정보가 포함된 줄과 개인정보는 결과에서 제외했습니다.",
  };
}
