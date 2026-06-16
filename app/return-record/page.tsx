// LEFT_TABS_PRODUCT_NORMALIZED_2026_06_16
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ClipboardList,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock3,
  Smartphone,
  Database,
} from "lucide-react";

import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReturnType =
  | "일반반품"
  | "변심반품"
  | "불량반품"
  | "불량교환"
  | "AS"
  | "검수";

type ProductType = string;

type ProductSelectValue =
  | "휴대용분유포트"
  | "(분리형) 휴대용분유포트"
  | "분유쉐이커"
  | "LED분유쉐이커"
  | "젖병살균세척기"
  | "직접입력";

type ProcessAction =
  | "미선택"
  | "안성물류이동"
  | "안성물류폐기이동"
  | "자체폐기"
  | "자체 B급활용";

type InspectionResult =
  | "검사 대기"
  | "정상확인"
  | "정상화 완료"
  | "불량판정"
  | "불량 판정"
  | "후속 확인 필요";

type UploadedPhoto = {
  url: string;
  pathname?: string;
  filename: string;
  size: number;
  contentType?: string;
};

type ReturnRecord = {
  id: string;
  createdAt: string;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  returnType: ReturnType;
  productName: ProductType;
  processAction?: ProcessAction;
  inspectionResult: InspectionResult;
  note: string;
  invoicePhotos: UploadedPhoto[];
  productPhotos: UploadedPhoto[];
};

type InlineEditDraft = {
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  returnType: ReturnType;
  productName: ProductSelectValue;
  customProductName: string;
  processAction: ProcessAction;
  inspectionResult: InspectionResult;
  note: string;
};

type OcrParsedResult = {
  trackingNumber?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  customerName?: string;
  returnType?: string;
  productName?: string;
  rawText?: string;
};

type ReportRange = "today" | "week" | "all";
type ActivePanel = "dashboard" | "modelReport" | "records" | "form";

type ReportDateKeys = {
  todayKey: string;
  weekStartKey: string;
  weekEndKey: string;
};

type ReportMetricRow = {
  label: string;
  count: number;
  percent: number;
};

type DefectReasonRow = {
  label: string;
  count: number;
  percent: number;
};

type ModelDefectRow = {
  productName: string;
  count: number;
  reasons: DefectReasonRow[];
};

const RETURN_TYPES: ReturnType[] = [
  "일반반품",
  "변심반품",
  "불량반품",
  "불량교환",
  "AS",
  "검수",
];

const PRODUCT_TYPES: ProductSelectValue[] = [
  "휴대용분유포트",
  "(분리형) 휴대용분유포트",
  "분유쉐이커",
  "LED분유쉐이커",
  "젖병살균세척기",
  "직접입력",
];

const PROCESS_ACTIONS: ProcessAction[] = [
  "미선택",
  "안성물류이동",
  "안성물류폐기이동",
  "자체폐기",
  "자체 B급활용",
];

const RESULT_TYPES: InspectionResult[] = [
  "검사 대기",
  "정상확인",
  "불량판정",
  "후속 확인 필요",
];

const NORMAL_INSPECTION_RESULTS: InspectionResult[] = ["정상확인", "정상화 완료"];
const DEFECTIVE_INSPECTION_RESULTS: InspectionResult[] = ["불량판정", "불량 판정"];

const NORMAL_NOTE_OPTIONS = ["미개봉 새상품", "정상화 완료"];
const DEFECTIVE_NOTE_OPTIONS = [
  "전원불량",
  "사용감",
  "소음",
  "누수",
  "충전불량",
  "회전불량",
  "수분유입",
  "이물질",
];

const CUSTOM_DEFECTIVE_NOTE_OPTIONS_API_PATH = "/api/note-options";
const LEGACY_CUSTOM_DEFECTIVE_NOTE_OPTIONS_STORAGE_KEY =
  "return-record-custom-defective-note-options";

function normalizeNoteOptionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getUniqueNoteOptions(options: string[]) {
  const optionSet = new Set<string>();

  options.forEach((option) => {
    const normalized = normalizeNoteOptionText(option);

    if (normalized) {
      optionSet.add(normalized);
    }
  });

  return Array.from(optionSet);
}

const REPORT_RANGE_OPTIONS: {
  value: ReportRange;
  label: string;
  description: string;
}[] = [
  { value: "today", label: "오늘", description: "금일 검수" },
  { value: "week", label: "이번주", description: "월요일~일요일" },
  { value: "all", label: "전체", description: "누적 데이터" },
];

function normalizeInspectionResult(value: InspectionResult): InspectionResult {
  if (value === "정상화 완료") return "정상확인";
  if (value === "불량 판정") return "불량판정";
  return value;
}

function isNormalInspectionResult(value?: string) {
  return NORMAL_INSPECTION_RESULTS.includes(value as InspectionResult);
}

function isDefectiveInspectionResult(value?: string) {
  return DEFECTIVE_INSPECTION_RESULTS.includes(value as InspectionResult);
}

function calculatePercent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function normalizeReportProductName(productName?: string) {
  const original = (productName || "").trim();
  if (!original) return "제품명 미입력";

  const compact = original.replace(/\s+/g, "");
  const upperCompact = compact.toUpperCase();

  if (
    upperCompact.includes("LED") ||
    compact.includes("엘이디") ||
    compact.includes("뭉침없이") ||
    compact.includes("조용한")
  ) {
    return "LED분유쉐이커";
  }

  if (
    compact === "분유쉐이커" ||
    compact === "[꿈비]분유쉐이커" ||
    compact.includes("기본분유쉐이커") ||
    compact.includes("분유세이커") ||
    compact.includes("분유쉐이커") ||
    compact.includes("쉐이커") ||
    compact.includes("세이커")
  ) {
    return "분유쉐이커";
  }

  if (compact.includes("분리형")) {
    return "(분리형) 휴대용분유포트";
  }

  if (
    compact.includes("휴대용분유포트") ||
    compact.includes("휴대용분유") ||
    compact.includes("분유포트")
  ) {
    return "휴대용분유포트";
  }

  if (
    compact.includes("젖병살균세척기") ||
    compact.includes("젖병세척기") ||
    compact.includes("살균세척기") ||
    upperCompact.includes("스팀PLUS") ||
    compact.includes("스팀플러스")
  ) {
    return "젖병살균세척기";
  }

  return original;
}

