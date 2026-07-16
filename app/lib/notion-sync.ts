import type { AppReturnRecord } from "@/app/lib/google-storage";

const NOTION_VERSION = "2026-03-11";
const RAW_DATA_SOURCE_ID = "4ce34b66-1e78-4b07-850c-fd5b5ca4da9a";
const SUMMARY_DATA_SOURCE_ID = "14d0651b-b828-4b87-a8e5-9b7f68f18ecf";

const PRODUCT_MAP: Record<string, string> = {
  휴대용분유포트: "[꿈비] 휴대용 분유포트",
  "(분리형) 휴대용분유포트": "[꿈비] 분리형 휴대용 분유포트",
  분유쉐이커: "[꿈비] 분유쉐이커",
  LED분유쉐이커: "[꿈비] 뭉침없이 조용한 분유쉐이커",
};

type NotionPage = {
  id: string;
  properties: Record<string, unknown>;
};

type QueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

type SyncOptions = {
  startDate: string;
  endDate: string;
  dryRun: boolean;
};

type SummaryRow = {
  date: string;
  product: string;
  result: "재상품화" | "원자재화";
  count: number;
};

type ExistingSummaryRow = SummaryRow & {
  pageId: string;
};

export type NotionSyncResult = {
  dryRun: boolean;
  period: { startDate: string; endDate: string };
  sourceRecords: number;
  raw: {
    createPlanned: number;
    created: number;
    skippedExisting: number;
    failed: number;
  };
  summary: {
    eligibleSourceRecords: number;
    rowsCalculated: number;
    createPlanned: number;
    updatePlanned: number;
    unchanged: number;
    created: number;
    updated: number;
    failed: number;
  };
  errors: string[];
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

function dateOnly(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function assertDate(value: string, name: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name}은 YYYY-MM-DD 형식이어야 합니다.`);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notionRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${requiredEnv("NOTION_API_TOKEN")}`);
  headers.set("Notion-Version", NOTION_VERSION);
  headers.set("Content-Type", "application/json");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.notion.com/v1${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") || "1");
      await delay(Math.max(retryAfter, 1) * 1000);
      continue;
    }

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
        typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message?: unknown }).message || response.statusText)
          : response.statusText;
      throw new Error(`Notion API ${response.status}: ${message}`);
    }

    return payload as T;
  }

  throw new Error("Notion API 요청을 완료하지 못했습니다.");
}

