import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import type { AppReturnRecord } from "@/app/lib/google-storage";

const RETURN_TYPES = [
  "일반반품",
  "변심반품",
  "불량반품",
  "불량교환",
  "AS",
  "검수",
] as const;

const INSPECTION_RESULTS = [
  "검사 대기",
  "정상확인",
  "불량판정",
  "후속 확인 필요",
] as const;

const PROCESS_ACTIONS = [
  "미선택",
  "안성물류이동",
  "안성물류폐기이동",
  "자체폐기",
  "자체 B급활용",
] as const;

export type CreateReturnRecordInput = {
  createdDate?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  customerName?: string;
  returnType: string;
  productName: string;
  processAction?: string;
  inspectionResult: string;
  note?: string;
  allowDuplicate?: boolean;
};

export type RecordFilterInput = {
  startDate?: string;
  endDate?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  productName?: string;
  inspectionResult?: string;
  limit?: number;
};

function normalized(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compact(value: unknown) {
  return normalized(value).replace(/\s+/g, "").toLowerCase();
}

export function getDateOnly(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function assertDate(value: string | undefined, fieldName: string) {
  if (!value) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName}은 YYYY-MM-DD 형식이어야 합니다.`);
  }
}

function nowInSeoul() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+09:00`;
}

function normalizeInspectionResult(value: string) {
  const text = compact(value);
  if (text === "정상" || text === "정상확인" || text === "정상화완료") {
    return "정상확인";
  }
  if (text === "불량" || text === "불량판정") return "불량판정";
  if (text === "검사대기") return "검사 대기";
  if (text === "후속확인필요") return "후속 확인 필요";
  return normalized(value);
}

function normalizeProcessAction(value?: string) {
  const text = compact(value);
  if (!text || text === "미선택") return "미선택";
  if (text === "원자재화" || text.includes("b급")) return "자체 B급활용";
  if (text === "안성폐기" || text.includes("안성물류폐기")) {
    return "안성물류폐기이동";
  }
  if (text === "자체폐기") return "자체폐기";
  if (text === "안성물류이동" || text === "재상품화") return "안성물류이동";
  return normalized(value);
}

export function createReturnRecord(input: CreateReturnRecordInput): AppReturnRecord {
  assertDate(input.createdDate, "createdDate");

  const returnType = normalized(input.returnType);
  if (!RETURN_TYPES.includes(returnType as (typeof RETURN_TYPES)[number])) {
    throw new Error(`반품유형은 ${RETURN_TYPES.join(", ")} 중 하나여야 합니다.`);
  }

  const productName = normalized(input.productName);
  if (!productName) throw new Error("제품명이 필요합니다.");

  const inspectionResult = normalizeInspectionResult(input.inspectionResult);
  if (!INSPECTION_RESULTS.includes(inspectionResult as (typeof INSPECTION_RESULTS)[number])) {
    throw new Error(`검사결과는 ${INSPECTION_RESULTS.join(", ")} 중 하나여야 합니다.`);
  }

  let processAction = normalizeProcessAction(input.processAction);
  if (!input.processAction && inspectionResult === "정상확인") {
    processAction = "안성물류이동";
  }

  if (!PROCESS_ACTIONS.includes(processAction as (typeof PROCESS_ACTIONS)[number])) {
    throw new Error(`이동/처리 값이 올바르지 않습니다.`);
  }

  if (inspectionResult === "정상확인" && processAction !== "안성물류이동") {
    throw new Error("정상확인 기록의 이동/처리는 안성물류이동이어야 합니다.");
  }

  if (
    inspectionResult === "불량판정" &&
    !["자체폐기", "자체 B급활용", "안성물류폐기이동"].includes(processAction)
  ) {
    throw new Error(
      "불량판정은 자체폐기, 원자재화(자체 B급활용), 안성폐기 중 이동/처리를 지정해야 합니다."
    );
  }

  if (
    ["검사 대기", "후속 확인 필요"].includes(inspectionResult) &&
    processAction !== "미선택"
  ) {
    throw new Error("검사 대기 또는 후속 확인 필요 기록은 이동/처리를 미선택으로 두어야 합니다.");
  }

  return {
    id: randomUUID(),
    createdAt: input.createdDate
      ? `${input.createdDate}T12:00:00+09:00`
      : nowInSeoul(),
    invoiceNumber: normalized(input.invoiceNumber),
    orderNumber: normalized(input.orderNumber),
    customerName: normalized(input.customerName),
    returnType,
    productName,
    processAction,
    inspectionResult,
    note: normalized(input.note),
    invoicePhotos: [],
    productPhotos: [],
  };
}

export function findDuplicateRecord(
  records: AppReturnRecord[],
  candidate: AppReturnRecord
) {
  const candidateInvoice = compact(candidate.invoiceNumber);
  const candidateOrder = compact(candidate.orderNumber);
  const candidateProduct = compact(candidate.productName);

  return records.find((record) => {
    if (compact(record.productName) !== candidateProduct) return false;

    const sameInvoice =
      candidateInvoice && compact(record.invoiceNumber) === candidateInvoice;
    const sameOrder = candidateOrder && compact(record.orderNumber) === candidateOrder;

    return Boolean(sameInvoice || sameOrder);
  });
}

export function filterReturnRecords(
  records: AppReturnRecord[],
  filters: RecordFilterInput
) {
  assertDate(filters.startDate, "startDate");
  assertDate(filters.endDate, "endDate");

  const filtered = records.filter((record) => {
    const date = getDateOnly(record.createdAt);
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    if (
      filters.invoiceNumber &&
      !compact(record.invoiceNumber).includes(compact(filters.invoiceNumber))
    ) {
      return false;
    }
    if (
      filters.orderNumber &&
      !compact(record.orderNumber).includes(compact(filters.orderNumber))
    ) {
      return false;
    }
    if (
      filters.productName &&
      !compact(record.productName).includes(compact(filters.productName))
    ) {
      return false;
    }
    if (
      filters.inspectionResult &&
      normalizeInspectionResult(record.inspectionResult) !==
        normalizeInspectionResult(filters.inspectionResult)
    ) {
      return false;
    }
    return true;
  });

  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  return filtered.slice(0, limit);
}

export function summarizeReturnRecords(records: AppReturnRecord[]) {
  const normal = records.filter(
    (record) => normalizeInspectionResult(record.inspectionResult) === "정상확인"
  ).length;
  const defective = records.filter(
    (record) => normalizeInspectionResult(record.inspectionResult) === "불량판정"
  ).length;

  return {
    total: records.length,
    normal,
    defective,
    pending: records.filter(
      (record) => normalizeInspectionResult(record.inspectionResult) === "검사 대기"
    ).length,
    followUp: records.filter(
      (record) => normalizeInspectionResult(record.inspectionResult) === "후속 확인 필요"
    ).length,
  };
}

function displayProcessAction(value?: string) {
  if (value === "자체 B급활용") return "원자재화";
  if (value === "안성물류폐기이동") return "안성폐기";
  return value || "미선택";
}

function notionDate(value: string) {
  const date = getDateOnly(value);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`
    : date;
}

function notionProduct(productName: string) {
  const productMap: Record<string, string> = {
    휴대용분유포트: "[꿈비] 휴대용 분유포트",
    "(분리형) 휴대용분유포트": "[꿈비] 분리형 휴대용 분유포트",
    분유쉐이커: "[꿈비] 분유쉐이커",
    LED분유쉐이커: "[꿈비] 뭉침없이 조용한 분유쉐이커",
  };
  return productMap[normalized(productName)] || normalized(productName);
}

function notionResult(record: AppReturnRecord) {
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

function buildNotionRows(records: AppReturnRecord[]) {
  const summary = new Map<string, number>();

  for (const record of records) {
    const date = notionDate(record.createdAt);
    const product = notionProduct(record.productName);
    const result = notionResult(record);
    if (!date || !product || !result) continue;

    const key = `${date}|||${product}|||${result}`;
    summary.set(key, (summary.get(key) || 0) + 1);
  }

  const notionDateToTime = (value: string) => {
    const match = value.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (!match) return 0;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  };

  return [...summary.entries()]
    .map(([key, count]) => [...key.split("|||"), count])
    .sort((left, right) => {
      const dateCompare =
        notionDateToTime(String(right[0])) - notionDateToTime(String(left[0]));
      if (dateCompare !== 0) return dateCompare;

      const productCompare = String(left[1]).localeCompare(String(right[1]), "ko-KR");
      if (productCompare !== 0) return productCompare;
      return String(left[2]).localeCompare(String(right[2]), "ko-KR");
    });
}

function absoluteUrl(url: string, origin: string) {
  if (!url) return "";
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
}

export function buildReturnRecordWorkbook(
  records: AppReturnRecord[],
  origin: string
) {
  const headers = [
    "등록일자",
    "송장번호",
    "주문번호",
    "고객명",
    "반품유형",
    "제품명",
    "검사결과",
    "이동/처리",
    "비고",
    "송장사진1",
    "송장사진2",
    "제품사진1",
    "제품사진2",
    "제품사진3",
    "제품사진4",
  ];

  const rows = records.map((record) => [
    getDateOnly(record.createdAt),
    record.invoiceNumber || "",
    record.orderNumber || "",
    record.customerName || "",
    record.returnType || "",
    record.productName || "",
    record.inspectionResult || "",
    displayProcessAction(record.processAction),
    record.note || "",
    record.invoicePhotos[0]?.url ? "송장사진1 보기" : "",
    record.invoicePhotos[1]?.url ? "송장사진2 보기" : "",
    record.productPhotos[0]?.url ? "제품사진1 보기" : "",
    record.productPhotos[1]?.url ? "제품사진2 보기" : "",
    record.productPhotos[2]?.url ? "제품사진3 보기" : "",
    record.productPhotos[3]?.url ? "제품사진4 보기" : "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  records.forEach((record, index) => {
    const row = index + 1;
    const photos = [
      ...record.invoicePhotos.slice(0, 2),
      ...record.productPhotos.slice(0, 4),
    ];
    photos.forEach((photo, photoIndex) => {
      const column = 9 + photoIndex;
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (sheet[address] && photo.url) {
        sheet[address].l = {
          Target: absoluteUrl(photo.url, origin),
          Tooltip: photo.filename || "사진 보기",
        };
      }
    });
  });
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: headers.length - 1 },
    }),
  };
  sheet["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 35 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ];

  const notionHeaders = ["처리일", "제품명", "처리결과", "처리수량"];
  const notionRows = buildNotionRows(records);
  const notionSheet = XLSX.utils.aoa_to_sheet([notionHeaders, ...notionRows]);
  notionSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: notionRows.length, c: notionHeaders.length - 1 },
    }),
  };
  notionSheet["!cols"] = [
    { wch: 18 }, { wch: 34 }, { wch: 14 }, { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "반품검사기록");
  XLSX.utils.book_append_sheet(workbook, notionSheet, "노션_처리현황");

  return Buffer.from(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
  );
}

export function buildExcelFilename(startDate?: string, endDate?: string) {
  const compactDate = (value: string) => value.replace(/-/g, "");
  if (startDate && endDate) {
    return `반품검사기록_${compactDate(startDate)}_${compactDate(endDate)}.xlsx`;
  }
  if (startDate) return `반품검사기록_${compactDate(startDate)}_이후.xlsx`;
  if (endDate) return `반품검사기록_${compactDate(endDate)}_까지.xlsx`;
  return `반품검사기록_전체.xlsx`;
}