function buildReportSummary(
  records: ReturnRecord[],
  defectiveNoteOptions: string[] = DEFECTIVE_NOTE_OPTIONS
) {
  const total = records.length;
  const normal = records.filter((record) =>
    isNormalInspectionResult(record.inspectionResult)
  ).length;
  const defectiveRecords = records.filter((record) =>
    isDefectiveInspectionResult(record.inspectionResult)
  );
  const defective = defectiveRecords.length;
  const followUp = records.filter(
    (record) => record.inspectionResult === "후속 확인 필요"
  ).length;
  const pending = records.filter(
    (record) => record.inspectionResult === "검사 대기"
  ).length;

  const resultRows: ReportMetricRow[] = [
    { label: "정상확인", count: normal, percent: calculatePercent(normal, total) },
    { label: "불량판정", count: defective, percent: calculatePercent(defective, total) },
    { label: "후속 확인 필요", count: followUp, percent: calculatePercent(followUp, total) },
    { label: "검사 대기", count: pending, percent: calculatePercent(pending, total) },
  ];

  const reasonMap = new Map<string, number>();
  const modelMap = new Map<string, { count: number; reasons: Map<string, number> }>();

  defectiveRecords.forEach((record) => {
    const noteText = record.note || "";
    const matchedReasons = defectiveNoteOptions.filter((reason) =>
      noteText.includes(reason)
    );
    const reasons = matchedReasons.length > 0 ? matchedReasons : ["기타"];

    reasons.forEach((reason) => {
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    });

    const productName = normalizeReportProductName(record.productName);
    const currentModel = modelMap.get(productName) || {
      count: 0,
      reasons: new Map<string, number>(),
    };

    currentModel.count += 1;
    reasons.forEach((reason) => {
      currentModel.reasons.set(
        reason,
        (currentModel.reasons.get(reason) || 0) + 1
      );
    });

    modelMap.set(productName, currentModel);
  });

  const defectReasonRows: DefectReasonRow[] = Array.from(reasonMap.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: calculatePercent(count, defective || count),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko-KR"));

  const modelDefectRows: ModelDefectRow[] = Array.from(modelMap.entries())
    .map(([productName, value]) => ({
      productName,
      count: value.count,
      reasons: Array.from(value.reasons.entries())
        .map(([label, count]) => ({
          label,
          count,
          percent: calculatePercent(count, value.count || count),
        }))
        .sort(
          (a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko-KR")
        ),
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.productName.localeCompare(b.productName, "ko-KR")
    );

  return {
    total,
    normal,
    defective,
    followUp,
    pending,
    defectRate: calculatePercent(defective, total),
    normalRate: calculatePercent(normal, total),
    resultRows,
    defectReasonRows,
    modelDefectRows,
  };
}

function getProcessActionsByInspectionResult(value: InspectionResult): ProcessAction[] {
  if (isNormalInspectionResult(value)) {
    return ["안성물류이동"];
  }

  if (isDefectiveInspectionResult(value)) {
    return ["안성물류폐기이동", "자체폐기", "자체 B급활용"];
  }

  return PROCESS_ACTIONS;
}

function getDefaultProcessActionByInspectionResult(
  value: InspectionResult,
  currentProcessAction: ProcessAction
): ProcessAction {
  const availableProcessActions = getProcessActionsByInspectionResult(value);

  if (availableProcessActions.includes(currentProcessAction)) {
    return currentProcessAction;
  }

  if (isNormalInspectionResult(value)) {
    return "안성물류이동";
  }

  if (isDefectiveInspectionResult(value)) {
    return "안성물류폐기이동";
  }

  return "미선택";
}

function getNoteOptionsByInspectionResult(
  value: InspectionResult,
  customDefectiveNoteOptions: string[] = []
) {
  if (isNormalInspectionResult(value)) return NORMAL_NOTE_OPTIONS;
  if (isDefectiveInspectionResult(value)) {
    return getUniqueNoteOptions([
      ...DEFECTIVE_NOTE_OPTIONS,
      ...customDefectiveNoteOptions,
    ]);
  }
  return [];
}

function appendNoteOption(currentNote: string, option: string) {
  const trimmedNote = currentNote.trim();

  if (!trimmedNote) return option;
  if (trimmedNote.includes(option)) return currentNote;

  return `${trimmedNote}, ${option}`;
}

const MAX_INVOICE_PHOTOS = 2;
const MAX_PRODUCT_PHOTOS = 4;
const MAX_FILE_MB = 5;
const JPEG_QUALITY = 0.72;
const IMAGE_MAX_WIDTH = 1600;
const IMAGE_MAX_HEIGHT = 1600;

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateOnly(value: string) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (value.includes("T")) {
    return value.split("T")[0];
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateToDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentReportDateKeys(): ReportDateKeys {
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    todayKey: dateToDateKey(todayStart),
    weekStartKey: dateToDateKey(weekStart),
    weekEndKey: dateToDateKey(weekEnd),
  };
}

function formatDateKeyKo(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return dateKey;

  return `${match[1]}.${match[2]}.${match[3]}`;
}

function getReportPeriodLabel(range: ReportRange, keys: ReportDateKeys) {
  if (range === "today") {
    return formatDateKeyKo(keys.todayKey);
  }

  if (range === "week") {
    return `${formatDateKeyKo(keys.weekStartKey)} ~ ${formatDateKeyKo(
      keys.weekEndKey
    )}`;
  }

  return "저장된 전체 기록";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


function formatNotionProcessDate(value: string) {
  const dateOnly = getDateOnly(value);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return dateOnly;

  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function formatNotionProductName(productName: string) {
  const normalized = productName.trim();

  // 기존 4종은 노션에 사용하던 표기명을 유지하고,
  // 그 외 입고 제품은 입력된 제품명 그대로 노션 처리현황에 포함합니다.
  const productMap: Record<string, string> = {
    "휴대용분유포트": "[꿈비] 휴대용 분유포트",
    "(분리형) 휴대용분유포트": "[꿈비] 분리형 휴대용 분유포트",
    "분유쉐이커": "[꿈비] 분유쉐이커",
    "LED분유쉐이커": "[꿈비] 뭉침없이 조용한 분유쉐이커",
  };

  return productMap[normalized] || normalized;
}

function notionDateToTime(value: string) {
  const match = value.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);

  if (!match) return 0;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(year, month - 1, day).getTime();
}

function getNotionProcessResult(record: ReturnRecord) {
  const normalizeText = (value?: string) =>
    String(value || "")
      .replace(/\s+/g, "")
      .toLowerCase();

  const returnType = normalizeText(record.returnType);
  const inspectionResult = normalizeText(record.inspectionResult);
  const processAction = normalizeText(record.processAction);
  const note = normalizeText(record.note);

  const isGeneralOrChange =
    returnType.includes("일반") || returnType.includes("변심");
  const isAsOrInspection =
    returnType.includes("as") || returnType.includes("검수");
  const isDefect =
    returnType.includes("불량교환") || returnType.includes("불량반품");
  const isNotionTargetType = isGeneralOrChange || isAsOrInspection || isDefect;

  const isNormal =
    inspectionResult.includes("정상확인") ||
    inspectionResult.includes("정상화완료") ||
    inspectionResult === "정상";

  const isBGrade =
    processAction.includes("b급") ||
    processAction.includes("b급활용") ||
    processAction.includes("b") ||
    inspectionResult.includes("b급") ||
    inspectionResult.includes("b") ||
    note.includes("b급") ||
    note.includes("b급활용");

  const isDisposal =
    processAction.includes("폐기") ||
    inspectionResult.includes("폐기") ||
    note.includes("폐기");

  // 폐기 건은 노션_처리현황 탭에 행 자체를 만들지 않습니다.
  if (isDisposal) return "";

  // 일반반품 / 변심반품 + 정상 → 재상품화
  if (isGeneralOrChange && isNormal) {
    return "재상품화";
  }

  // 일반반품 / 변심반품 / AS / 검수 / 불량교환 / 불량반품 + B급 → 원자재화
  // 예: 검수 + 불량 판정 + 자체 B급활용 + 비고에 B급활용 문구가 있는 건도 포함합니다.
  if (isNotionTargetType && isBGrade) {
    return "원자재화";
  }

  return "";
}

function buildNotionProcessRows(records: ReturnRecord[]) {
  const summaryMap = new Map<string, number>();

  records.forEach((record) => {
    const processDate = formatNotionProcessDate(record.createdAt);
    const productName = formatNotionProductName(record.productName || "");
    const processResult = getNotionProcessResult(record);

    if (!processDate || !productName || !processResult) return;

    const key = `${processDate}|||${productName}|||${processResult}`;
    summaryMap.set(key, (summaryMap.get(key) || 0) + 1);
  });

  return Array.from(summaryMap.entries())
    .map(([key, count]) => {
      const [processDate, productName, processResult] = key.split("|||");

      return [processDate, productName, processResult, count];
    })
    .sort((a, b) => {
      const dateCompare = notionDateToTime(String(b[0])) - notionDateToTime(String(a[0]));
      if (dateCompare !== 0) return dateCompare;

      const productCompare = String(a[1]).localeCompare(String(b[1]), "ko-KR");
      if (productCompare !== 0) return productCompare;

      return String(a[2]).localeCompare(String(b[2]), "ko-KR");
    });
}

function downloadExcel(filename: string, records: ReturnRecord[]) {
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
    record.processAction || "미선택",
    record.note || "",
    record.invoicePhotos[0]?.url ? "송장사진1 보기" : "",
    record.invoicePhotos[1]?.url ? "송장사진2 보기" : "",
    record.productPhotos[0]?.url ? "제품사진1 보기" : "",
    record.productPhotos[1]?.url ? "제품사진2 보기" : "",
    record.productPhotos[2]?.url ? "제품사진3 보기" : "",
    record.productPhotos[3]?.url ? "제품사진4 보기" : "",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  records.forEach((record, index) => {
    const rowNumber = index + 1;

    record.invoicePhotos.slice(0, 2).forEach((photo, photoIndex) => {
      const cellAddress = XLSX.utils.encode_cell({
        r: rowNumber,
        c: 9 + photoIndex,
      });

      if (worksheet[cellAddress]) {
        worksheet[cellAddress].l = {
          Target: photo.url,
          Tooltip: photo.filename || "송장사진 보기",
        };
      }
    });

    record.productPhotos.slice(0, 4).forEach((photo, photoIndex) => {
      const cellAddress = XLSX.utils.encode_cell({
        r: rowNumber,
        c: 11 + photoIndex,
      });

      if (worksheet[cellAddress]) {
        worksheet[cellAddress].l = {
          Target: photo.url,
          Tooltip: photo.filename || "제품사진 보기",
        };
      }
    });
  });

  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: headers.length - 1 },
    }),
  };

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 35 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  const notionHeaders = ["처리일", "제품명", "처리결과", "처리수량"];
  const notionRows = buildNotionProcessRows(records);
  const notionWorksheet = XLSX.utils.aoa_to_sheet([notionHeaders, ...notionRows]);

  notionWorksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: notionRows.length, c: notionHeaders.length - 1 },
    }),
  };

  notionWorksheet["!cols"] = [
    { wch: 18 },
    { wch: 34 },
    { wch: 14 },
    { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "반품검사기록");
  XLSX.utils.book_append_sheet(workbook, notionWorksheet, "노션_처리현황");
  XLSX.writeFile(workbook, filename);
}


function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(blobUrl);

    let { width, height } = img;
    const ratio = Math.min(
      1,
      IMAGE_MAX_WIDTH / width,
      IMAGE_MAX_HEIGHT / height
    );

    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("이미지 압축에 실패했습니다."));
            return;
          }
          resolve(result);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    });

    const safeName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], safeName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function uploadSingleFile(
  file: File,
  folder: "invoice" | "product"
): Promise<UploadedPhoto> {
  const optimized = await compressImage(file);

  const formData = new FormData();
  formData.append("file", optimized);
  formData.append("folder", folder);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "업로드에 실패했습니다.");
  }

  return {
    url: data.url,
    pathname: data.pathname,
    filename: optimized.name,
    size: optimized.size,
    contentType: optimized.type,
  };
}