async function queryAllPages(
  dataSourceId: string,
  body: Record<string, unknown>
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;

  do {
    const requestBody: Record<string, unknown> = {
      ...body,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const response = await notionRequest<QueryResponse>(
      `/data_sources/${dataSourceId}/query`,
      { method: "POST", body: JSON.stringify(requestBody) }
    );
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return pages;
}

function plainText(property: unknown): string {
  if (!property || typeof property !== "object") return "";
  const value = property as Record<string, unknown>;
  const candidates = [value.rich_text, value.title];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const entry = item as Record<string, unknown>;
        if (typeof entry.plain_text === "string") return entry.plain_text;
        const text = entry.text;
        if (text && typeof text === "object" && "content" in text) {
          return String((text as { content?: unknown }).content ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function selectName(property: unknown): string {
  if (!property || typeof property !== "object") return "";
  const select = (property as { select?: unknown }).select;
  if (!select || typeof select !== "object") return "";
  return normalized((select as { name?: unknown }).name);
}

function dateStart(property: unknown): string {
  if (!property || typeof property !== "object") return "";
  const date = (property as { date?: unknown }).date;
  if (!date || typeof date !== "object") return "";
  return dateOnly(normalized((date as { start?: unknown }).start));
}

function numberValue(property: unknown): number {
  if (!property || typeof property !== "object") return 0;
  const number = (property as { number?: unknown }).number;
  return typeof number === "number" && Number.isFinite(number) ? number : 0;
}

function richTextItems(value: string) {
  const content = normalized(value);
  if (!content) return [];
  const items = [];
  for (let index = 0; index < content.length; index += 2000) {
    items.push({
      type: "text",
      text: { content: content.slice(index, index + 2000) },
    });
  }
  return items;
}

function textProperty(value: string) {
  return { rich_text: richTextItems(value) };
}

function titleProperty(value: string) {
  return { title: richTextItems(value) };
}

function mapInspectionResult(value: string) {
  const text = compact(value);
  if (text === "정상" || text === "정상확인" || text === "정상화완료") {
    return "정상확인";
  }
  if (text === "불량" || text === "불량판정") return "불량판정";
  if (text === "검사대기") return "검사 대기";
  if (text === "후속확인필요") return "후속 확인 필요";
  return normalized(value);
}

function mapProcessAction(value?: string) {
  const text = compact(value);
  if (!text || text === "미선택") return "미선택";
  if (text === "원자재화" || text.includes("b급")) return "원자재화";
  if (text === "안성폐기" || text.includes("안성물류폐기")) return "안성폐기";
  if (text === "자체폐기") return "자체폐기";
  if (text === "안성물류이동" || text === "재상품화") return "안성물류이동";
  return normalized(value);
}

function reportGroup(returnType: string) {
  const value = compact(returnType);
  return value.includes("일반") || value.includes("변심") ? "일반/변심" : "기타";
}

function reportJudgment(inspectionResult: string) {
  const result = mapInspectionResult(inspectionResult);
  if (result === "정상확인") return "정상";
  if (result === "불량판정") return "불량";
  return "";
}

function notionProduct(productName: string) {
  const value = normalized(productName);
  return PRODUCT_MAP[value] || value;
}

function notionResult(record: AppReturnRecord): "재상품화" | "원자재화" | "" {
  const returnType = compact(record.returnType);
  const inspectionResult = compact(record.inspectionResult);
  const processAction = compact(record.processAction);
  const note = compact(record.note);

  const targetType =
    returnType.includes("일반") ||
    returnType.includes("변심") ||
    returnType.includes("as") ||
    returnType.includes("검수") ||
    returnType.includes("불량교환") ||
    returnType.includes("불량반품");
  const normal =
    inspectionResult.includes("정상확인") ||
    inspectionResult.includes("정상화완료") ||
    inspectionResult === "정상";
  const bGrade =
    processAction.includes("b급") ||
    processAction.includes("원자재화") ||
    inspectionResult.includes("b급") ||
    note.includes("b급");
  const disposal =
    processAction.includes("폐기") ||
    inspectionResult.includes("폐기") ||
    note.includes("폐기");

  if (disposal) return "";
  if ((returnType.includes("일반") || returnType.includes("변심")) && normal) {
    return "재상품화";
  }
  if (targetType && bGrade) return "원자재화";
  return "";
}

function rawPageProperties(record: AppReturnRecord) {
  const date = dateOnly(record.createdAt);
  const invoiceOrOrder = record.invoiceNumber || record.orderNumber || record.id.slice(0, 8);
  const properties: Record<string, unknown> = {
    기록명: titleProperty(`${date} | ${record.productName} | ${invoiceOrOrder}`),
    등록일자: { date: { start: date } },
    반품유형: { select: { name: normalized(record.returnType) } },
    제품명: textProperty(record.productName),
    검사결과: { select: { name: mapInspectionResult(record.inspectionResult) } },
    "이동/처리": { select: { name: mapProcessAction(record.processAction) } },
    "리포트 구분": { select: { name: reportGroup(record.returnType) } },
    "프로그램 ID": textProperty(record.id),
  };

  if (record.invoiceNumber) properties.송장번호 = textProperty(record.invoiceNumber);
  if (record.orderNumber) properties.주문번호 = textProperty(record.orderNumber);
  if (record.customerName) properties.고객명 = textProperty(record.customerName);
  if (record.note) properties.비고 = textProperty(record.note);

  const judgment = reportJudgment(record.inspectionResult);
  if (judgment) properties["리포트 판정"] = { select: { name: judgment } };

  return properties;
}

function aggregateSummary(records: AppReturnRecord[]): {
  rows: SummaryRow[];
  eligibleSourceRecords: number;
} {
  const counts = new Map<string, SummaryRow>();
  let eligibleSourceRecords = 0;

  for (const record of records) {
    const date = dateOnly(record.createdAt);
    const product = notionProduct(record.productName);
    const result = notionResult(record);
    if (!date || !product || !result) continue;
    eligibleSourceRecords += 1;
    const key = `${date}|||${product}|||${result}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { date, product, result, count: 1 });
  }

  return {
    rows: [...counts.values()].sort((a, b) =>
      `${a.date}|${a.product}|${a.result}`.localeCompare(`${b.date}|${b.product}|${b.result}`)
    ),
    eligibleSourceRecords,
  };
}

function dateRangeFilter(property: string, startDate: string, endDate: string) {
  return {
    and: [
      { property, date: { on_or_after: startDate } },
      { property, date: { on_or_before: endDate } },
    ],
  };
}

async function existingProgramIds(startDate: string, endDate: string) {
  const pages = await queryAllPages(RAW_DATA_SOURCE_ID, {
    filter: dateRangeFilter("등록일자", startDate, endDate),
    filter_properties: ["프로그램 ID"],
  });
  return new Set(
    pages
      .map((page) => plainText(page.properties["프로그램 ID"]))
      .filter(Boolean)
  );
}

async function existingSummaryRows(startDate: string, endDate: string) {
  const pages = await queryAllPages(SUMMARY_DATA_SOURCE_ID, {
    filter: dateRangeFilter("처리일", startDate, endDate),
    filter_properties: ["처리일", "제품명", "처리결과", "처리수량"],
  });

  const rows = new Map<string, ExistingSummaryRow>();
  for (const page of pages) {
    const date = dateStart(page.properties["처리일"]);
    const product = plainText(page.properties["제품명"]);
    const result = selectName(page.properties["처리결과"]);
    if (!date || !product || (result !== "재상품화" && result !== "원자재화")) continue;
    const key = `${date}|||${product}|||${result}`;
    if (!rows.has(key)) {
      rows.set(key, {
        pageId: page.id,
        date,
        product,
        result,
        count: numberValue(page.properties["처리수량"]),
      });
    }
  }
  return rows;
}

async function createRawPage(record: AppReturnRecord) {
  await notionRequest("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: RAW_DATA_SOURCE_ID },
      properties: rawPageProperties(record),
    }),
  });
}

async function createSummaryPage(row: SummaryRow) {
  await notionRequest("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: SUMMARY_DATA_SOURCE_ID },
      properties: {
        기록명: titleProperty(`${row.date} | ${row.product} | ${row.result}`),
        처리일: { date: { start: row.date } },
        제품명: textProperty(row.product),
        처리결과: { select: { name: row.result } },
        처리수량: { number: row.count },
      },
    }),
  });
}

async function updateSummaryPage(pageId: string, row: SummaryRow) {
  await notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        기록명: titleProperty(`${row.date} | ${row.product} | ${row.result}`),
        처리수량: { number: row.count },
      },
    }),
  });
}

export async function checkNotionAccess() {
  const [raw, summary] = await Promise.all([
    notionRequest<{ id: string; object: string }>(`/data_sources/${RAW_DATA_SOURCE_ID}`),
    notionRequest<{ id: string; object: string }>(`/data_sources/${SUMMARY_DATA_SOURCE_ID}`),
  ]);
  return {
    ok: true,
    notionVersion: NOTION_VERSION,
    rawDataSource: raw.id,
    summaryDataSource: summary.id,
  };
}

export async function syncReturnRecordsToNotion(
  records: AppReturnRecord[],
  options: SyncOptions
): Promise<NotionSyncResult> {
  assertDate(options.startDate, "startDate");
  assertDate(options.endDate, "endDate");
  if (options.startDate > options.endDate) {
    throw new Error("startDate는 endDate보다 늦을 수 없습니다.");
  }

  const [existingIds, existingSummary] = await Promise.all([
    existingProgramIds(options.startDate, options.endDate),
    existingSummaryRows(options.startDate, options.endDate),
  ]);

  const newRawRecords = records.filter((record) => !existingIds.has(record.id));
  const aggregated = aggregateSummary(records);
  const summaryToCreate: SummaryRow[] = [];
  const summaryToUpdate: Array<{ pageId: string; row: SummaryRow }> = [];
  let summaryUnchanged = 0;

  for (const row of aggregated.rows) {
    const key = `${row.date}|||${row.product}|||${row.result}`;
    const existing = existingSummary.get(key);
    if (!existing) summaryToCreate.push(row);
    else if (existing.count !== row.count) summaryToUpdate.push({ pageId: existing.pageId, row });
    else summaryUnchanged += 1;
  }

  const result: NotionSyncResult = {
    dryRun: options.dryRun,
    period: { startDate: options.startDate, endDate: options.endDate },
    sourceRecords: records.length,
    raw: {
      createPlanned: newRawRecords.length,
      created: 0,
      skippedExisting: records.length - newRawRecords.length,
      failed: 0,
    },
    summary: {
      eligibleSourceRecords: aggregated.eligibleSourceRecords,
      rowsCalculated: aggregated.rows.length,
      createPlanned: summaryToCreate.length,
      updatePlanned: summaryToUpdate.length,
      unchanged: summaryUnchanged,
      created: 0,
      updated: 0,
      failed: 0,
    },
    errors: [],
  };

  if (options.dryRun) return result;

  for (const record of newRawRecords) {
    try {
      await createRawPage(record);
      result.raw.created += 1;
    } catch (error) {
      result.raw.failed += 1;
      result.errors.push(
        `상세 기록 ${record.id}: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
      );
    }
  }

  for (const row of summaryToCreate) {
    try {
      await createSummaryPage(row);
      result.summary.created += 1;
    } catch (error) {
      result.summary.failed += 1;
      result.errors.push(
        `처리현황 생성 ${row.date}/${row.product}/${row.result}: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    }
  }

  for (const item of summaryToUpdate) {
    try {
      await updateSummaryPage(item.pageId, item.row);
      result.summary.updated += 1;
    } catch (error) {
      result.summary.failed += 1;
      result.errors.push(
        `처리현황 수정 ${item.row.date}/${item.row.product}/${item.row.result}: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    }
  }

  return result;
}