export default function ReturnRecordApp() {
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [savingRecord, setSavingRecord] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineSavingId, setInlineSavingId] = useState<string | null>(null);
  const [inlineEditDraft, setInlineEditDraft] = useState<InlineEditDraft | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [returnType, setReturnType] = useState<ReturnType>("일반반품");
  const [productName, setProductName] = useState<ProductSelectValue>("휴대용분유포트");
  const [customProductName, setCustomProductName] = useState("");
  const [processAction, setProcessAction] = useState<ProcessAction>("미선택");
  const [inspectionResult, setInspectionResult] =
    useState<InspectionResult>("검사 대기");
  const [note, setNote] = useState("");
  const [customDefectiveNoteOptions, setCustomDefectiveNoteOptions] = useState<
    string[]
  >([]);
  const [loadingNoteOptions, setLoadingNoteOptions] = useState(false);
  const [savingNoteOption, setSavingNoteOption] = useState(false);

  const [invoicePhotos, setInvoicePhotos] = useState<UploadedPhoto[]>([]);
  const [productPhotos, setProductPhotos] = useState<UploadedPhoto[]>([]);

  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingProduct, setUploadingProduct] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [filterProduct, setFilterProduct] = useState<string>("전체");
  const [filterResult, setFilterResult] = useState<string>("전체");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [reportRange, setReportRange] = useState<ReportRange>("today");
  const [activePanel, setActivePanel] = useState<ActivePanel>("form");

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusError, setStatusError] = useState<string>("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string>("");
  const [ocrRawText, setOcrRawText] = useState<string>("");

  async function fetchRecords() {
    try {
      setLoadingRecords(true);
      setStatusError("");

      const response = await fetch("/api/records", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "기록 조회에 실패했습니다.");
      }

      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "기록을 불러오지 못했습니다."
      );
    } finally {
      setLoadingRecords(false);
    }
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  function getLegacyCustomDefectiveNoteOptions() {
    try {
      const storedOptions = window.localStorage.getItem(
        LEGACY_CUSTOM_DEFECTIVE_NOTE_OPTIONS_STORAGE_KEY
      );

      if (!storedOptions) return [];

      const parsedOptions = JSON.parse(storedOptions);

      if (!Array.isArray(parsedOptions)) return [];

      return getUniqueNoteOptions(parsedOptions.map((item) => String(item)));
    } catch {
      window.localStorage.removeItem(
        LEGACY_CUSTOM_DEFECTIVE_NOTE_OPTIONS_STORAGE_KEY
      );
      return [];
    }
  }

  async function fetchCustomDefectiveNoteOptions() {
    try {
      setLoadingNoteOptions(true);

      const response = await fetch(CUSTOM_DEFECTIVE_NOTE_OPTIONS_API_PATH, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "비고 문구 조회에 실패했습니다.");
      }

      let nextOptions = getUniqueNoteOptions(
        Array.isArray(data.customDefectiveNoteOptions)
          ? data.customDefectiveNoteOptions.map((item: unknown) => String(item))
          : []
      );

      const legacyOptions = getLegacyCustomDefectiveNoteOptions();
      const optionsToMigrate = legacyOptions.filter(
        (option) =>
          !DEFECTIVE_NOTE_OPTIONS.includes(option) &&
          !nextOptions.includes(option)
      );

      if (optionsToMigrate.length > 0) {
        const migrateResponse = await fetch(
          CUSTOM_DEFECTIVE_NOTE_OPTIONS_API_PATH,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ options: optionsToMigrate }),
          }
        );
        const migrateData = await migrateResponse.json();

        if (!migrateResponse.ok) {
          throw new Error(
            migrateData?.error || "기존 비고 문구 서버 저장에 실패했습니다."
          );
        }

        nextOptions = getUniqueNoteOptions(
          Array.isArray(migrateData.customDefectiveNoteOptions)
            ? migrateData.customDefectiveNoteOptions.map((item: unknown) =>
                String(item)
              )
            : nextOptions
        );

        window.localStorage.removeItem(
          LEGACY_CUSTOM_DEFECTIVE_NOTE_OPTIONS_STORAGE_KEY
        );
      }

      setCustomDefectiveNoteOptions(nextOptions);
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : "비고 문구를 불러오지 못했습니다."
      );
    } finally {
      setLoadingNoteOptions(false);
    }
  }

  useEffect(() => {
    fetchCustomDefectiveNoteOptions();
  }, []);

  const defectiveNoteOptionsForReport = useMemo(
    () => getNoteOptionsByInspectionResult(
      "불량판정",
      customDefectiveNoteOptions
    ),
    [customDefectiveNoteOptions]
  );

  const summary = useMemo(() => {
    const total = records.length;
    const normal = records.filter((r) =>
      isNormalInspectionResult(r.inspectionResult)
    ).length;
    const defective = records.filter((r) =>
      isDefectiveInspectionResult(r.inspectionResult)
    ).length;
    const followUp = records.filter((r) => r.inspectionResult === "후속 확인 필요").length;

    const totalPhotoSize = records.reduce((acc, record) => {
      const invoiceSize = record.invoicePhotos.reduce((s, p) => s + (p.size || 0), 0);
      const productSize = record.productPhotos.reduce((s, p) => s + (p.size || 0), 0);
      return acc + invoiceSize + productSize;
    }, 0);

    return {
      total,
      normal,
      defective,
      followUp,
      totalPhotoSize,
    };
  }, [records]);

  const reportDateKeys = useMemo(() => getCurrentReportDateKeys(), []);

  const reportRecords = useMemo(() => {
    if (reportRange === "all") return records;

    const startDate =
      reportRange === "today"
        ? reportDateKeys.todayKey
        : reportDateKeys.weekStartKey;
    const endDate =
      reportRange === "today"
        ? reportDateKeys.todayKey
        : reportDateKeys.weekEndKey;

    return records.filter((record) => {
      const recordDate = getDateOnly(record.createdAt);
      return recordDate && recordDate >= startDate && recordDate <= endDate;
    });
  }, [records, reportDateKeys, reportRange]);

  const selectedReportSummary = useMemo(
    () => buildReportSummary(reportRecords, defectiveNoteOptionsForReport),
    [reportRecords, defectiveNoteOptionsForReport]
  );

  const reportOverviewRows = useMemo(() => {
    return REPORT_RANGE_OPTIONS.map((option) => {
      let rangeRecords = records;

      if (option.value !== "all") {
        const startDate =
          option.value === "today"
            ? reportDateKeys.todayKey
            : reportDateKeys.weekStartKey;
        const endDate =
          option.value === "today"
            ? reportDateKeys.todayKey
            : reportDateKeys.weekEndKey;

        rangeRecords = records.filter((record) => {
          const recordDate = getDateOnly(record.createdAt);
          return recordDate && recordDate >= startDate && recordDate <= endDate;
        });
      }

      const rangeSummary = buildReportSummary(
        rangeRecords,
        defectiveNoteOptionsForReport
      );

      return {
        ...option,
        total: rangeSummary.total,
        defective: rangeSummary.defective,
        defectRate: rangeSummary.defectRate,
      };
    });
  }, [records, reportDateKeys, defectiveNoteOptionsForReport]);

  const productFilterOptions = useMemo(() => {
    const productSet = new Set<string>();
    PRODUCT_TYPES.filter((item) => item !== "직접입력").forEach((item) =>
      productSet.add(item)
    );
    records.forEach((record) => {
      if (record.productName) productSet.add(record.productName);
    });
    return Array.from(productSet);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const recordDate = getDateOnly(record.createdAt);

      const matchesSearch =
        !searchTerm ||
        [
          record.invoiceNumber,
          record.orderNumber,
          record.customerName,
          record.returnType,
          record.productName,
          record.inspectionResult,
          record.processAction || "미선택",
          record.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStartDate =
        !searchStartDate || (recordDate && recordDate >= searchStartDate);

      const matchesEndDate =
        !searchEndDate || (recordDate && recordDate <= searchEndDate);

      const matchesProduct =
        filterProduct === "전체" || record.productName === filterProduct;

      const matchesResult =
        filterResult === "전체" ||
        record.inspectionResult === filterResult ||
        (filterResult === "정상확인" &&
          isNormalInspectionResult(record.inspectionResult)) ||
        (filterResult === "불량판정" &&
          isDefectiveInspectionResult(record.inspectionResult));

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate &&
        matchesProduct &&
        matchesResult
      );
    });
  }, [
    records,
    searchTerm,
    searchStartDate,
    searchEndDate,
    filterProduct,
    filterResult,
  ]);

  useEffect(() => {
    const visibleIds = new Set(filteredRecords.map((record) => record.id));
    setSelectedRecordIds((prev) =>
      prev.filter((recordId) => visibleIds.has(recordId))
    );
  }, [filteredRecords]);

  const isAllFilteredRecordsSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((record) => selectedRecordIds.includes(record.id));

  function toggleSelectAllFilteredRecords() {
    if (isAllFilteredRecordsSelected) {
      setSelectedRecordIds([]);
      return;
    }

    setSelectedRecordIds(filteredRecords.map((record) => record.id));
  }

  function toggleSelectRecord(recordId: string) {
    setSelectedRecordIds((prev) =>
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId]
    );
  }

  async function handleAddDefectiveNoteOption() {
    const inputValue = window.prompt(
      "비고 버튼에 추가할 불량 문구를 입력해주세요."
    );
    const nextOption = normalizeNoteOptionText(inputValue || "");

    if (!nextOption) return;

    const currentOptions = getNoteOptionsByInspectionResult(
      "불량판정",
      customDefectiveNoteOptions
    );

    if (currentOptions.includes(nextOption)) {
      setStatusMessage("");
      setStatusError("이미 등록된 비고 문구입니다.");
      return;
    }

    try {
      setSavingNoteOption(true);
      setStatusError("");

      const response = await fetch(CUSTOM_DEFECTIVE_NOTE_OPTIONS_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: nextOption }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "비고 문구 저장에 실패했습니다.");
      }

      const nextCustomOptions = getUniqueNoteOptions(
        Array.isArray(data.customDefectiveNoteOptions)
          ? data.customDefectiveNoteOptions.map((item: unknown) => String(item))
          : [...customDefectiveNoteOptions, nextOption]
      );

      setCustomDefectiveNoteOptions(nextCustomOptions);
      setStatusMessage(
        `비고 문구 '${nextOption}'가 서버에 추가되었습니다.`
      );
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        error instanceof Error ? error.message : "비고 문구 저장에 실패했습니다."
      );
    } finally {
      setSavingNoteOption(false);
    }
  }

  function resetForm() {
    setInvoiceNumber("");
    setOrderNumber("");
    setCustomerName("");
    setReturnType("일반반품");
    setProductName("휴대용분유포트");
    setCustomProductName("");
    setProcessAction("미선택");
    setInspectionResult("검사 대기");
    setNote("");
    setInvoicePhotos([]);
    setProductPhotos([]);
    setStatusMessage("");
    setStatusError("");
    setOcrMessage("");
    setOcrRawText("");
    setEditingRecordId(null);
    setEditingCreatedAt(null);
  }

  function normalizeProductName(value?: string, rawText?: string) {
    const text = `${value || ""} ${rawText || ""}`.replace(/\s+/g, "");

    if (text.includes("분리형")) {
      return "(분리형) 휴대용분유포트";
    }

    if (/젖병살균세척기|젖병세척기|살균세척기|스팀플러스|스팀PLUS/i.test(text)) {
      return "젖병살균세척기";
    }

    if (value && PRODUCT_TYPES.includes(value as ProductSelectValue)) {
      return value;
    }

    return value || "";
  }

  function detectReturnType(parsed: OcrParsedResult) {
    const text = `${parsed.returnType || ""} ${parsed.rawText || ""}`
      .replace(/\s+/g, "")
      .toUpperCase();

    if (text.includes("불량교환")) {
      return "불량교환" as ReturnType;
    }

    if (text.includes("불량반품")) {
      return "불량반품" as ReturnType;
    }

    if (text.includes("변심반품")) {
      return "변심반품" as ReturnType;
    }

    if (text.includes("일반반품")) {
      return "일반반품" as ReturnType;
    }

    if (/\bA\s*\/?\s*S\b|AS|에이에스|수리/.test(text)) {
      return "AS" as ReturnType;
    }

    if (text.includes("검수")) {
      return "검수" as ReturnType;
    }

    if (parsed.returnType && RETURN_TYPES.includes(parsed.returnType as ReturnType)) {
      return parsed.returnType as ReturnType;
    }

    return null;
  }

  function cleanOcrText(value?: string) {
    return (value || "")
      .replace(/\r/g, "\n")
      .replace(/[|｜]/g, " ")
      .replace(/[★☆]/g, " ★ ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactOcrText(value?: string) {
    return (value || "").replace(/\s+/g, "");
  }

  function isLikelyOrderNumberCandidate(candidate: string, context: string) {
    const cleanCandidate = candidate.replace(/\s+/g, "").replace(/[.,;:)]$/g, "");
    const onlyDigits = cleanCandidate.replace(/^C/i, "").replace(/-/g, "");

    if (!/^C?20\d{7,16}$/i.test(onlyDigits.startsWith("20") ? onlyDigits : cleanCandidate.replace(/-/g, ""))) {
      if (!/^C20\d{12,16}$/i.test(cleanCandidate.replace(/-/g, ""))) return false;
    }

    if (onlyDigits.length < 10 || onlyDigits.length > 17) return false;
    if (/^(050|010|011|016|017|018|019)/.test(onlyDigits)) return false;
    if (/^5737/.test(onlyDigits)) return false;
    if (/^20\d{6}(0\d|1\d|2[0-3])$/.test(onlyDigits)) return false;

    const badContext =
      /운송장번호|송장번호|예약번호|예악번호|접수일자|운임TYPE|운임TYPE|수량|발지|전화|고객센터|1588|1644/i;

    if (badContext.test(context) && !/일반반품|변심반품|불량반품|불량교환|링크맘|엄감|분리형|분유|포트|쉐이커/i.test(context)) {
      return false;
    }

    return true;
  }

  function extractOrderNumberFromRawText(rawText?: string) {
    const raw = cleanOcrText(rawText);
    if (!raw) return "";

    const candidates: { value: string; score: number }[] = [];
    const patterns = [
      /C\s*20\d[\d\s-]{8,18}/gi,
      /20\d{6}\s*-\s*\d{4,8}/g,
      /20\d[\d\s]{7,16}/g,
    ];

    patterns.forEach((pattern) => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(raw)) !== null) {
        const value = match[0].replace(/\s+/g, "").replace(/[.,;:)]$/g, "");
        const start = Math.max(0, match.index - 45);
        const end = Math.min(raw.length, match.index + match[0].length + 45);
        const context = raw.slice(start, end);
        const digits = value.replace(/^C/i, "").replace(/-/g, "");

        if (!isLikelyOrderNumberCandidate(value, context)) continue;

        let score = digits.length;
        if (/일반반품|변심반품|불량반품|불량교환|링크맘|엄감|상품|교환/i.test(context)) score += 80;
        if (/분리형|휴대용|분유포트|분유쉐이커|쉐이커|LED/i.test(context)) score += 40;
        if (/^C/i.test(value)) score += 25;
        if (/주문번호/i.test(context)) score += 20;
        if (/예약번호|접수일자|운송장번호|5737|0507|050-|1588|1644/i.test(context)) score -= 60;

        candidates.push({ value, score });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.value || "";
  }

  function isValidCustomerNameCandidate(name: string) {
    const blacklist = [
      "박승훈",
      "착지신용",
      "이지어드민",
      "주식회사",
      "꿈비",
      "한진택배",
      "회수상품",
      "운송장",
      "주문번호",
      "예약번호",
      "받는분",
      "보내는분",
      "안성시",
      "고삼면",
      "미록로",
      "봉산리",
      "링크맘",
      "엄감",
      "분리형",
      "휴대용",
      "분유포트",
      "쉐이커",
    ];

    if (!/^[가-힣]{2,4}$/.test(name)) return false;
    if (blacklist.some((word) => name.includes(word) || word.includes(name))) return false;
    return true;
  }

  function extractCustomerNameFromRawText(rawText?: string) {
    const raw = cleanOcrText(rawText);
    if (!raw) return "";

    const senderPatterns = [
      /(?:보내는분|보낸분|보내는\s*분|발송인|발신인|고객명)\s*[:：]?\s*([가-힣]{2,4})/g,
      /([가-힣]{2,4})\s*(?:050\d|010\d|050-\d|010-\d)/g,
    ];

    for (const pattern of senderPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(raw)) !== null) {
        const name = match[1];
        if (isValidCustomerNameCandidate(name)) return name;
      }
    }

    const candidates: { value: string; score: number }[] = [];
    const namePattern = /[가-힣]{2,4}/g;
    let match: RegExpExecArray | null;

    while ((match = namePattern.exec(raw)) !== null) {
      const value = match[0];
      if (!isValidCustomerNameCandidate(value)) continue;

      const start = Math.max(0, match.index - 35);
      const end = Math.min(raw.length, match.index + value.length + 35);
      const context = raw.slice(start, end);

      let score = 0;
      if (/보내는분|보낸분|발송인|발신인|고객명/i.test(context)) score += 100;
      if (/050\d|010\d|050-\d|010-\d/i.test(context)) score += 45;
      if (/불량교환|불량반품|변심반품|일반반품|분리형|휴대용|분유포트|쉐이커|LED/i.test(context)) score += 30;
      if (/받는분|안성시|고삼면|링크맘|엄감|주식회사|꿈비/i.test(context)) score -= 70;
      if (value === "박승훈") score -= 200;

      candidates.push({ value, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.score > 0 ? candidates[0].value : "";
  }

  function extractProductNameFromRawText(rawText?: string) {
    const compact = compactOcrText(rawText);

    if (/젖병살균세척기|젖병세척기|살균세척기|스팀플러스|스팀PLUS/i.test(compact)) {
      return "젖병살균세척기";
    }

    if (/분리형|분리|휴대용분유포트|휴대용분유|분유포트/.test(compact)) {
      if (/분리형|분리/.test(compact)) return "(분리형) 휴대용분유포트";
    }

    if (/LED|엘이디/i.test(rawText || "")) {
      return "LED분유쉐이커";
    }

    if (/쉐이커|세이커|분유쉐이커|분유세이커/.test(compact)) {
      return "분유쉐이커";
    }

    if (/휴대용|분유포트|보온포트|포트/.test(compact)) {
      return "휴대용분유포트";
    }

    return "";
  }

  function repairOcrParsedResult(parsed: OcrParsedResult) {
    const rawText = parsed.rawText || "";
    const orderNumber = parsed.orderNumber || extractOrderNumberFromRawText(rawText);
    const customerName = parsed.customerName || extractCustomerNameFromRawText(rawText);
    const productName = parsed.productName || extractProductNameFromRawText(rawText);

    return {
      ...parsed,
      orderNumber,
      customerName,
      productName,
    };
  }

  function applyOcrResult(parsed: OcrParsedResult) {
    const repairedParsed = repairOcrParsedResult(parsed);
    const detectedInvoiceNumber = repairedParsed.trackingNumber || repairedParsed.invoiceNumber;

    if (detectedInvoiceNumber) setInvoiceNumber(detectedInvoiceNumber);
    if (repairedParsed.orderNumber) setOrderNumber(repairedParsed.orderNumber);
    if (repairedParsed.customerName) setCustomerName(repairedParsed.customerName);

    const detectedReturnType = detectReturnType(repairedParsed);
    if (detectedReturnType) {
      setReturnType(detectedReturnType);
    }

    const normalizedProductName = normalizeProductName(
      repairedParsed.productName,
      repairedParsed.rawText
    );

    if (normalizedProductName) {
      if (PRODUCT_TYPES.includes(normalizedProductName as ProductSelectValue)) {
        setProductName(normalizedProductName as ProductSelectValue);
        setCustomProductName("");
      } else {
        setProductName("직접입력");
        setCustomProductName(normalizedProductName);
      }
    }

    setOcrRawText(repairedParsed.rawText || "");
  }

  async function runInvoiceOcr(file: File) {
    try {
      setOcrLoading(true);
      setOcrMessage("송장 자동분석 중입니다...");
      setStatusError("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-invoice", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "송장 자동분석에 실패했습니다.");
      }

      if (data?.parsed) {
        applyOcrResult(data.parsed as OcrParsedResult);
        setOcrMessage("송장 자동분석이 완료되었습니다.");
      } else {
        setOcrMessage("글자는 읽었지만 자동분석 결과가 없습니다.");
      }
    } catch (error) {
      setOcrMessage("");
      setStatusError(
        error instanceof Error
          ? error.message
          : "송장 자동분석 중 오류가 발생했습니다."
      );
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleInvoiceUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (invoicePhotos.length + files.length > MAX_INVOICE_PHOTOS) {
      setStatusError(`송장 사진은 최대 ${MAX_INVOICE_PHOTOS}장까지 등록할 수 있습니다.`);
      event.target.value = "";
      return;
    }

    const overSize = files.find((file) => file.size > MAX_FILE_MB * 1024 * 1024);
    if (overSize) {
      setStatusError(`업로드 전 원본 기준 ${MAX_FILE_MB}MB 이하 파일만 선택해주세요.`);
      event.target.value = "";
      return;
    }

    try {
      setUploadingInvoice(true);
      setStatusError("");
      setStatusMessage("송장 사진 업로드 중입니다...");

      const firstImage = files.find((file) => file.type.startsWith("image/"));
      if (firstImage) {
        await runInvoiceOcr(firstImage);
      }

      const uploaded = await Promise.all(
        files.map((file) => uploadSingleFile(file, "invoice"))
      );

      setInvoicePhotos((prev) => [...prev, ...uploaded]);
      setStatusMessage("송장 사진 업로드와 자동분석이 완료되었습니다.");
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "송장 사진 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setUploadingInvoice(false);
      event.target.value = "";
    }
  }

  async function handleProductUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (productPhotos.length + files.length > MAX_PRODUCT_PHOTOS) {
      setStatusError(`제품 사진은 최대 ${MAX_PRODUCT_PHOTOS}장까지 등록할 수 있습니다.`);
      event.target.value = "";
      return;
    }

    const overSize = files.find((file) => file.size > MAX_FILE_MB * 1024 * 1024);
    if (overSize) {
      setStatusError(`업로드 전 원본 기준 ${MAX_FILE_MB}MB 이하 파일만 선택해주세요.`);
      event.target.value = "";
      return;
    }

    try {
      setUploadingProduct(true);
      setStatusError("");
      setStatusMessage("제품 사진 업로드 중입니다...");

      const uploaded = await Promise.all(
        files.map((file) => uploadSingleFile(file, "product"))
      );

      setProductPhotos((prev) => [...prev, ...uploaded]);
      setStatusMessage("제품 사진 업로드가 완료되었습니다.");
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "제품 사진 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setUploadingProduct(false);
      event.target.value = "";
    }
  }

  async function handleRemoveUploadedPhoto(
    photo: UploadedPhoto,
    type: "invoice" | "product"
  ) {
    const confirmed = window.confirm("이 사진을 삭제하시겠습니까?");
    if (!confirmed) return;

    try {
      setStatusError("");
      setStatusMessage("사진 삭제 중입니다...");

      const response = await fetch("/api/delete-blob", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: [photo.url],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "사진 삭제에 실패했습니다.");
      }

      if (type === "invoice") {
        setInvoicePhotos((prev) => prev.filter((item) => item.url !== photo.url));
      } else {
        setProductPhotos((prev) => prev.filter((item) => item.url !== photo.url));
      }

      setStatusMessage("사진이 삭제되었습니다.");
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "사진 삭제 중 오류가 발생했습니다."
      );
    }
  }

  function handleEditRecord(record: ReturnRecord) {
    setEditingRecordId(record.id);
    setEditingCreatedAt(record.createdAt);

    setInvoiceNumber(record.invoiceNumber || "");
    setOrderNumber(record.orderNumber || "");
    setCustomerName(record.customerName || "");
    setReturnType(record.returnType);
    if (PRODUCT_TYPES.includes(record.productName as ProductSelectValue)) {
      setProductName(record.productName as ProductSelectValue);
      setCustomProductName("");
    } else {
      setProductName("직접입력");
      setCustomProductName(record.productName || "");
    }
    const normalizedResult = normalizeInspectionResult(record.inspectionResult);
    setProcessAction(
      getDefaultProcessActionByInspectionResult(
        normalizedResult,
        record.processAction || "미선택"
      )
    );
    setInspectionResult(normalizedResult);
    setNote(record.note || "");
    setInvoicePhotos(record.invoicePhotos || []);
    setProductPhotos(record.productPhotos || []);

    setStatusMessage("수정할 기록을 불러왔습니다. 내용 수정 후 수정 저장을 눌러주세요.");
    setStatusError("");
    setActivePanel("form");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function makeInlineEditDraft(record: ReturnRecord): InlineEditDraft {
    const isKnownProduct = PRODUCT_TYPES.includes(
      record.productName as ProductSelectValue
    );

    const normalizedResult = normalizeInspectionResult(record.inspectionResult);

    return {
      invoiceNumber: record.invoiceNumber || "",
      orderNumber: record.orderNumber || "",
      customerName: record.customerName || "",
      returnType: record.returnType,
      productName: isKnownProduct
        ? (record.productName as ProductSelectValue)
        : "직접입력",
      customProductName: isKnownProduct ? "" : record.productName || "",
      processAction: getDefaultProcessActionByInspectionResult(
        normalizedResult,
        record.processAction || "미선택"
      ),
      inspectionResult: normalizedResult,
      note: record.note || "",
    };
  }

  function handleInlineEditRecord(record: ReturnRecord) {
    setInlineEditingId(record.id);
    setInlineEditDraft(makeInlineEditDraft(record));
    setStatusMessage("선택한 기록을 바로 수정 중입니다.");
    setStatusError("");
  }

  function cancelInlineEdit() {
    setInlineEditingId(null);
    setInlineSavingId(null);
    setInlineEditDraft(null);
    setStatusMessage("수정을 취소했습니다.");
  }

  async function handleSaveInlineRecord(record: ReturnRecord) {
    if (!inlineEditDraft) return;

    if (
      !inlineEditDraft.invoiceNumber.trim() &&
      !inlineEditDraft.orderNumber.trim() &&
      !inlineEditDraft.customerName.trim()
    ) {
      setStatusError("송장번호 / 주문번호 / 고객명 중 최소 1개는 입력해주세요.");
      return;
    }

    const finalProductName =
      inlineEditDraft.productName === "직접입력"
        ? inlineEditDraft.customProductName.trim()
        : inlineEditDraft.productName;

    if (!finalProductName) {
      setStatusError("제품명을 입력하거나 선택해주세요.");
      return;
    }

    const updatedRecord: ReturnRecord = {
      ...record,
      invoiceNumber: inlineEditDraft.invoiceNumber.trim(),
      orderNumber: inlineEditDraft.orderNumber.trim(),
      customerName: inlineEditDraft.customerName.trim(),
      returnType: inlineEditDraft.returnType,
      productName: finalProductName,
      processAction: getDefaultProcessActionByInspectionResult(
        inlineEditDraft.inspectionResult,
        inlineEditDraft.processAction
      ),
      inspectionResult: normalizeInspectionResult(inlineEditDraft.inspectionResult),
      note: inlineEditDraft.note.trim(),
      invoicePhotos: record.invoicePhotos || [],
      productPhotos: record.productPhotos || [],
    };

    try {
      setInlineSavingId(record.id);
      setStatusError("");
      setStatusMessage("기록 수정 중입니다...");

      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedRecord),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "기록 수정에 실패했습니다.");
      }

      await fetchRecords();
      setInlineEditingId(null);
      setInlineSavingId(null);
      setInlineEditDraft(null);
      setStatusMessage("기록이 수정되었습니다.");
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "기록 수정 중 오류가 발생했습니다."
      );
    } finally {
      setInlineSavingId(null);
    }
  }

  function cancelEdit() {
    resetForm();
    setStatusMessage("수정을 취소했습니다.");
  }

  async function handleSaveRecord() {
    if (!invoicePhotos.length) {
      setStatusError("송장 사진은 최소 1장 이상 등록해주세요.");
      return;
    }

    if (!invoiceNumber.trim() && !orderNumber.trim() && !customerName.trim()) {
      setStatusError("송장번호 / 주문번호 / 고객명 중 최소 1개는 입력해주세요.");
      return;
    }

    const finalProductName =
      productName === "직접입력" ? customProductName.trim() : productName;

    if (!finalProductName) {
      setStatusError("제품명을 입력하거나 선택해주세요.");
      return;
    }

    const isEditing = Boolean(editingRecordId);

    const newRecord: ReturnRecord = {
      id: editingRecordId || crypto.randomUUID(),
      createdAt: editingCreatedAt || new Date().toISOString(),
      invoiceNumber: invoiceNumber.trim(),
      orderNumber: orderNumber.trim(),
      customerName: customerName.trim(),
      returnType,
      productName: finalProductName,
      processAction: getDefaultProcessActionByInspectionResult(
        inspectionResult,
        processAction
      ),
      inspectionResult: normalizeInspectionResult(inspectionResult),
      note: note.trim(),
      invoicePhotos,
      productPhotos,
    };

    try {
      setSavingRecord(true);
      setStatusError("");
      setStatusMessage("기록 저장 중입니다...");

      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRecord),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "기록 저장에 실패했습니다.");
      }

      await fetchRecords();
      resetForm();
      setStatusMessage(
        isEditing
          ? "기록이 수정되었습니다."
          : "기록이 서버에 저장되었습니다. PC와 휴대폰에서 동일하게 조회됩니다."
      );
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "기록 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSavingRecord(false);
    }
  }

  async function deleteRecordWithoutConfirm(record: ReturnRecord) {
    const response = await fetch("/api/records", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: record.id,
        photoUrls: [
          ...record.invoicePhotos.map((photo) => photo.url),
          ...record.productPhotos.map((photo) => photo.url),
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "기록 삭제에 실패했습니다.");
    }
  }

  async function handleDeleteRecord(record: ReturnRecord) {
    const confirmed = window.confirm(
      "삭제하시겠습니까?\n기록과 연결된 사진도 함께 삭제됩니다."
    );
    if (!confirmed) return;

    try {
      setDeletingId(record.id);
      setStatusError("");
      setStatusMessage("기록과 사진을 함께 삭제 중입니다...");

      await deleteRecordWithoutConfirm(record);
      await fetchRecords();
      setSelectedRecordIds((prev) => prev.filter((id) => id !== record.id));
      setStatusMessage("기록과 연결 사진이 함께 삭제되었습니다.");
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteSelectedRecords() {
    if (selectedRecordIds.length === 0) {
      setStatusError("삭제할 기록을 선택해주세요.");
      setStatusMessage("");
      return;
    }

    const selectedRecords = filteredRecords.filter((record) =>
      selectedRecordIds.includes(record.id)
    );

    const confirmed = window.confirm(
      `선택한 기록 ${selectedRecords.length}개를 삭제하시겠습니까?\n기록과 연결된 사진도 함께 삭제됩니다.`
    );
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      setStatusError("");
      setStatusMessage("선택한 기록과 사진을 함께 삭제 중입니다...");

      for (const record of selectedRecords) {
        await deleteRecordWithoutConfirm(record);
      }

      await fetchRecords();
      setSelectedRecordIds([]);
      setStatusMessage(`선택한 기록 ${selectedRecords.length}개가 삭제되었습니다.`);
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "선택 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setBulkDeleting(false);
    }
  }


  function handleDownloadExcel() {
    if (filteredRecords.length === 0) {
      setStatusError("내려받을 기록이 없습니다.");
      setStatusMessage("");
      return;
    }

    setStatusError("");
    setStatusMessage("엑셀 파일을 내려받는 중입니다.");

    const today = new Date();
    const filename = `반품검사기록_${today.getFullYear()}${String(
      today.getMonth() + 1
    ).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.xlsx`;

    downloadExcel(filename, filteredRecords);
  }


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                반품 검사/수리 기록 프로그램
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                대상: 모든 가전류 / 일반반품 · 변심반품 · 불량반품 · 불량교환 · AS · 검수
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                기록은 서버에 저장되므로 PC와 휴대폰에서 동일하게 조회됩니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={fetchRecords} disabled={loadingRecords}>
                {loadingRecords ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                새로고침
              </Button>

              <Button variant="outline" onClick={handleDownloadExcel}>
                <Download className="mr-2 h-4 w-4" />
                엑셀 내려받기
              </Button>
            </div>
          </div>

          {(statusMessage || statusError) && (
            <div className="mt-4 space-y-2">
              {statusMessage && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  {statusMessage}
                </div>
              )}
              {statusError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {statusError}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-5 p-4">
                <div className="rounded-3xl bg-slate-950 p-5 text-white">
                  <h2 className="mt-2 text-xl font-bold">업무 대시보드</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    등록부터 보고까지 필요한 화면만 빠르게 선택합니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    빠른 업무
                  </p>
                  <button
                    type="button"
                    onClick={() => setActivePanel("form")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "form"
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">등록하기</span>
                      <span className={`block text-xs ${activePanel === "form" ? "text-emerald-100" : "text-slate-500"}`}>
                        송장 촬영 · 검수 입력
                      </span>
                    </span>
                    <Camera className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePanel("records")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "records"
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">기록보기</span>
                      <span className={`block text-xs ${activePanel === "records" ? "text-blue-100" : "text-slate-500"}`}>
                        조회 · 수정 · 삭제 · 엑셀
                      </span>
                    </span>
                    <Search className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    AS 검수 현황판
                  </p>
                  {REPORT_RANGE_OPTIONS.map((option) => {
                    const isActive = activePanel === "dashboard" && reportRange === option.value;
                    return (
                      <button
                        key={`sidebar-${option.value}`}
                        type="button"
                        onClick={() => {
                          setActivePanel("dashboard");
                          setReportRange(option.value);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className={`block text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                            {option.description}
                          </span>
                        </span>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                          isActive ? "bg-white text-slate-950" : "bg-white text-slate-500"
                        }`}>
                          {reportOverviewRows.find((row) => row.value === option.value)?.total || 0}건
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    분석 리포트
                  </p>
                  <button
                    type="button"
                    onClick={() => setActivePanel("modelReport")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "modelReport"
                        ? "border-rose-600 bg-rose-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-rose-50"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">모델별 불량 리포트</span>
                      <span className={`block text-xs ${activePanel === "modelReport" ? "text-rose-100" : "text-slate-500"}`}>
                        제품별 불량 사유 분석
                      </span>
                    </span>
                    <Smartphone className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </aside>
          <main className="min-w-0 space-y-6">

            {activePanel === "dashboard" && (
            <div className="space-y-5">
          <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-slate-950 text-white shadow-sm">
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6 p-6 md:p-8">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">
                        AS 검수 현황판
                      </p>
                      <h2 className="mt-2 text-3xl font-bold tracking-tight">
                        {REPORT_RANGE_OPTIONS.find((item) => item.value === reportRange)?.label} 리포트
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        {getReportPeriodLabel(reportRange, reportDateKeys)} 기준 데이터입니다.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {REPORT_RANGE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setReportRange(option.value)}
                          className={`rounded-2xl border px-4 py-2 text-left transition ${
                            reportRange === option.value
                              ? "border-white bg-white text-slate-950"
                              : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className="block text-xs opacity-70">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-3xl border border-slate-800 bg-white/5 p-4">
                      <p className="text-xs font-semibold text-slate-400">등록 건수</p>
                      <p className="mt-2 text-3xl font-bold">{selectedReportSummary.total}</p>
                      <p className="mt-1 text-xs text-slate-500">선택 기간 전체</p>
                    </div>
                    <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <p className="text-xs font-semibold text-emerald-200">정상확인</p>
                      <p className="mt-2 text-3xl font-bold">{selectedReportSummary.normal}</p>
                      <p className="mt-1 text-xs text-emerald-100/70">
                        정상 비율 {selectedReportSummary.normalRate}%
                      </p>
                    </div>
                    <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4">
                      <p className="text-xs font-semibold text-rose-200">불량판정</p>
                      <p className="mt-2 text-3xl font-bold">{selectedReportSummary.defective}</p>
                      <p className="mt-1 text-xs text-rose-100/70">
                        불량률 {selectedReportSummary.defectRate}%
                      </p>
                    </div>
                    <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
                      <p className="text-xs font-semibold text-amber-100">후속 확인</p>
                      <p className="mt-2 text-3xl font-bold">{selectedReportSummary.followUp}</p>
                      <p className="mt-1 text-xs text-amber-100/70">추가 점검 대상</p>
                    </div>
                    <div className="rounded-3xl border border-sky-300/20 bg-sky-300/10 p-4">
                      <p className="text-xs font-semibold text-sky-100">검사 대기</p>
                      <p className="mt-2 text-3xl font-bold">{selectedReportSummary.pending}</p>
                      <p className="mt-1 text-xs text-sky-100/70">미완료 건수</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 bg-slate-900/70 p-6 md:p-8 lg:border-l lg:border-t-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">기간별 요약</p>
                      <p className="mt-1 text-xs text-slate-500">
                        오늘 · 이번주 · 전체 흐름을 한 번에 확인합니다.
                      </p>
                    </div>
                    <ClipboardList className="h-8 w-8 text-slate-600" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {reportOverviewRows.map((row) => (
                      <button
                        key={row.value}
                        type="button"
                        onClick={() => setReportRange(row.value)}
                        className={`w-full rounded-3xl border p-4 text-left transition ${
                          reportRange === row.value
                            ? "border-white bg-white text-slate-950"
                            : "border-slate-800 bg-slate-950/40 text-slate-200 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{row.label}</p>
                            <p className="mt-1 text-xs opacity-70">
                              총 {row.total}건 · 불량 {row.defective}건
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{row.defectRate}%</p>
                            <p className="text-xs opacity-70">불량률</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-400">사진 사용량</p>
                        <p className="mt-1 text-xl font-bold">
                          {formatBytes(summary.totalPhotoSize)}
                        </p>
                      </div>
                      <Database className="h-7 w-7 text-slate-600" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="rounded-[2rem] shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CheckCircle2 className="h-5 w-5 text-slate-500" />
                  검사결과 비율
                </CardTitle>
                <p className="text-sm text-slate-500">
                  선택 기간의 정상/불량/후속/대기 현황입니다.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedReportSummary.resultRows.map((row) => (
                  <div key={row.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">{row.label}</span>
                      <span className="text-slate-500">
                        {row.count}건 · {row.percent}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-800 transition-all"
                        style={{ width: `${Math.max(row.percent, row.count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <AlertTriangle className="h-5 w-5 text-slate-500" />
                  모델별 불량 TOP
                </CardTitle>
                <p className="text-sm text-slate-500">
                  선택 기간의 불량판정 기록을 제품명 기준으로 집계합니다.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedReportSummary.modelDefectRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    선택 기간에 집계할 모델별 불량 데이터가 없습니다.
                  </div>
                ) : (
                  selectedReportSummary.modelDefectRows.slice(0, 6).map((row) => {
                    const modelPercent = calculatePercent(
                      row.count,
                      selectedReportSummary.defective || row.count
                    );

                    return (
                      <div key={row.productName} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-semibold text-slate-700">
                            {row.productName}
                          </span>
                          <span className="shrink-0 text-slate-500">{row.count}건</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-sky-600 transition-all"
                            style={{ width: `${Math.max(modelPercent, row.count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <p className="truncate text-xs text-slate-400">
                          {row.reasons.length > 0
                            ? row.reasons
                                .slice(0, 3)
                                .map((reason) => `${reason.label} ${reason.count}건`)
                                .join(" · ")
                            : "사유 미입력"}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

        </div>


            )}

            {activePanel === "modelReport" && (
            <div className="space-y-5">
              <Card className="rounded-[2rem] border-rose-100 bg-gradient-to-br from-white to-rose-50 shadow-sm">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-rose-600">분석 리포트</p>
                    <CardTitle className="mt-1 text-2xl">모델별 불량 리포트</CardTitle>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      제품별 불량 건수와 비고 키워드 기반 사유를 기간별로 확인합니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REPORT_RANGE_OPTIONS.map((option) => (
                      <button
                        key={`model-range-${option.value}`}
                        type="button"
                        onClick={() => setReportRange(option.value)}
                        className={`rounded-2xl border px-4 py-2 text-left transition ${
                          reportRange === option.value
                            ? "border-rose-600 bg-rose-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-rose-50"
                        }`}
                      >
                        <span className="block text-sm font-bold">{option.label}</span>
                        <span className="block text-xs opacity-70">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border bg-white p-4">
                      <p className="text-xs font-semibold text-slate-500">선택 기간</p>
                      <p className="mt-2 text-lg font-bold text-slate-900">
                        {REPORT_RANGE_OPTIONS.find((item) => item.value === reportRange)?.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{getReportPeriodLabel(reportRange, reportDateKeys)}</p>
                    </div>
                    <div className="rounded-3xl border border-rose-100 bg-white p-4">
                      <p className="text-xs font-semibold text-rose-600">불량판정</p>
                      <p className="mt-2 text-3xl font-bold text-rose-600">{selectedReportSummary.defective}</p>
                      <p className="mt-1 text-xs text-slate-500">전체 {selectedReportSummary.total}건 중</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white">
                      <p className="text-xs font-semibold text-slate-300">불량률</p>
                      <p className="mt-2 text-3xl font-bold">{selectedReportSummary.defectRate}%</p>
                      <p className="mt-1 text-xs text-slate-400">보고 핵심 지표</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Smartphone className="h-5 w-5 text-slate-500" />
                모델별 불량 리포트
              </CardTitle>
              <p className="text-sm text-slate-500">
                선택 기간의 불량판정 건을 제품명과 비고 키워드로 정리합니다.
              </p>
            </CardHeader>
            <CardContent>
              {selectedReportSummary.modelDefectRows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  선택 기간에 모델별 불량 데이터가 없습니다.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {selectedReportSummary.modelDefectRows.map((row) => (
                    <div
                      key={row.productName}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{row.productName}</p>
                          <p className="mt-1 text-sm text-slate-500">불량 {row.count}건</p>
                        </div>
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                          {row.count}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {row.reasons.slice(0, 6).map((reason) => (
                          <span
                            key={`${row.productName}-${reason.label}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                          >
                            {reason.label} {reason.count}건
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

            </div>

            )}

            {activePanel === "form" && (
            <div className="grid gap-6">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">
                {editingRecordId ? "기록 수정" : "새 기록 등록"}
              </CardTitle>
              <p className="text-sm text-slate-500">
                {editingRecordId
                  ? "기존 기록을 수정 중입니다. 변경 후 수정 저장을 눌러주세요."
                  : "사진은 업로드 전 자동 압축되어 저장공간 사용량을 줄입니다."}
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>송장번호</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="예: 5737-0812-3995"
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>주문번호</Label>
                  <Input
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="예: 20260421-0001"
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>고객명</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="rounded-2xl pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>반품유형</Label>
                  <Select
                    value={returnType}
                    onValueChange={(value) => setReturnType(value as ReturnType)}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_TYPES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>제품명</Label>
                  <Select
                    value={productName}
                    onValueChange={(value) => {
                      setProductName(value as ProductSelectValue);
                      if (value !== "직접입력") {
                        setCustomProductName("");
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {productName === "직접입력" && (
                    <Input
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                      placeholder="제품명을 직접 입력해주세요"
                      className="rounded-2xl"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>검사결과</Label>
                  <Select
                    value={inspectionResult}
                    onValueChange={(value) => {
                      const nextInspectionResult = value as InspectionResult;
                      setInspectionResult(nextInspectionResult);
                      setProcessAction((prev) =>
                        getDefaultProcessActionByInspectionResult(
                          nextInspectionResult,
                          prev
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESULT_TYPES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>이동/처리</Label>
                  <Select
                    value={processAction}
                    onValueChange={(value) => setProcessAction(value as ProcessAction)}
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getProcessActionsByInspectionResult(inspectionResult).map(
                        (item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>비고</Label>
                {getNoteOptionsByInspectionResult(
                  inspectionResult,
                  customDefectiveNoteOptions
                ).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {getNoteOptionsByInspectionResult(
                      inspectionResult,
                      customDefectiveNoteOptions
                    ).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setNote((prev) => appendNoteOption(prev, item))}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        {item}
                      </button>
                    ))}

                    {isDefectiveInspectionResult(inspectionResult) && (
                      <button
                        type="button"
                        onClick={handleAddDefectiveNoteOption}
                        disabled={savingNoteOption || loadingNoteOptions}
                        className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="비고 불량 문구 서버 추가"
                      >
                        {savingNoteOption ? "저장중" : "+"}
                      </button>
                    )}
                  </div>
                )}
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="선택 문구를 누른 뒤 추가 내용을 직접 입력할 수 있습니다."
                  className="min-h-[120px] rounded-2xl"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-3xl border-dashed shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">송장 사진</p>
                        <p className="text-sm text-slate-500">
                          최대 {MAX_INVOICE_PHOTOS}장 / 필수 / 자동 압축 업로드
                        </p>
                      </div>

<div className="flex flex-wrap gap-2">
  <input
    id="invoice-camera-input"
    type="file"
    accept="image/*"
    capture="environment"
    className="hidden"
    onChange={handleInvoiceUpload}
    disabled={uploadingInvoice}
  />

  <input
    id="invoice-gallery-input"
    type="file"
    accept="image/*"
    multiple
    className="hidden"
    onChange={handleInvoiceUpload}
    disabled={uploadingInvoice}
  />

  <Button
    type="button"
    variant="outline"
    className="rounded-2xl"
    onClick={() => document.getElementById("invoice-camera-input")?.click()}
    disabled={uploadingInvoice}
  >
    {uploadingInvoice ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Camera className="mr-2 h-4 w-4" />
    )}
    카메라 촬영
  </Button>

  <Button
    type="button"
    variant="outline"
    className="rounded-2xl"
    onClick={() => document.getElementById("invoice-gallery-input")?.click()}
    disabled={uploadingInvoice}
  >
    <Upload className="mr-2 h-4 w-4" />
    사진첩 선택
  </Button>
</div>
</div>

                    {ocrLoading && (
                      <div className="mb-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          송장 사진을 읽어서 송장번호 / 주문번호 / 고객명 / 반품유형 / 제품명을 자동분석 중입니다.
                        </div>
                      </div>
                    )}

                    {!ocrLoading && ocrMessage && (
                      <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {ocrMessage}
                      </div>
                    )}

                    {ocrRawText && (
                      <details className="mb-3 rounded-2xl border bg-slate-50 px-4 py-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700">
                          OCR이 읽은 원문 보기
                        </summary>
                        <p className="mt-3 whitespace-pre-wrap break-all text-xs leading-6 text-slate-500">
                          {ocrRawText}
                        </p>
                      </details>
                    )}

                    <div className="space-y-3">
                      {invoicePhotos.length === 0 && (
                        <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                          등록된 사진이 없습니다.
                        </div>
                      )}

                      {invoicePhotos.map((photo) => (
                        <div
                          key={photo.url}
                          className="overflow-hidden rounded-2xl border bg-white"
                        >
                          <img
                            src={photo.url}
                            alt={photo.filename}
                            className="h-40 w-full object-cover"
                          />
                          <div className="flex items-center justify-between gap-2 p-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{photo.filename}</p>
                              <p className="text-slate-500">{formatBytes(photo.size)}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() =>
                                handleRemoveUploadedPhoto(photo, "invoice")
                              }
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              삭제
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-dashed shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">제품 사진</p>
                        <p className="text-sm text-slate-500">
                          최대 {MAX_PRODUCT_PHOTOS}장 / 선택 / 외관·불량 상태 기록
                        </p>
                      </div>

<div className="flex flex-wrap gap-2">
  <input
    id="product-camera-input"
    type="file"
    accept="image/*"
    capture="environment"
    className="hidden"
    onChange={handleProductUpload}
    disabled={uploadingProduct}
  />

  <input
    id="product-gallery-input"
    type="file"
    accept="image/*"
    multiple
    className="hidden"
    onChange={handleProductUpload}
    disabled={uploadingProduct}
  />

  <Button
    type="button"
    variant="outline"
    className="rounded-2xl"
    onClick={() => document.getElementById("product-camera-input")?.click()}
    disabled={uploadingProduct}
  >
    {uploadingProduct ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Camera className="mr-2 h-4 w-4" />
    )}
    카메라 촬영
  </Button>

  <Button
    type="button"
    variant="outline"
    className="rounded-2xl"
    onClick={() => document.getElementById("product-gallery-input")?.click()}
    disabled={uploadingProduct}
  >
    <Upload className="mr-2 h-4 w-4" />
    사진첩 선택
  </Button>
</div>
</div>

                    <div className="space-y-3">
                      {productPhotos.length === 0 && (
                        <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                          등록된 사진이 없습니다.
                        </div>
                      )}

                      {productPhotos.map((photo) => (
                        <div
                          key={photo.url}
                          className="overflow-hidden rounded-2xl border bg-white"
                        >
                          <img
                            src={photo.url}
                            alt={photo.filename}
                            className="h-40 w-full object-cover"
                          />
                          <div className="flex items-center justify-between gap-2 p-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{photo.filename}</p>
                              <p className="text-slate-500">{formatBytes(photo.size)}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() =>
                                handleRemoveUploadedPhoto(photo, "product")
                              }
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              삭제
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleSaveRecord}
                  disabled={savingRecord}
                  className="rounded-2xl"
                >
                  {savingRecord ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardList className="mr-2 h-4 w-4" />
                  )}
                  {editingRecordId ? "수정 저장" : "기록 저장"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="rounded-2xl"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  입력 초기화
                </Button>

                {editingRecordId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEdit}
                    className="rounded-2xl"
                  >
                    수정 취소
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

        </div>


            )}

            {activePanel === "records" && (
            <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white/95 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600">기록 관리</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    기록보기
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    날짜·제품·결과별로 조회하고, 필요한 기록을 바로 수정하거나 엑셀로 내려받습니다.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                    조회 결과 {filteredRecords.length}건
                  </span>
                  <Button variant="outline" onClick={handleDownloadExcel} className="rounded-2xl">
                    <Download className="mr-2 h-4 w-4" />
                    엑셀
                  </Button>
                </div>
              </div>

              <CardContent className="space-y-5 pt-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="grid gap-3 md:grid-cols-[0.9fr_0.9fr_1.5fr_0.8fr_0.8fr_auto]">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">조회 시작일</Label>
                  <Input
                    type="date"
                    value={searchStartDate}
                    onChange={(e) => setSearchStartDate(e.target.value)}
                    className="rounded-2xl bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">조회 종료일</Label>
                  <Input
                    type="date"
                    value={searchEndDate}
                    onChange={(e) => setSearchEndDate(e.target.value)}
                    className="rounded-2xl bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">통합 검색</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="송장번호, 주문번호, 고객명, 제품명, 비고 검색"
                      className="rounded-2xl bg-white pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">제품</Label>
                  <Select value={filterProduct} onValueChange={setFilterProduct}>
                    <SelectTrigger className="rounded-2xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="전체">전체 제품</SelectItem>
                      {productFilterOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500">결과</Label>
                  <Select value={filterResult} onValueChange={setFilterResult}>
                    <SelectTrigger className="rounded-2xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="전체">전체 결과</SelectItem>
                      {RESULT_TYPES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl bg-white"
                    onClick={() => {
                      setSearchStartDate("");
                      setSearchEndDate("");
                      setSearchTerm("");
                      setFilterProduct("전체");
                      setFilterResult("전체");
                      setSelectedRecordIds([]);
                    }}
                  >
                    전체
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl bg-white"
                    onClick={fetchRecords}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    새로고침
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAllFilteredRecordsSelected}
                    onChange={toggleSelectAllFilteredRecords}
                    disabled={filteredRecords.length === 0 || bulkDeleting}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  조회 결과 전체선택
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-slate-500">
                    조회 {filteredRecords.length}건 / 선택 {selectedRecordIds.length}건
                  </span>

                  <Button
                    type="button"
                    variant="destructive"
                    className="rounded-2xl"
                    onClick={handleDeleteSelectedRecords}
                    disabled={selectedRecordIds.length === 0 || bulkDeleting}
                  >
                    {bulkDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        삭제 중...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        선택삭제
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {loadingRecords ? (
              <div className="flex items-center justify-center rounded-3xl border border-dashed p-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                기록 불러오는 중...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-10 text-center text-slate-500">
                아직 등록된 기록이 없어요.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredRecords.map((record) => {
                  const isInlineEditing =
                    inlineEditingId === record.id && inlineEditDraft;

                  return (
                    <Card key={record.id} className="rounded-3xl border shadow-none">
                      <CardContent className="p-5">
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedRecordIds.includes(record.id)}
                                onChange={() => toggleSelectRecord(record.id)}
                                disabled={bulkDeleting}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              선택
                            </label>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                {isInlineEditing
                                  ? inlineEditDraft.productName === "직접입력"
                                    ? inlineEditDraft.customProductName || "직접입력"
                                    : inlineEditDraft.productName
                                  : record.productName}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                {isInlineEditing
                                  ? inlineEditDraft.returnType
                                  : record.returnType}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                {isInlineEditing
                                  ? inlineEditDraft.inspectionResult
                                  : record.inspectionResult}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                {isInlineEditing
                                  ? inlineEditDraft.processAction
                                  : record.processAction || "미선택"}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-slate-500">
                              등록일자: {formatDateTime(record.createdAt)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {isInlineEditing ? (
                              <>
                                <Button
                                  type="button"
                                  className="rounded-2xl"
                                  onClick={() => handleSaveInlineRecord(record)}
                                  disabled={inlineSavingId === record.id || bulkDeleting}
                                >
                                  {inlineSavingId === record.id ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      저장 중...
                                    </>
                                  ) : (
                                    "수정 저장"
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-2xl"
                                  onClick={cancelInlineEdit}
                                  disabled={inlineSavingId === record.id}
                                >
                                  취소
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-2xl"
                                onClick={() => handleInlineEditRecord(record)}
                              >
                                수정
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="destructive"
                              className="rounded-2xl"
                              onClick={() => handleDeleteRecord(record)}
                              disabled={
                                deletingId === record.id ||
                                inlineSavingId === record.id ||
                                bulkDeleting
                              }
                            >
                              {deletingId === record.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  삭제 중...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  삭제
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {isInlineEditing ? (
                          <div className="space-y-4 rounded-3xl border bg-slate-50 p-4">
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label>송장번호</Label>
                                <Input
                                  value={inlineEditDraft.invoiceNumber}
                                  onChange={(e) =>
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? { ...prev, invoiceNumber: e.target.value }
                                        : prev
                                    )
                                  }
                                  className="rounded-2xl bg-white"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>주문번호</Label>
                                <Input
                                  value={inlineEditDraft.orderNumber}
                                  onChange={(e) =>
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? { ...prev, orderNumber: e.target.value }
                                        : prev
                                    )
                                  }
                                  className="rounded-2xl bg-white"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>고객명</Label>
                                <Input
                                  value={inlineEditDraft.customerName}
                                  onChange={(e) =>
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? { ...prev, customerName: e.target.value }
                                        : prev
                                    )
                                  }
                                  className="rounded-2xl bg-white"
                                />
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <div className="space-y-2">
                                <Label>반품유형</Label>
                                <Select
                                  value={inlineEditDraft.returnType}
                                  onValueChange={(value) =>
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? { ...prev, returnType: value as ReturnType }
                                        : prev
                                    )
                                  }
                                >
                                  <SelectTrigger className="rounded-2xl bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {RETURN_TYPES.map((item) => (
                                      <SelectItem key={item} value={item}>
                                        {item}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>제품명</Label>
                                <Select
                                  value={inlineEditDraft.productName}
                                  onValueChange={(value) =>
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            productName: value as ProductSelectValue,
                                            customProductName:
                                              value === "직접입력"
                                                ? prev.customProductName
                                                : "",
                                          }
                                        : prev
                                    )
                                  }
                                >
                                  <SelectTrigger className="rounded-2xl bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRODUCT_TYPES.map((item) => (
                                      <SelectItem key={item} value={item}>
                                        {item}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {inlineEditDraft.productName === "직접입력" && (
                                  <Input
                                    value={inlineEditDraft.customProductName}
                                    onChange={(e) =>
                                      setInlineEditDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              customProductName: e.target.value,
                                            }
                                          : prev
                                      )
                                    }
                                    placeholder="제품명을 직접 입력해주세요"
                                    className="rounded-2xl bg-white"
                                  />
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label>검사결과</Label>
                                <Select
                                  value={inlineEditDraft.inspectionResult}
                                  onValueChange={(value) => {
                                    const nextInspectionResult =
                                      value as InspectionResult;
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            inspectionResult:
                                              nextInspectionResult,
                                            processAction:
                                              getDefaultProcessActionByInspectionResult(
                                                nextInspectionResult,
                                                prev.processAction
                                              ),
                                          }
                                        : prev
                                    );
                                  }}
                                >
                                  <SelectTrigger className="rounded-2xl bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {RESULT_TYPES.map((item) => (
                                      <SelectItem key={item} value={item}>
                                        {item}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>이동/처리</Label>
                                <Select
                                  value={inlineEditDraft.processAction}
                                  onValueChange={(value) =>
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            processAction: value as ProcessAction,
                                          }
                                        : prev
                                    )
                                  }
                                >
                                  <SelectTrigger className="rounded-2xl bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getProcessActionsByInspectionResult(
                                      inlineEditDraft.inspectionResult
                                    ).map((item) => (
                                      <SelectItem key={item} value={item}>
                                        {item}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>비고</Label>
                              {getNoteOptionsByInspectionResult(
                                inlineEditDraft.inspectionResult,
                                customDefectiveNoteOptions
                              ).length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {getNoteOptionsByInspectionResult(
                                    inlineEditDraft.inspectionResult,
                                    customDefectiveNoteOptions
                                  ).map((item) => (
                                    <button
                                      key={item}
                                      type="button"
                                      onClick={() =>
                                        setInlineEditDraft((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                note: appendNoteOption(
                                                  prev.note,
                                                  item
                                                ),
                                              }
                                            : prev
                                        )
                                      }
                                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50"
                                    >
                                      {item}
                                    </button>
                                  ))}

                                  {isDefectiveInspectionResult(
                                    inlineEditDraft.inspectionResult
                                  ) && (
                                    <button
                                      type="button"
                                      onClick={handleAddDefectiveNoteOption}
                                      disabled={savingNoteOption || loadingNoteOptions}
                                      className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      title="비고 불량 문구 서버 추가"
                                    >
                                      {savingNoteOption ? "저장중" : "+"}
                                    </button>
                                  )}
                                </div>
                              )}
                              <Textarea
                                value={inlineEditDraft.note}
                                onChange={(e) =>
                                  setInlineEditDraft((prev) =>
                                    prev ? { ...prev, note: e.target.value } : prev
                                  )
                                }
                                className="min-h-[100px] rounded-2xl bg-white"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">송장번호</p>
                                <p className="mt-1 font-medium">
                                  {record.invoiceNumber || "-"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">주문번호</p>
                                <p className="mt-1 font-medium">
                                  {record.orderNumber || "-"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">고객명</p>
                                <p className="mt-1 font-medium">
                                  {record.customerName || "-"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">이동/처리</p>
                                <p className="mt-1 font-medium">
                                  {record.processAction || "미선택"}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">사진 수</p>
                                <p className="mt-1 font-medium">
                                  송장 {record.invoicePhotos.length}장 / 제품{" "}
                                  {record.productPhotos.length}장
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs text-slate-500">비고</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {record.note || "-"}
                              </p>
                            </div>
                          </>
                        )}

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <p className="mb-2 font-medium">송장 사진</p>
                            {record.invoicePhotos.length === 0 ? (
                              <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                                등록된 사진이 없습니다.
                              </div>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {record.invoicePhotos.map((photo) => (
                                  <a
                                    key={photo.url}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="overflow-hidden rounded-2xl border bg-white"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={photo.filename}
                                      className="h-40 w-full object-cover"
                                    />
                                    <div className="p-3 text-sm">
                                      <p className="truncate font-medium">
                                        {photo.filename}
                                      </p>
                                      <p className="text-slate-500">
                                        {formatBytes(photo.size)}
                                      </p>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="mb-2 font-medium">제품 사진</p>
                            {record.productPhotos.length === 0 ? (
                              <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                                등록된 사진이 없습니다.
                              </div>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {record.productPhotos.map((photo) => (
                                  <a
                                    key={photo.url}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="overflow-hidden rounded-2xl border bg-white"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={photo.filename}
                                      className="h-40 w-full object-cover"
                                    />
                                    <div className="p-3 text-sm">
                                      <p className="truncate font-medium">
                                        {photo.filename}
                                      </p>
                                      <p className="text-slate-500">
                                        {formatBytes(photo.size)}
                                      </p>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
              </CardContent>
            </Card>

            )}
          </main>
        </div>
      </div>
    </div>
  );
}
