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
  Bell,
  Sparkles,
  PackageCheck,
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

type ProductSelectValue = string;

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

type ReportRange = "all" | "month" | "week" | "today";
type ExcelDownloadRange = "today" | "week" | "all";
type ActivePanel = "dashboard" | "normalizationReport" | "modelReport" | "records" | "form";

type ReportDateKeys = {
  todayKey: string;
  monthStartKey: string;
  monthEndKey: string;
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

type TrendPoint = {
  dateKey: string;
  label: string;
  total: number;
  normal: number;
  defective: number;
};

type WeeklyTrendPoint = {
  weekKey: string;
  startKey: string;
  endKey: string;
  label: string;
  total: number;
  normal: number;
  defective: number;
};

type ComboChartRow = {
  id: string;
  label: string;
  total: number;
  normal: number;
  defective: number;
};

type ModelTrendChartRow = {
  id: string;
  label: string;
  values: Record<string, number>;
};

type ModelInspectionRow = {
  productName: string;
  total: number;
  normal: number;
  defective: number;
  followUp: number;
  pending: number;
  normalRate: number;
  defectRate: number;
  reasons: DefectReasonRow[];
  trendRows: TrendPoint[];
  weeklyTrendRows: WeeklyTrendPoint[];
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
  "자체폐기",
  "자체 B급활용",
  "안성물류폐기이동",
];

function getProcessActionDisplayName(value?: ProcessAction | string) {
  if (!value) return "미선택";
  if (value === "자체 B급활용") return "원자재화";
  if (value === "안성물류폐기이동") return "안성폐기";
  return value;
}

function normalizeProcessActionValue(value?: ProcessAction | string): ProcessAction {
  if (!value) return "미선택";
  if (value === "원자재화") return "자체 B급활용";
  if (value === "안성폐기") return "안성물류폐기이동";
  if (PROCESS_ACTIONS.includes(value as ProcessAction)) {
    return value as ProcessAction;
  }
  return "미선택";
}

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
const PRODUCT_OPTIONS_API_PATH = "/api/product-options";
const LEGACY_CUSTOM_DEFECTIVE_NOTE_OPTIONS_STORAGE_KEY =
  "return-record-custom-defective-note-options";
const LEGACY_CUSTOM_PRODUCT_OPTIONS_STORAGE_KEY =
  "return-record-custom-product-options";

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

function normalizeProductOptionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getUniqueProductOptions(options: string[]) {
  const optionSet = new Set<string>();

  options.forEach((option) => {
    const normalized = normalizeProductOptionText(option);

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
  { value: "all", label: "전체기록", description: "누적 데이터" },
  { value: "month", label: "이번달", description: "1일~오늘" },
  { value: "week", label: "이번주", description: "월요일~일요일" },
  { value: "today", label: "오늘", description: "금일 검수" },
];

const PANEL_QUERY_VALUE_MAP: Record<ActivePanel, string> = {
  form: "form",
  records: "records",
  dashboard: "dashboard",
  normalizationReport: "normalization-defect-report",
  modelReport: "model-defect-report",
};

const TAB_QUERY_PANEL_MAP: Record<string, ActivePanel> = {
  form: "form",
  register: "form",
  records: "records",
  "record-list": "records",
  dashboard: "dashboard",
  "inspection-dashboard": "dashboard",
  "normalization-report": "normalizationReport",
  "normalization-defect-report": "normalizationReport",
  "normalization": "normalizationReport",
  "productization-report": "normalizationReport",
  "productization-defect-report": "normalizationReport",
  "general-change-normalization-report": "normalizationReport",
  "model-report": "modelReport",
  "model-defect-report": "modelReport",
  "defect-report": "modelReport",
};

function getPanelFromQueryTab(value?: string | null): ActivePanel | null {
  const normalized = (value || "").trim().toLowerCase();

  if (!normalized) return null;

  return TAB_QUERY_PANEL_MAP[normalized] || null;
}

function getReportRangeFromQueryValue(value?: string | null): ReportRange | null {
  const normalized = (value || "").trim().toLowerCase();

  if (REPORT_RANGE_OPTIONS.some((option) => option.value === normalized)) {
    return normalized as ReportRange;
  }

  return null;
}

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

function isGeneralOrChangeReturnType(value?: string) {
  return value === "일반반품" || value === "변심반품";
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
  const overallTrendMap = new Map<
    string,
    { total: number; normal: number; defective: number }
  >();
  const modelMap = new Map<
    string,
    {
      total: number;
      normal: number;
      defective: number;
      followUp: number;
      pending: number;
      reasons: Map<string, number>;
      trendMap: Map<string, { total: number; normal: number; defective: number }>;
    }
  >();

  const ensureTrend = (
    trendMap: Map<string, { total: number; normal: number; defective: number }>,
    dateKey: string
  ) => {
    const current = trendMap.get(dateKey) || {
      total: 0,
      normal: 0,
      defective: 0,
    };
    trendMap.set(dateKey, current);
    return current;
  };

  const ensureModel = (productName: string) => {
    const current = modelMap.get(productName) || {
      total: 0,
      normal: 0,
      defective: 0,
      followUp: 0,
      pending: 0,
      reasons: new Map<string, number>(),
      trendMap: new Map<string, { total: number; normal: number; defective: number }>(),
    };
    modelMap.set(productName, current);
    return current;
  };

  records.forEach((record) => {
    const productName = normalizeReportProductName(record.productName);
    const dateKey = getDateOnly(record.createdAt) || "날짜 미입력";
    const currentModel = ensureModel(productName);
    const isNormal = isNormalInspectionResult(record.inspectionResult);
    const isDefective = isDefectiveInspectionResult(record.inspectionResult);

    currentModel.total += 1;
    if (isNormal) currentModel.normal += 1;
    if (isDefective) currentModel.defective += 1;
    if (record.inspectionResult === "후속 확인 필요") currentModel.followUp += 1;
    if (record.inspectionResult === "검사 대기") currentModel.pending += 1;

    const overallTrend = ensureTrend(overallTrendMap, dateKey);
    overallTrend.total += 1;
    if (isNormal) overallTrend.normal += 1;
    if (isDefective) overallTrend.defective += 1;

    const modelTrend = ensureTrend(currentModel.trendMap, dateKey);
    modelTrend.total += 1;
    if (isNormal) modelTrend.normal += 1;
    if (isDefective) modelTrend.defective += 1;

    if (!isDefective) return;

    const noteText = record.note || "";
    const matchedReasons = defectiveNoteOptions.filter((reason) =>
      noteText.includes(reason)
    );
    const reasons = matchedReasons.length > 0 ? matchedReasons : ["기타"];

    reasons.forEach((reason) => {
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      currentModel.reasons.set(
        reason,
        (currentModel.reasons.get(reason) || 0) + 1
      );
    });
  });

  const defectReasonRows: DefectReasonRow[] = Array.from(reasonMap.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: calculatePercent(count, defective || count),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko-KR"));

  const modelInspectionRows: ModelInspectionRow[] = Array.from(modelMap.entries())
    .map(([productName, value]) => ({
      productName,
      total: value.total,
      normal: value.normal,
      defective: value.defective,
      followUp: value.followUp,
      pending: value.pending,
      normalRate: calculatePercent(value.normal, value.total),
      defectRate: calculatePercent(value.defective, value.total),
      reasons: Array.from(value.reasons.entries())
        .map(([label, count]) => ({
          label,
          count,
          percent: calculatePercent(count, value.defective || count),
        }))
        .sort(
          (a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko-KR")
        ),
      trendRows: trendMapToRows(value.trendMap),
      weeklyTrendRows: trendMapToWeeklyRows(value.trendMap),
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.defective - a.defective ||
        a.productName.localeCompare(b.productName, "ko-KR")
    );

  const modelDefectRows: ModelDefectRow[] = modelInspectionRows
    .filter((row) => row.defective > 0)
    .map((row) => ({
      productName: row.productName,
      count: row.defective,
      reasons: row.reasons,
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
    modelInspectionRows,
    overallTrendRows: trendMapToRows(overallTrendMap),
    overallWeeklyTrendRows: trendMapToWeeklyRows(overallTrendMap),
  };
}
function getProcessActionsByInspectionResult(value: InspectionResult): ProcessAction[] {
  if (isNormalInspectionResult(value)) {
    return ["안성물류이동"];
  }

  if (isDefectiveInspectionResult(value)) {
    return ["자체폐기", "자체 B급활용", "안성물류폐기이동"];
  }

  return PROCESS_ACTIONS;
}

function getDefaultProcessActionByInspectionResult(
  value: InspectionResult,
  currentProcessAction: ProcessAction
): ProcessAction {
  const availableProcessActions = getProcessActionsByInspectionResult(value);
  const normalizedCurrentProcessAction = normalizeProcessActionValue(currentProcessAction);

  if (availableProcessActions.includes(normalizedCurrentProcessAction)) {
    return normalizedCurrentProcessAction;
  }

  if (isNormalInspectionResult(value)) {
    return "안성물류이동";
  }

  if (isDefectiveInspectionResult(value)) {
    return "자체폐기";
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
const PHOTO_VIEW_RETENTION_DAYS = 90;

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

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0);

  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    todayKey: dateToDateKey(todayStart),
    monthStartKey: dateToDateKey(monthStart),
    monthEndKey: dateToDateKey(monthEnd),
    weekStartKey: dateToDateKey(weekStart),
    weekEndKey: dateToDateKey(weekEnd),
  };
}

type ExcelDownloadRangeInfo = {
  range: ExcelDownloadRange;
  label: string;
  shortLabel: string;
  filenameLabel: string;
  startKey?: string;
  endKey?: string;
};

function getExcelDownloadRangeInfo(
  range: ExcelDownloadRange,
  keys: ReportDateKeys
): ExcelDownloadRangeInfo {
  if (range === "today") {
    return {
      range,
      label: "오늘 기록",
      shortLabel: "오늘",
      filenameLabel: `오늘_${keys.todayKey.replaceAll("-", "")}`,
      startKey: keys.todayKey,
      endKey: keys.todayKey,
    };
  }

  if (range === "week") {
    return {
      range,
      label: "이번주 기록",
      shortLabel: "이번주",
      filenameLabel: `이번주_${keys.weekStartKey.replaceAll("-", "")}_${keys.weekEndKey.replaceAll("-", "")}`,
      startKey: keys.weekStartKey,
      endKey: keys.weekEndKey,
    };
  }

  return {
    range,
    label: "전체 기록",
    shortLabel: "전체",
    filenameLabel: "전체",
  };
}

function filterRecordsForExcelDownload(
  records: ReturnRecord[],
  rangeInfo: ExcelDownloadRangeInfo
) {
  if (!rangeInfo.startKey || !rangeInfo.endKey) {
    return records;
  }

  return records.filter((record) => {
    const recordDate = getDateOnly(record.createdAt);
    return (
      recordDate &&
      recordDate >= rangeInfo.startKey! &&
      recordDate <= rangeInfo.endKey!
    );
  });
}

function formatExcelIssuedDateKey() {
  const today = new Date();
  return `${today.getFullYear()}${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(today.getDate()).padStart(2, "0")}`;
}

function formatDateKeyKo(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return dateKey;

  return `${match[1]}.${match[2]}.${match[3]}`;
}

function formatTrendDateLabel(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return dateKey;

  return `${Number(match[2])}/${Number(match[3])}`;
}

function compareTrendDateKey(a: string, b: string) {
  if (a === b) return 0;
  if (a === "날짜 미입력") return 1;
  if (b === "날짜 미입력") return -1;
  return a.localeCompare(b);
}

function trendMapToRows(
  trendMap: Map<string, { total: number; normal: number; defective: number }>
): TrendPoint[] {
  return Array.from(trendMap.entries())
    .map(([dateKey, value]) => ({
      dateKey,
      label: formatTrendDateLabel(dateKey),
      total: value.total,
      normal: value.normal,
      defective: value.defective,
    }))
    .sort((a, b) => compareTrendDateKey(a.dateKey, b.dateKey));
}

function parseDateKeyToDate(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getRecordAgeDays(createdAt: string) {
  const dateKey = getDateOnly(createdAt);
  const recordDate = parseDateKeyToDate(dateKey);

  if (!recordDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  recordDate.setHours(0, 0, 0, 0);

  return Math.floor((today.getTime() - recordDate.getTime()) / 86400000);
}

function isPhotoRetentionExpired(createdAt: string) {
  const ageDays = getRecordAgeDays(createdAt);

  if (ageDays === null) return false;

  return ageDays > PHOTO_VIEW_RETENTION_DAYS;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseDateKeyToDate(dateKey);

  if (!date) return dateKey;

  date.setDate(date.getDate() + days);
  return dateToDateKey(date);
}

function getDateKeyRange(startKey: string, endKey: string) {
  const startDate = parseDateKeyToDate(startKey);
  const endDate = parseDateKeyToDate(endKey);

  if (!startDate || !endDate || startDate > endDate) return [];

  const rows: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    rows.push(dateToDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return rows;
}

function getWeekKeyRange(startKey: string, endKey: string) {
  const startWeekKey = getWeekStartKey(startKey);
  const endWeekKey = getWeekStartKey(endKey);
  const startDate = parseDateKeyToDate(startWeekKey);
  const endDate = parseDateKeyToDate(endWeekKey);

  if (!startDate || !endDate || startDate > endDate) return [];

  const rows: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    rows.push(dateToDateKey(current));
    current.setDate(current.getDate() + 7);
  }

  return rows;
}

function getWeekStartKey(dateKey: string) {
  const date = parseDateKeyToDate(dateKey);

  if (!date) return dateKey;

  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);

  return dateToDateKey(date);
}

function formatWeeklyTrendLabel(startKey: string, endKey: string) {
  const startMatch = startKey.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const endMatch = endKey.match(/^\d{4}-(\d{2})-(\d{2})$/);

  if (!startMatch || !endMatch) return startKey;

  return `${Number(startMatch[1])}/${Number(startMatch[2])}~${Number(endMatch[1])}/${Number(endMatch[2])}`;
}

function compareWeeklyTrendKey(a: string, b: string) {
  if (a === b) return 0;
  if (a === "날짜 미입력") return 1;
  if (b === "날짜 미입력") return -1;
  return a.localeCompare(b);
}

function trendMapToWeeklyRows(
  trendMap: Map<string, { total: number; normal: number; defective: number }>
): WeeklyTrendPoint[] {
  const weeklyMap = new Map<
    string,
    { startKey: string; endKey: string; total: number; normal: number; defective: number }
  >();

  trendMap.forEach((value, dateKey) => {
    const weekKey = getWeekStartKey(dateKey);
    const current = weeklyMap.get(weekKey) || {
      startKey: weekKey,
      endKey: weekKey === "날짜 미입력" ? weekKey : addDaysToDateKey(weekKey, 6),
      total: 0,
      normal: 0,
      defective: 0,
    };

    current.total += value.total;
    current.normal += value.normal;
    current.defective += value.defective;
    weeklyMap.set(weekKey, current);
  });

  return Array.from(weeklyMap.entries())
    .map(([weekKey, value]) => ({
      weekKey,
      startKey: value.startKey,
      endKey: value.endKey,
      label: formatWeeklyTrendLabel(value.startKey, value.endKey),
      total: value.total,
      normal: value.normal,
      defective: value.defective,
    }))
    .sort((a, b) => compareWeeklyTrendKey(a.weekKey, b.weekKey));
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

  if (range === "month") {
    return `${formatDateKeyKo(keys.monthStartKey)} ~ ${formatDateKeyKo(keys.todayKey)}`;
  }

  return "저장된 전체 기록";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const CHART_TOTAL_COLOR = "#0f172a";
const CHART_NORMAL_COLOR = "#059669";
const CHART_DEFECT_COLOR = "#e11d48";
const CHART_RATE_COLOR = "#f97316";

const CHART_SERIES_LABELS = [
  { key: "total", label: "전체", color: CHART_TOTAL_COLOR },
  { key: "normal", label: "정상", color: CHART_NORMAL_COLOR },
  { key: "defective", label: "불량", color: CHART_DEFECT_COLOR },
] as const;

const PRIMARY_MODEL_TREND_SERIES = [
  {
    key: "(분리형) 휴대용분유포트",
    label: "(분리형) 휴대용분유포트",
    color: "#0f172a",
  },
  {
    key: "휴대용분유포트",
    label: "휴대용분유포트",
    color: "#0284c7",
  },
  {
    key: "분유쉐이커",
    label: "분유쉐이커",
    color: "#e11d48",
  },
  {
    key: "LED분유쉐이커",
    label: "LED분유쉐이커",
    color: "#7c3aed",
  },
] as const;

function getChartLabelLines(label: string) {
  const normalized = label.trim();

  if (!normalized) return [""];

  if (normalized.includes("~")) return [normalized];

  if (normalized.startsWith("(분리형)")) {
    return ["(분리형)", normalized.replace("(분리형)", "").trim() || "휴대용분유포트"];
  }

  if (normalized.length <= 9) return [normalized];

  const spacedParts = normalized.split(/\s+/).filter(Boolean);

  if (spacedParts.length >= 2) {
    const first = spacedParts[0];
    const second = spacedParts.slice(1).join(" ");
    return [first, second.length > 12 ? `${second.slice(0, 11)}…` : second];
  }

  return [normalized.slice(0, 9), normalized.length > 18 ? `${normalized.slice(9, 17)}…` : normalized.slice(9)];
}

function ComboBarRateChart({
  rows,
  emptyText,
  height = 340,
}: {
  rows: ComboChartRow[];
  emptyText: string;
  height?: number;
}) {
  const visibleRows = rows.filter((row) => row.total > 0 || row.normal > 0 || row.defective > 0);

  if (visibleRows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  const width = 860;
  const padding = { top: 58, right: 64, bottom: 72, left: 52 };
  const chartHeight = height;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxCount = Math.max(
    1,
    ...visibleRows.flatMap((row) => [row.total, row.normal, row.defective])
  );
  const maxRateValue = Math.max(
    0,
    ...visibleRows.map((row) => calculatePercent(row.defective, row.total))
  );
  const maxRate = Math.max(10, Math.min(100, Math.ceil(maxRateValue / 10) * 10));
  const yGuides = Array.from(new Set([maxCount, Math.ceil(maxCount / 2), 0])).sort(
    (a, b) => b - a
  );
  const rateGuides = Array.from(new Set([maxRate, Math.ceil(maxRate / 2), 0])).sort(
    (a, b) => b - a
  );
  const groupWidth = innerWidth / visibleRows.length;
  const barGap = visibleRows.length >= 8 ? 3 : 5;
  const barWidth = Math.max(
    8,
    Math.min(22, (Math.min(groupWidth * 0.68, 72) - barGap * 2) / 3)
  );
  const minBarHeight = 4;

  const getX = (index: number) => padding.left + groupWidth * index + groupWidth / 2;
  const getCountY = (value: number) =>
    padding.top + innerHeight - (Math.max(0, value) / maxCount) * innerHeight;
  const getRateY = (value: number) =>
    padding.top + innerHeight - (Math.max(0, value) / maxRate) * innerHeight;

  const ratePoints = visibleRows
    .map((row, index) => {
      const rate = calculatePercent(row.defective, row.total);
      return `${getX(index)},${getRateY(rate)}`;
    })
    .join(" ");

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CHART_SERIES_LABELS.map((item) => (
          <div key={`legend-${item.key}`} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
          <span className="inline-block h-0.5 w-5 border-t-2 border-dotted border-orange-500" />
          <span>불량률</span>
        </div>
      </div>

      <svg
        className="w-full overflow-visible"
        style={{ height: chartHeight }}
        viewBox={`0 0 ${width} ${chartHeight}`}
        role="img"
        aria-label="입고 추이 막대 그래프"
      >
        {yGuides.map((guide) => {
          const y = getCountY(guide);

          return (
            <g key={`count-guide-${guide}`}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[11px] font-bold"
              >
                {guide}
              </text>
            </g>
          );
        })}

        {rateGuides.map((guide) => {
          const y = getRateY(guide);

          return (
            <text
              key={`rate-guide-${guide}`}
              x={width - padding.right + 10}
              y={y + 4}
              textAnchor="start"
              className="fill-orange-400 text-[11px] font-bold"
            >
              {guide}%
            </text>
          );
        })}

        {visibleRows.map((row, index) => {
          const centerX = getX(index);
          const totalX = centerX - barWidth - barGap;
          const normalX = centerX;
          const defectX = centerX + barWidth + barGap;
          const bars = [
            { key: "total", value: row.total, x: totalX, color: CHART_TOTAL_COLOR },
            { key: "normal", value: row.normal, x: normalX, color: CHART_NORMAL_COLOR },
            { key: "defective", value: row.defective, x: defectX, color: CHART_DEFECT_COLOR },
          ];
          const labelLines = getChartLabelLines(row.label);

          return (
            <g key={`group-${row.id}-${index}`}>
              {bars.map((bar) => {
                const rawHeight = (bar.value / maxCount) * innerHeight;
                const barHeight = bar.value > 0 ? Math.max(minBarHeight, rawHeight) : 0;
                const y = padding.top + innerHeight - barHeight;

                return (
                  <g key={`bar-${row.id}-${bar.key}`}>
                    <rect
                      x={bar.x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="5"
                      fill={bar.color}
                      opacity={bar.key === "total" ? 0.9 : 0.82}
                    />
                    {bar.value > 0 && (
                      <text
                        x={bar.x}
                        y={Math.max(14, y - 7)}
                        textAnchor="middle"
                        className="fill-slate-900 text-[12px] font-black"
                      >
                        {bar.value}
                      </text>
                    )}
                  </g>
                );
              })}

              <text
                x={centerX}
                y={chartHeight - 38}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-bold"
              >
                {labelLines.map((line, lineIndex) => (
                  <tspan key={`label-${row.id}-${lineIndex}`} x={centerX} dy={lineIndex === 0 ? 0 : 14}>
                    {line}
                  </tspan>
                ))}
              </text>
              <title>{`${row.label} · 전체 ${row.total}건 · 정상 ${row.normal}건 · 불량 ${row.defective}건`}</title>
            </g>
          );
        })}

        <polyline
          fill="none"
          points={ratePoints}
          stroke={CHART_RATE_COLOR}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          strokeDasharray="4 6"
        />

        {visibleRows.map((row, index) => {
          const rate = calculatePercent(row.defective, row.total);
          if (row.total <= 0) return null;

          const centerX = getX(index);
          const y = getRateY(rate);
          const labelText = `${rate}%`;
          const labelWidth = Math.max(34, 18 + labelText.length * 7);
          const labelY = Math.min(padding.top + innerHeight - 18, Math.max(22, y - 16));

          return (
            <g key={`rate-${row.id}-${index}`}>
              <circle
                cx={centerX}
                cy={y}
                r="4"
                fill={CHART_RATE_COLOR}
                stroke="white"
                strokeWidth="2.5"
              />
              <rect
                x={centerX - labelWidth / 2}
                y={labelY - 13}
                width={labelWidth}
                height="21"
                rx="10.5"
                fill="white"
                stroke={CHART_RATE_COLOR}
                strokeWidth="1.4"
              />
              <text
                x={centerX}
                y={labelY + 2}
                textAnchor="middle"
                className="fill-orange-600 text-[12px] font-black"
              >
                {labelText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DailyInspectionTrendChart({
  rows,
  startKey,
  endKey,
}: {
  rows: TrendPoint[];
  startKey: string;
  endKey: string;
}) {
  const dateKeys = getDateKeyRange(startKey, endKey);
  const valueMap = new Map(rows.map((row) => [row.dateKey, row]));
  const visibleRows: ComboChartRow[] = dateKeys.map((dateKey) => {
    const value = valueMap.get(dateKey);

    return {
      id: dateKey,
      label: formatTrendDateLabel(dateKey),
      total: value?.total || 0,
      normal: value?.normal || 0,
      defective: value?.defective || 0,
    };
  });

  return (
    <ComboBarRateChart
      rows={visibleRows}
      emptyText="선택 기간에 일별 입고 추이 데이터가 없습니다."
    />
  );
}

function WeeklyInspectionTrendChart({
  rows,
  maxWeeks = 8,
}: {
  rows: WeeklyTrendPoint[];
  maxWeeks?: number;
}) {
  const visibleRows: ComboChartRow[] = rows.slice(-maxWeeks).map((row) => ({
    id: row.weekKey,
    label: row.label,
    total: row.total,
    normal: row.normal,
    defective: row.defective,
  }));

  return (
    <ComboBarRateChart
      rows={visibleRows}
      emptyText="선택 기간에 주간 입고 추이 데이터가 없습니다."
    />
  );
}

function buildDailyModelTrendRows(
  modelRows: ModelInspectionRow[],
  startKey: string,
  endKey: string
): ModelTrendChartRow[] {
  const modelMap = new Map(modelRows.map((row) => [row.productName, row]));
  const dateKeys = getDateKeyRange(startKey, endKey);

  return dateKeys.map((dateKey) => {
    const values: Record<string, number> = {};

    PRIMARY_MODEL_TREND_SERIES.forEach((series) => {
      const modelRow = modelMap.get(series.key);
      const trendRow = modelRow?.trendRows.find((row) => row.dateKey === dateKey);
      values[series.key] = trendRow?.total || 0;
    });

    return {
      id: dateKey,
      label: formatTrendDateLabel(dateKey),
      values,
    };
  });
}

function getModelTrendDateBounds(modelRows: ModelInspectionRow[]) {
  const dateKeys = modelRows
    .filter((row) => PRIMARY_MODEL_TREND_SERIES.some((series) => series.key === row.productName))
    .flatMap((row) => row.trendRows.map((trendRow) => trendRow.dateKey))
    .filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
    .sort(compareTrendDateKey);

  if (dateKeys.length === 0) return null;

  return {
    startKey: dateKeys[0],
    endKey: dateKeys[dateKeys.length - 1],
  };
}

function buildWeeklyModelTrendRows(
  modelRows: ModelInspectionRow[],
  startKey?: string,
  endKey?: string
): ModelTrendChartRow[] {
  const modelMap = new Map(modelRows.map((row) => [row.productName, row]));
  const bounds = startKey && endKey ? { startKey, endKey } : getModelTrendDateBounds(modelRows);

  if (!bounds) return [];

  const weekKeys = getWeekKeyRange(bounds.startKey, bounds.endKey);

  return weekKeys.map((weekKey) => {
    const values: Record<string, number> = {};

    PRIMARY_MODEL_TREND_SERIES.forEach((series) => {
      const modelRow = modelMap.get(series.key);
      const weeklyRow = modelRow?.weeklyTrendRows.find((row) => row.weekKey === weekKey);
      values[series.key] = weeklyRow?.total || 0;
    });

    return {
      id: weekKey,
      label: formatWeeklyTrendLabel(weekKey, addDaysToDateKey(weekKey, 6)),
      values,
    };
  });
}

function ModelTrendGroupedBarChart({
  rows,
  emptyText,
  height = 360,
}: {
  rows: ModelTrendChartRow[];
  emptyText: string;
  height?: number;
}) {
  const hasAnyValue = rows.some((row) =>
    PRIMARY_MODEL_TREND_SERIES.some((series) => (row.values[series.key] || 0) > 0)
  );

  if (!hasAnyValue) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  const visibleRows = rows;
  const width = Math.max(860, visibleRows.length * 126 + 128);
  const padding = { top: 48, right: 34, bottom: 78, left: 52 };
  const chartHeight = height;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxCount = Math.max(
    1,
    ...visibleRows.flatMap((row) =>
      PRIMARY_MODEL_TREND_SERIES.map((series) => row.values[series.key] || 0)
    )
  );
  const yGuides = Array.from(new Set([maxCount, Math.ceil(maxCount / 2), 0])).sort(
    (a, b) => b - a
  );
  const groupWidth = innerWidth / visibleRows.length;
  const barGap = visibleRows.length >= 8 ? 3 : 5;
  const barWidth = Math.max(
    8,
    Math.min(
      18,
      (Math.min(groupWidth * 0.78, 92) - barGap * (PRIMARY_MODEL_TREND_SERIES.length - 1)) /
        PRIMARY_MODEL_TREND_SERIES.length
    )
  );
  const minBarHeight = 4;

  const getX = (index: number) => padding.left + groupWidth * index + groupWidth / 2;
  const getCountY = (value: number) =>
    padding.top + innerHeight - (Math.max(0, value) / maxCount) * innerHeight;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PRIMARY_MODEL_TREND_SERIES.map((item) => (
          <div key={`model-trend-legend-${item.key}`} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto pb-2">
        <svg
          className="overflow-visible"
          style={{ width, height: chartHeight }}
          viewBox={`0 0 ${width} ${chartHeight}`}
          role="img"
          aria-label="모델별 입고 추이 막대 그래프"
        >
          {yGuides.map((guide) => {
            const y = getCountY(guide);

            return (
              <g key={`model-count-guide-${guide}`}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[11px] font-bold"
                >
                  {guide}
                </text>
              </g>
            );
          })}

          {visibleRows.map((row, index) => {
            const centerX = getX(index);
            const totalSeriesWidth =
              barWidth * PRIMARY_MODEL_TREND_SERIES.length +
              barGap * (PRIMARY_MODEL_TREND_SERIES.length - 1);
            const startX = centerX - totalSeriesWidth / 2 + barWidth / 2;
            const labelLines = getChartLabelLines(row.label);

            return (
              <g key={`model-trend-group-${row.id}-${index}`}>
                {PRIMARY_MODEL_TREND_SERIES.map((series, seriesIndex) => {
                  const value = row.values[series.key] || 0;
                  const rawHeight = (value / maxCount) * innerHeight;
                  const barHeight = value > 0 ? Math.max(minBarHeight, rawHeight) : 0;
                  const x = startX + seriesIndex * (barWidth + barGap);
                  const y = padding.top + innerHeight - barHeight;

                  return (
                    <g key={`model-trend-bar-${row.id}-${series.key}`}>
                      <rect
                        x={x - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="5"
                        fill={series.color}
                        opacity="0.9"
                      />
                      {value > 0 && (
                        <text
                          x={x}
                          y={Math.max(14, y - 7)}
                          textAnchor="middle"
                          className="fill-slate-900 text-[12px] font-black"
                        >
                          {value}
                        </text>
                      )}
                    </g>
                  );
                })}

                <text
                  x={centerX}
                  y={chartHeight - 40}
                  textAnchor="middle"
                  className="fill-slate-600 text-[11px] font-bold"
                >
                  {labelLines.map((line, lineIndex) => (
                    <tspan key={`model-trend-label-${row.id}-${lineIndex}`} x={centerX} dy={lineIndex === 0 ? 0 : 14}>
                      {line}
                    </tspan>
                  ))}
                </text>
                <title>
                  {`${row.label} · ${PRIMARY_MODEL_TREND_SERIES.map(
                    (series) => `${series.label} ${row.values[series.key] || 0}건`
                  ).join(" · ")}`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function ModelInspectionComparisonChart({
  modelRows,
  range,
  dateKeys,
}: {
  modelRows: ModelInspectionRow[];
  range: ReportRange;
  dateKeys: ReportDateKeys;
}) {
  const chartRows =
    range === "week"
      ? buildDailyModelTrendRows(modelRows, dateKeys.weekStartKey, dateKeys.todayKey)
      : range === "month"
        ? buildWeeklyModelTrendRows(modelRows, dateKeys.monthStartKey, dateKeys.todayKey)
        : buildWeeklyModelTrendRows(modelRows);

  return (
    <ModelTrendGroupedBarChart
      rows={chartRows}
      height={range === "week" ? 350 : 370}
      emptyText="선택 기간에 주요 4개 모델 입고 데이터가 없습니다."
    />
  );
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
    getProcessActionDisplayName(record.processAction),
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


function openPhotoInNewTab(photo: UploadedPhoto) {
  if (!photo.url) {
    window.alert("사진 링크가 없습니다.");
    return;
  }

  window.open(photo.url, "_blank", "noopener,noreferrer");
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
  const [customProductOptions, setCustomProductOptions] = useState<string[]>([]);
  const [loadingNoteOptions, setLoadingNoteOptions] = useState(false);
  const [savingNoteOption, setSavingNoteOption] = useState(false);
  const [loadingProductOptions, setLoadingProductOptions] = useState(false);
  const [savingProductOption, setSavingProductOption] = useState(false);
  const [productManagerOpen, setProductManagerOpen] = useState(false);
  const [editingProductOption, setEditingProductOption] = useState<string | null>(null);
  const [editingProductOptionValue, setEditingProductOptionValue] = useState("");

  const [invoicePhotos, setInvoicePhotos] = useState<UploadedPhoto[]>([]);
  const [productPhotos, setProductPhotos] = useState<UploadedPhoto[]>([]);

  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingProduct, setUploadingProduct] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [filterProduct, setFilterProduct] = useState<string>("전체");
  const [filterResult, setFilterResult] = useState<string>("전체");
  const [filterProcessAction, setFilterProcessAction] = useState<string>("전체");
  const [recordSearchSubmitted, setRecordSearchSubmitted] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [downloadingExcelRange, setDownloadingExcelRange] = useState<ExcelDownloadRange | null>(null);
  const [expandedPhotoRecordIds, setExpandedPhotoRecordIds] = useState<string[]>([]);
  const [cleaningPhotoRecordId, setCleaningPhotoRecordId] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState<ReportRange>("all");
  const [activePanel, setActivePanel] = useState<ActivePanel>("form");

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusError, setStatusError] = useState<string>("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string>("");
  const [ocrRawText, setOcrRawText] = useState<string>("");

  const buildPanelUrl = (panel: ActivePanel, nextRange: ReportRange = reportRange) => {
    if (typeof window === "undefined") return "";

    const url = new URL(window.location.href);
    url.searchParams.set("tab", PANEL_QUERY_VALUE_MAP[panel]);

    if (panel === "dashboard" || panel === "normalizationReport" || panel === "modelReport") {
      url.searchParams.set("range", nextRange);
    } else {
      url.searchParams.delete("range");
    }

    return `${url.pathname}${url.search}${url.hash}`;
  };

  const replacePanelUrl = (panel: ActivePanel, nextRange: ReportRange = reportRange) => {
    if (typeof window === "undefined") return;

    const nextUrl = buildPanelUrl(panel, nextRange);
    if (!nextUrl) return;

    window.history.replaceState(null, "", nextUrl);
  };

  const openPanel = (
    panel: ActivePanel,
    options: { resetRange?: boolean } = {}
  ) => {
    const nextRange = options.resetRange ? "all" : reportRange;

    setActivePanel(panel);
    if (options.resetRange) {
      setReportRange("all");
    }
    replacePanelUrl(panel, nextRange);
  };

  const changeReportRange = (nextRange: ReportRange) => {
    setReportRange(nextRange);
    replacePanelUrl(activePanel, nextRange);
  };

  useEffect(() => {
    const applyPanelFromUrl = () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const panelFromUrl = getPanelFromQueryTab(params.get("tab"));
      const rangeFromUrl = getReportRangeFromQueryValue(params.get("range"));

      if (panelFromUrl) {
        setActivePanel(panelFromUrl);
      }

      if (rangeFromUrl) {
        setReportRange(rangeFromUrl);
      } else if (
        panelFromUrl === "dashboard" ||
        panelFromUrl === "normalizationReport" ||
        panelFromUrl === "modelReport"
      ) {
        setReportRange("all");
      }
    };

    applyPanelFromUrl();
    window.addEventListener("popstate", applyPanelFromUrl);

    return () => {
      window.removeEventListener("popstate", applyPanelFromUrl);
    };
  }, []);

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

  function sortRecordsForDisplay(nextRecords: ReturnRecord[]) {
    return [...nextRecords].sort((a, b) => {
      const bTime = new Date(b.createdAt || "").getTime();
      const aTime = new Date(a.createdAt || "").getTime();

      if (Number.isNaN(bTime) || Number.isNaN(aTime)) return 0;
      return bTime - aTime;
    });
  }

  function upsertRecordInState(nextRecord: ReturnRecord) {
    setRecords((prev) => {
      const exists = prev.some((record) => record.id === nextRecord.id);
      const nextRecords = exists
        ? prev.map((record) => (record.id === nextRecord.id ? nextRecord : record))
        : [nextRecord, ...prev];

      return sortRecordsForDisplay(nextRecords);
    });
  }

  function removeRecordsFromState(recordIds: string[]) {
    const removeSet = new Set(recordIds);
    setRecords((prev) => prev.filter((record) => !removeSet.has(record.id)));
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

  function getLegacyCustomProductOptions() {
    try {
      const storedOptions = window.localStorage.getItem(
        LEGACY_CUSTOM_PRODUCT_OPTIONS_STORAGE_KEY
      );

      if (!storedOptions) return [];

      const parsedOptions = JSON.parse(storedOptions);

      if (!Array.isArray(parsedOptions)) return [];

      return getUniqueProductOptions(parsedOptions.map((item) => String(item)));
    } catch {
      window.localStorage.removeItem(LEGACY_CUSTOM_PRODUCT_OPTIONS_STORAGE_KEY);
      return [];
    }
  }

  async function fetchCustomProductOptions() {
    try {
      setLoadingProductOptions(true);

      const response = await fetch(PRODUCT_OPTIONS_API_PATH, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "제품명 목록 조회에 실패했습니다.");
      }

      let nextOptions = getUniqueProductOptions(
        Array.isArray(data.customProductOptions)
          ? data.customProductOptions.map((item: unknown) => String(item))
          : []
      );

      const baseProductOptions = PRODUCT_TYPES.filter(
        (item) => item !== "직접입력"
      );
      const legacyOptions = getLegacyCustomProductOptions();
      const optionsToMigrate = legacyOptions.filter(
        (option) =>
          option !== "직접입력" &&
          !baseProductOptions.includes(option) &&
          !nextOptions.includes(option)
      );

      if (optionsToMigrate.length > 0) {
        const migrateResponse = await fetch(PRODUCT_OPTIONS_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ options: optionsToMigrate }),
        });
        const migrateData = await migrateResponse.json();

        if (!migrateResponse.ok) {
          throw new Error(
            migrateData?.error || "기존 제품명 서버 저장에 실패했습니다."
          );
        }

        nextOptions = getUniqueProductOptions(
          Array.isArray(migrateData.customProductOptions)
            ? migrateData.customProductOptions.map((item: unknown) =>
                String(item)
              )
            : nextOptions
        );

        window.localStorage.removeItem(LEGACY_CUSTOM_PRODUCT_OPTIONS_STORAGE_KEY);
      }

      setCustomProductOptions(nextOptions);
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : "제품명 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoadingProductOptions(false);
    }
  }

  useEffect(() => {
    fetchCustomDefectiveNoteOptions();
  }, []);

  useEffect(() => {
    fetchCustomProductOptions();
  }, []);

  const productOptionsForSelect = useMemo(
    () =>
      getUniqueProductOptions([
        ...PRODUCT_TYPES.filter((item) => item !== "직접입력"),
        ...customProductOptions,
        "직접입력",
      ]),
    [customProductOptions]
  );

  const productUsageCounts = useMemo(() => {
    const usageMap: Record<string, number> = {};

    records.forEach((record) => {
      const normalizedProductName = normalizeProductOptionText(
        record.productName || ""
      );

      if (!normalizedProductName) return;

      usageMap[normalizedProductName] =
        (usageMap[normalizedProductName] || 0) + 1;
    });

    return usageMap;
  }, [records]);

  const productManagerRows = useMemo(
    () =>
      productOptionsForSelect
        .filter((item) => item !== "직접입력")
        .map((item) => {
          const normalizedOption = normalizeProductOptionText(item);
          const isCustom = customProductOptions.includes(normalizedOption);

          return {
            name: normalizedOption,
            isCustom,
            isDefault: !isCustom,
            usageCount: productUsageCounts[normalizedOption] || 0,
          };
        }),
    [customProductOptions, productOptionsForSelect, productUsageCounts]
  );

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

  const oldPhotoRecordCount = useMemo(() =>
    records.filter((record) => {
      const totalPhotos =
        (record.invoicePhotos || []).length + (record.productPhotos || []).length;

      return totalPhotos > 0 && isPhotoRetentionExpired(record.createdAt);
    }).length,
    [records]
  );

  const reportDateKeys = useMemo(() => getCurrentReportDateKeys(), []);

  const reportRecords = useMemo(() => {
    if (reportRange === "all") return records;

    const startDate =
      reportRange === "today"
        ? reportDateKeys.todayKey
        : reportRange === "month"
          ? reportDateKeys.monthStartKey
          : reportDateKeys.weekStartKey;
    const endDate =
      reportRange === "today"
        ? reportDateKeys.todayKey
        : reportRange === "month"
          ? reportDateKeys.monthEndKey
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

  const normalizationReportRecords = useMemo(
    () => reportRecords.filter((record) => isGeneralOrChangeReturnType(record.returnType)),
    [reportRecords]
  );

  const selectedNormalizationReportSummary = useMemo(
    () => buildReportSummary(normalizationReportRecords, defectiveNoteOptionsForReport),
    [normalizationReportRecords, defectiveNoteOptionsForReport]
  );

  const normalizationProductChartRows = useMemo<ComboChartRow[]>(
    () =>
      selectedNormalizationReportSummary.modelInspectionRows.map((row) => ({
        id: row.productName,
        label: row.productName,
        total: row.total,
        normal: row.normal,
        defective: row.defective,
      })),
    [selectedNormalizationReportSummary.modelInspectionRows]
  );

  const reportOverviewRows = useMemo(() => {
    return REPORT_RANGE_OPTIONS.map((option) => {
      let rangeRecords = records;

      if (option.value !== "all") {
        const startDate =
          option.value === "today"
            ? reportDateKeys.todayKey
            : option.value === "month"
              ? reportDateKeys.monthStartKey
              : reportDateKeys.weekStartKey;
        const endDate =
          option.value === "today"
            ? reportDateKeys.todayKey
            : option.value === "month"
              ? reportDateKeys.monthEndKey
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
    productOptionsForSelect
      .filter((item) => item !== "직접입력")
      .forEach((item) => productSet.add(item));
    records.forEach((record) => {
      if (record.productName) productSet.add(record.productName);
    });
    return Array.from(productSet);
  }, [records, productOptionsForSelect]);

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
          getProcessActionDisplayName(record.processAction),
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

      const matchesProcessAction =
        filterProcessAction === "전체" ||
        normalizeProcessActionValue(record.processAction || "미선택") ===
          normalizeProcessActionValue(filterProcessAction) ||
        getProcessActionDisplayName(record.processAction) === filterProcessAction;

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate &&
        matchesProduct &&
        matchesResult &&
        matchesProcessAction
      );
    });
  }, [
    records,
    searchTerm,
    searchStartDate,
    searchEndDate,
    filterProduct,
    filterResult,
    filterProcessAction,
  ]);

  const displayedRecords = useMemo(() => {
    return recordSearchSubmitted ? filteredRecords : [];
  }, [recordSearchSubmitted, filteredRecords]);

  function handleSearchRecords() {
    setRecordSearchSubmitted(true);
    setSelectedRecordIds([]);
    setExpandedPhotoRecordIds([]);
  }

  function handleResetRecordSearch() {
    setSearchStartDate("");
    setSearchEndDate("");
    setSearchTerm("");
    setFilterProduct("전체");
    setFilterResult("전체");
    setFilterProcessAction("전체");
    setRecordSearchSubmitted(false);
    setSelectedRecordIds([]);
    setExpandedPhotoRecordIds([]);
  }

  useEffect(() => {
    const visibleIds = new Set(displayedRecords.map((record) => record.id));
    setSelectedRecordIds((prev) =>
      prev.filter((recordId) => visibleIds.has(recordId))
    );
  }, [displayedRecords]);

  const isAllFilteredRecordsSelected =
    displayedRecords.length > 0 &&
    displayedRecords.every((record) => selectedRecordIds.includes(record.id));

  function toggleSelectAllFilteredRecords() {
    if (isAllFilteredRecordsSelected) {
      setSelectedRecordIds([]);
      return;
    }

    setSelectedRecordIds(displayedRecords.map((record) => record.id));
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

  async function handleAddProductOption(
    onAdded?: (nextOption: ProductSelectValue) => void
  ) {
    const inputValue = window.prompt("추가할 제품명을 입력해주세요.");
    const nextOption = normalizeProductOptionText(inputValue || "");

    if (!nextOption) return;

    if (nextOption === "직접입력") {
      setStatusMessage("");
      setStatusError("'직접입력'은 기본 항목이라 추가할 수 없습니다.");
      return;
    }

    if (productOptionsForSelect.includes(nextOption)) {
      onAdded?.(nextOption);
      setStatusMessage(`이미 등록된 제품명 '${nextOption}'을 선택했습니다.`);
      setStatusError("");
      return;
    }

    try {
      setSavingProductOption(true);
      setStatusError("");

      const response = await fetch(PRODUCT_OPTIONS_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: nextOption }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "제품명 저장에 실패했습니다.");
      }

      const nextCustomOptions = getUniqueProductOptions(
        Array.isArray(data.customProductOptions)
          ? data.customProductOptions.map((item: unknown) => String(item))
          : [...customProductOptions, nextOption]
      );

      setCustomProductOptions(nextCustomOptions);
      onAdded?.(nextOption);
      setStatusMessage(`제품명 '${nextOption}'가 서버에 추가되었습니다.`);
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        error instanceof Error ? error.message : "제품명 저장에 실패했습니다."
      );
    } finally {
      setSavingProductOption(false);
    }
  }

  function applyProductOptionsResponse(data: any, fallbackOptions: string[]) {
    const nextCustomOptions = getUniqueProductOptions(
      Array.isArray(data?.customProductOptions)
        ? data.customProductOptions.map((item: unknown) => String(item))
        : fallbackOptions
    );

    setCustomProductOptions(nextCustomOptions);

    return nextCustomOptions;
  }

  function startEditProductOption(option: string) {
    if (!customProductOptions.includes(option)) {
      setStatusMessage("");
      setStatusError("기본 제품명은 보호 항목이라 수정할 수 없습니다.");
      return;
    }

    setEditingProductOption(option);
    setEditingProductOptionValue(option);
    setStatusError("");
  }

  function cancelEditProductOption() {
    setEditingProductOption(null);
    setEditingProductOptionValue("");
  }

  async function handleRenameProductOption(option: string) {
    const currentOption = normalizeProductOptionText(option);
    const nextOption = normalizeProductOptionText(editingProductOptionValue);

    if (!currentOption || !nextOption) {
      setStatusMessage("");
      setStatusError("변경할 제품명을 입력해주세요.");
      return;
    }

    if (nextOption === "직접입력") {
      setStatusMessage("");
      setStatusError("'직접입력'은 제품명으로 사용할 수 없습니다.");
      return;
    }

    if (currentOption === nextOption) {
      cancelEditProductOption();
      return;
    }

    if (productOptionsForSelect.includes(nextOption)) {
      setStatusMessage("");
      setStatusError("이미 등록된 제품명입니다.");
      return;
    }

    const recordsToRename = records.filter(
      (record) =>
        normalizeProductOptionText(record.productName || "") === currentOption
    );

    const confirmed = window.confirm(
      `'${currentOption}' 제품명을 '${nextOption}'로 수정할까요?\n기존 기록 ${recordsToRename.length}건도 같은 제품명으로 함께 변경됩니다.`
    );

    if (!confirmed) return;

    try {
      setSavingProductOption(true);
      setStatusError("");
      setStatusMessage(
        recordsToRename.length > 0
          ? `제품명 목록과 기존 기록 ${recordsToRename.length}건을 함께 수정 중입니다...`
          : "제품명 목록을 수정 중입니다..."
      );

      const response = await fetch(PRODUCT_OPTIONS_API_PATH, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: currentOption, nextOption }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "제품명 수정에 실패했습니다.");
      }

      for (const record of recordsToRename) {
        const updatedRecord: ReturnRecord = {
          ...record,
          productName: nextOption,
          invoicePhotos: record.invoicePhotos || [],
          productPhotos: record.productPhotos || [],
        };

        const recordResponse = await fetch("/api/records", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedRecord),
        });

        const recordData = await recordResponse.json();

        if (!recordResponse.ok) {
          throw new Error(
            recordData?.error || "기존 기록 제품명 변경에 실패했습니다."
          );
        }
      }

      applyProductOptionsResponse(
        data,
        customProductOptions.map((item) =>
          item === currentOption ? nextOption : item
        )
      );

      setRecords((prev) =>
        sortRecordsForDisplay(
          prev.map((record) =>
            normalizeProductOptionText(record.productName || "") === currentOption
              ? { ...record, productName: nextOption }
              : record
          )
        )
      );

      if (productName === currentOption) {
        setProductName(nextOption);
      }

      if (filterProduct === currentOption) {
        setFilterProduct(nextOption);
      }

      setInlineEditDraft((prev) =>
        prev && prev.productName === currentOption
          ? { ...prev, productName: nextOption }
          : prev
      );

      cancelEditProductOption();
      setStatusMessage(
        recordsToRename.length > 0
          ? `제품명 '${currentOption}'을 '${nextOption}'로 수정했고, 기존 기록 ${recordsToRename.length}건도 함께 변경했습니다.`
          : `제품명 '${currentOption}'을 '${nextOption}'로 수정했습니다.`
      );
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        error instanceof Error ? error.message : "제품명 수정에 실패했습니다."
      );
    } finally {
      setSavingProductOption(false);
    }
  }

  async function handleDeleteProductOption(option: string) {
    const currentOption = normalizeProductOptionText(option);

    if (!customProductOptions.includes(currentOption)) {
      setStatusMessage("");
      setStatusError("기본 제품명은 보호 항목이라 삭제할 수 없습니다.");
      return;
    }

    const usageCount = productUsageCounts[currentOption] || 0;
    const confirmed = window.confirm(
      `'${currentOption}' 제품명을 선택 목록에서 삭제할까요?\n기존 기록 ${usageCount}건은 삭제되지 않고 그대로 유지됩니다.`
    );

    if (!confirmed) return;

    try {
      setSavingProductOption(true);
      setStatusError("");

      const response = await fetch(PRODUCT_OPTIONS_API_PATH, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: currentOption }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "제품명 삭제에 실패했습니다.");
      }

      applyProductOptionsResponse(
        data,
        customProductOptions.filter((item) => item !== currentOption)
      );

      if (productName === currentOption) {
        setProductName("휴대용분유포트");
        setCustomProductName("");
      }

      if (filterProduct === currentOption) {
        setFilterProduct("전체");
      }

      setInlineEditDraft((prev) =>
        prev && prev.productName === currentOption
          ? { ...prev, productName: "휴대용분유포트", customProductName: "" }
          : prev
      );

      if (editingProductOption === currentOption) {
        cancelEditProductOption();
      }

      setStatusMessage(
        `제품명 '${currentOption}'을 선택 목록에서 삭제했습니다. 기존 기록은 유지됩니다.`
      );
    } catch (error) {
      setStatusMessage("");
      setStatusError(
        error instanceof Error ? error.message : "제품명 삭제에 실패했습니다."
      );
    } finally {
      setSavingProductOption(false);
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

    if (value && productOptionsForSelect.includes(value as ProductSelectValue)) {
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
      if (productOptionsForSelect.includes(normalizedProductName as ProductSelectValue)) {
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
    if (productOptionsForSelect.includes(record.productName as ProductSelectValue)) {
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
    openPanel("form");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function makeInlineEditDraft(record: ReturnRecord): InlineEditDraft {
    const isKnownProduct = productOptionsForSelect.includes(
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
        normalizeProcessActionValue(record.processAction || "미선택")
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

      upsertRecordInState(updatedRecord);
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

      upsertRecordInState(newRecord);
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
      removeRecordsFromState([record.id]);
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

    const selectedRecords = displayedRecords.filter((record) =>
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

      removeRecordsFromState(selectedRecords.map((record) => record.id));
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

  function toggleRecordPhotoButtons(recordId: string) {
    setExpandedPhotoRecordIds((prev) =>
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId]
    );
  }

  async function handleDeleteOnlyRecordPhotos(record: ReturnRecord) {
    const photoUrls = [
      ...(record.invoicePhotos || []).map((photo) => photo.url),
      ...(record.productPhotos || []).map((photo) => photo.url),
    ].filter(Boolean);

    if (photoUrls.length === 0) {
      setStatusError("삭제할 사진이 없습니다.");
      return;
    }

    const confirmed = window.confirm(
      `이 기록의 사진 ${photoUrls.length}장을 Blob에서 삭제하시겠습니까?\n텍스트 기록은 그대로 유지됩니다.\n별도 백업이 필요하면 삭제 전에 사진 링크를 먼저 보관해주세요.`
    );

    if (!confirmed) return;

    try {
      setCleaningPhotoRecordId(record.id);
      setStatusError("");
      setStatusMessage("90일 초과 사진을 삭제 중입니다...");

      const deleteResponse = await fetch("/api/delete-blob", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: photoUrls,
        }),
      });

      const deleteData = await deleteResponse.json();

      if (!deleteResponse.ok) {
        throw new Error(deleteData?.error || "사진 삭제에 실패했습니다.");
      }

      const updatedRecord: ReturnRecord = {
        ...record,
        invoicePhotos: [],
        productPhotos: [],
      };

      const saveResponse = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedRecord),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveData?.error || "사진 삭제 기록 반영에 실패했습니다.");
      }

      upsertRecordInState(updatedRecord);
      setExpandedPhotoRecordIds((prev) => prev.filter((id) => id !== record.id));
      setStatusMessage("90일 초과 사진이 삭제되었고, 텍스트 기록은 유지되었습니다.");
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "사진 정리 중 오류가 발생했습니다."
      );
    } finally {
      setCleaningPhotoRecordId(null);
    }
  }


  async function fetchRecordsForExcelDownload(rangeInfo: ExcelDownloadRangeInfo) {
    const params = new URLSearchParams();
    params.set("downloadRange", rangeInfo.range);

    if (rangeInfo.startKey && rangeInfo.endKey) {
      params.set("startDate", rangeInfo.startKey);
      params.set("endDate", rangeInfo.endKey);
    }

    const queryString = params.toString();
    const response = await fetch(`/api/records?${queryString}`, {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `${rangeInfo.label} 조회에 실패했습니다.`);
    }

    const nextRecords = Array.isArray(data.records) ? data.records : [];

    // /api/records가 날짜 쿼리를 지원하지 않는 경우에도 엑셀에는 요청한 범위만 들어가도록 한 번 더 필터링합니다.
    return sortRecordsForDisplay(filterRecordsForExcelDownload(nextRecords, rangeInfo));
  }

  async function handleDownloadExcel(range: ExcelDownloadRange) {
    if (downloadingExcelRange) return;

    const rangeInfo = getExcelDownloadRangeInfo(range, reportDateKeys);

    try {
      setDownloadingExcelRange(range);
      setStatusError("");
      setStatusMessage(`${rangeInfo.label} 엑셀 파일을 내려받는 중입니다.`);

      const recordsForDownload = await fetchRecordsForExcelDownload(rangeInfo);

      if (recordsForDownload.length === 0) {
        setStatusError(`${rangeInfo.label}에 내려받을 기록이 없습니다.`);
        setStatusMessage("");
        return;
      }

      const filename = `반품검사기록_${rangeInfo.filenameLabel}_${formatExcelIssuedDateKey()}.xlsx`;

      downloadExcel(filename, recordsForDownload);
      setStatusMessage(`${rangeInfo.label} 엑셀 다운로드가 완료되었습니다. (${recordsForDownload.length}건)`);
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "엑셀 다운로드 중 오류가 발생했습니다."
      );
      setStatusMessage("");
    } finally {
      setDownloadingExcelRange(null);
    }
  }

  function handleDownloadSearchResultsExcel() {
    if (!recordSearchSubmitted) {
      setStatusError("먼저 조회 버튼을 눌러 기록을 조회해주세요.");
      setStatusMessage("");
      return;
    }

    if (displayedRecords.length === 0) {
      setStatusError("조회 결과에 내려받을 기록이 없습니다.");
      setStatusMessage("");
      return;
    }

    const filename = `반품검사기록_조회결과_${formatExcelIssuedDateKey()}.xlsx`;
    downloadExcel(filename, displayedRecords);
    setStatusError("");
    setStatusMessage(`조회 결과 엑셀 다운로드가 완료되었습니다. (${displayedRecords.length}건)`);
  }

  function renderExcelDownloadButtons(buttonClassName = "rounded-2xl") {
    const ranges: ExcelDownloadRange[] = ["today", "week", "all"];

    return (
      <div className="flex flex-wrap gap-2">
        {ranges.map((range) => {
          const rangeInfo = getExcelDownloadRangeInfo(range, reportDateKeys);
          const isLoading = downloadingExcelRange === range;

          return (
            <Button
              key={range}
              type="button"
              variant="outline"
              onClick={() => handleDownloadExcel(range)}
              disabled={Boolean(downloadingExcelRange)}
              className={buttonClassName}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {rangeInfo.shortLabel} 엑셀
            </Button>
          );
        })}
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,rgba(45,212,191,0.18),transparent_30%),radial-gradient(circle_at_86%_4%,rgba(244,114,182,0.20),transparent_28%),linear-gradient(135deg,#f8fafc_0%,#eefdf8_40%,#fff7ed_100%)] text-slate-900">
      <div className="mx-auto max-w-[1700px] p-4 md:p-8">
        <header className="mb-5 flex flex-col gap-4 px-1 py-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-3xl font-black tracking-[0.18em] text-slate-950 md:text-4xl">
              GGUMBI
            </p>
            <span className="text-sm font-black text-cyan-700">
              엄마의 마음으로, 아이의 행복을 만듭니다.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchRecords}
              disabled={loadingRecords}
              className="rounded-2xl border-white/80 bg-white/85 shadow-sm hover:bg-white"
            >
              {loadingRecords ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              새로고침
            </Button>

            {renderExcelDownloadButtons("rounded-2xl border-white/80 bg-white/85 shadow-sm hover:bg-white")}

            <div className="hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/75 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm lg:flex">
              <Bell className="h-4 w-4 text-slate-500" />
              <User className="h-4 w-4 text-slate-500" />
              관리자님
            </div>
          </div>
        </header>

        <div className="mb-6 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="relative overflow-hidden bg-gradient-to-r from-white via-cyan-50/70 to-rose-50/80 px-5 py-6 md:px-8 md:py-8">
            <div className="absolute -right-10 top-2 h-40 w-40 rounded-full bg-cyan-200/35 blur-3xl" />
            <div className="absolute right-28 -top-8 h-32 w-32 rounded-full bg-amber-200/35 blur-3xl" />
            <div className="absolute bottom-0 right-10 hidden h-28 w-48 rotate-[-8deg] rounded-[2rem] bg-white/55 shadow-sm ring-1 ring-white/60 lg:block" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  서버 저장 · PC/모바일 동기화 · 사용량 최적화 적용
                </p>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  <span className="text-cyan-600">GGUMBI</span> 반품 검사/수리 기록 프로그램
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  대상: 모든 가전류 / 일반반품 · 변심반품 · 불량반품 · 불량교환 · AS · 검수
                </p>
                <div className="mt-4 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-semibold text-emerald-800">
                  기록은 서버에 저장되므로 PC와 휴대폰에서 동일하게 조회됩니다.
                </div>
              </div>

              <div className="relative hidden min-h-[190px] lg:block">
                <div className="absolute -right-4 top-0 h-44 w-44 rounded-full bg-gradient-to-br from-cyan-200/60 to-blue-200/30 blur-2xl" />
                <div className="absolute right-24 bottom-4 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-200/50 to-teal-100/30 blur-xl" />
                <div className="absolute right-2 top-2 h-[174px] w-[330px] rounded-[2rem] border border-white/80 bg-gradient-to-br from-sky-50/90 via-white/75 to-emerald-50/90 shadow-[0_22px_50px_rgba(15,23,42,0.10)] backdrop-blur" />

                <div className="absolute right-48 bottom-8 h-12 w-16 rotate-[-10deg] rounded-xl bg-teal-200/80 shadow-sm ring-1 ring-teal-300/40">
                  <div className="absolute left-3 top-3 h-6 w-10 rounded-lg border-2 border-teal-500/45" />
                  <div className="absolute left-6 -top-3 h-6 w-4 rounded-t-md bg-teal-300/80" />
                </div>

                <div className="absolute right-16 bottom-7 h-20 w-16 rounded-b-2xl rounded-t-md bg-emerald-100/90 shadow-sm ring-1 ring-emerald-200">
                  <div className="absolute left-7 -top-8 h-10 w-1.5 rounded-full bg-emerald-400/70" />
                  <div className="absolute left-2 -top-7 h-9 w-8 rotate-[-22deg] rounded-full bg-emerald-300/75" />
                  <div className="absolute right-0 -top-6 h-8 w-8 rotate-[24deg] rounded-full bg-teal-300/75" />
                  <div className="absolute left-3 top-5 h-2 w-10 rounded-full bg-emerald-300/70" />
                </div>

                <div className="absolute right-[118px] top-0 h-[150px] w-[116px] rotate-[3deg] rounded-[1.6rem] border border-cyan-200/70 bg-white/95 p-4 shadow-[0_18px_35px_rgba(8,145,178,0.18)]">
                  <div className="absolute left-1/2 top-[-16px] h-9 w-14 -translate-x-1/2 rounded-b-2xl rounded-t-xl bg-slate-300/80 ring-1 ring-slate-400/30">
                    <div className="mx-auto mt-2 h-3 w-3 rounded-full border-2 border-white" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="h-2 flex-1 rounded-full bg-slate-200" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl bg-gradient-to-r from-cyan-100 to-emerald-100 px-3 py-2 text-center text-xs font-black text-cyan-700">
                    GGUMBI
                  </div>
                </div>

                <div className="absolute right-[282px] top-7 rounded-full bg-white/80 px-3 py-1 text-xs font-black text-cyan-700 shadow-sm ring-1 ring-cyan-100">
                  AS · 반품 · 검수
                </div>
                <Sparkles className="absolute right-72 bottom-8 h-5 w-5 text-amber-300" />
                <Sparkles className="absolute right-8 top-10 h-4 w-4 text-cyan-300" />
              </div>
            </div>
          </div>

          {(statusMessage || statusError) && (
            <div className="space-y-2 px-5 pb-5 md:px-8">
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
            <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/85 shadow-[0_20px_55px_rgba(15,23,42,0.10)] backdrop-blur">
              <CardContent className="space-y-4 p-4">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-5 text-white shadow-sm">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
                  <div className="relative flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black tracking-[0.22em] text-cyan-200">GGUMBI TOOL</p>
                      <h2 className="mt-2 text-xl font-bold">업무 대시보드</h2>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        등록 · 조회 · 현황 · 리포트만 빠르게 이동합니다.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/12 p-3 text-cyan-100 ring-1 ring-white/10">
                      <ClipboardList className="h-8 w-8" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    메뉴
                  </p>
                  <button
                    type="button"
                    onClick={() => openPanel("form")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "form"
                        ? "border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-200"
                        : "border-slate-200 bg-white/80 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
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
                    onClick={() => openPanel("records")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "records"
                        ? "border-blue-500 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-200"
                        : "border-slate-200 bg-white/80 text-slate-700 hover:border-blue-200 hover:bg-blue-50"
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

                  <button
                    type="button"
                    onClick={() => openPanel("dashboard", { resetRange: true })}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "dashboard"
                        ? "border-violet-500 bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-sm shadow-violet-200"
                        : "border-slate-200 bg-white/80 text-slate-700 hover:border-violet-200 hover:bg-violet-50"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">검수 현황판</span>
                      <span className={`block text-xs ${activePanel === "dashboard" ? "text-slate-300" : "text-slate-500"}`}>
                        전체 · 이번달 · 이번주 · 오늘
                      </span>
                    </span>
                    <ClipboardList className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openPanel("normalizationReport", { resetRange: true })}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "normalizationReport"
                        ? "border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-200"
                        : "border-slate-200 bg-white/80 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">일반/변심 정상화 리포트</span>
                      <span className={`block text-xs ${activePanel === "normalizationReport" ? "text-emerald-100" : "text-slate-500"}`}>
                        일반 · 변심만 별도 집계
                      </span>
                    </span>
                    <CheckCircle2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openPanel("modelReport", { resetRange: true })}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activePanel === "modelReport"
                        ? "border-rose-500 bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm shadow-rose-200"
                        : "border-slate-200 bg-white/80 text-slate-700 hover:border-rose-200 hover:bg-rose-50"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">모델별 불량 리포트</span>
                      <span className={`block text-xs ${activePanel === "modelReport" ? "text-rose-100" : "text-slate-500"}`}>
                        전체 · 이번달 · 이번주 · 오늘
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
                          onClick={() => changeReportRange(option.value)}
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
                        전체 · 이번달 · 이번주 · 오늘 흐름을 한 번에 확인합니다.
                      </p>
                    </div>
                    <ClipboardList className="h-8 w-8 text-slate-600" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {reportOverviewRows.map((row) => (
                      <button
                        key={row.value}
                        type="button"
                        onClick={() => changeReportRange(row.value)}
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
                        <p className="mt-1 text-xs text-amber-300">
                          90일 초과 사진 보유 기록 {oldPhotoRecordCount}건
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

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="rounded-[2rem] shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Smartphone className="h-5 w-5 text-slate-500" />
                  모델별 정상 / 불량 건수
                </CardTitle>
                <p className="text-sm text-slate-500">
                  선택 기간의 입고 기록을 제품별 정상확인과 불량판정으로 나눕니다.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedReportSummary.modelInspectionRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    선택 기간에 집계할 모델별 기록이 없습니다.
                  </div>
                ) : (
                  selectedReportSummary.modelInspectionRows.slice(0, 8).map((row) => (
                    <div key={`dashboard-model-count-${row.productName}`} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-semibold text-slate-700">
                          {row.productName}
                        </span>
                        <span className="shrink-0 text-slate-500">
                          전체 {row.total}건
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                            <span>정상</span>
                            <span>{row.normal}건 · {row.normalRate}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${Math.max(row.normalRate, row.normal > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                            <span>불량</span>
                            <span>{row.defective}건 · {row.defectRate}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-rose-500 transition-all"
                              style={{ width: `${Math.max(row.defectRate, row.defective > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {reportRange !== "today" && (
              <Card className="rounded-[2rem] shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Clock3 className="h-5 w-5 text-slate-500" />
                    입고 추이
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {reportRange === "week"
                      ? "이번주는 일별 막대와 불량률 점선으로 확인합니다."
                      : reportRange === "month"
                        ? "이번달은 주별 막대와 불량률 점선으로 확인합니다."
                        : "전체 누적 데이터는 주별 막대와 불량률 점선으로 확인합니다."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-700">전체 입고 추이</p>
                        <p className="text-xs text-slate-500">
                          {reportRange === "week"
                            ? "전체 · 정상 · 불량을 일별 막대로 보고, 불량률은 점선으로 봅니다."
                            : "전체 · 정상 · 불량을 주별 막대로 보고, 불량률은 점선으로 봅니다."}
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {reportRange === "week" ? "일별 막대" : "주별 막대"}
                      </span>
                    </div>
                    {reportRange === "week" ? (
                      <DailyInspectionTrendChart
                        rows={selectedReportSummary.overallTrendRows}
                        startKey={reportDateKeys.weekStartKey}
                        endKey={reportDateKeys.weekEndKey}
                      />
                    ) : (
                      <WeeklyInspectionTrendChart
                        rows={selectedReportSummary.overallWeeklyTrendRows}
                        maxWeeks={reportRange === "month" ? 6 : 8}
                      />
                    )}
                  </div>

                  <div className="space-y-3 border-t pt-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-700">모델별 입고 추이</p>
                        <p className="text-xs text-slate-500">
                          {reportRange === "week"
                            ? "4개 주요 모델의 일별 입고량 변화를 비교합니다."
                            : "4개 주요 모델의 주별 입고량 변화를 비교합니다."}
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {reportRange === "week" ? "4개 주요 모델 · 일별" : "4개 주요 모델 · 주별"}
                      </span>
                    </div>
                    <ModelInspectionComparisonChart
                      modelRows={selectedReportSummary.modelInspectionRows}
                      range={reportRange}
                      dateKeys={reportDateKeys}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </div>


            )}

            {activePanel === "normalizationReport" && (
              <div className="space-y-5">
                <Card className="rounded-[2rem] border-emerald-100 bg-gradient-to-br from-white to-emerald-50 shadow-sm">
                  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-600">정상화 리포트</p>
                      <CardTitle className="mt-1 text-2xl">일반/변심 정상화 리포트</CardTitle>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        일반반품과 변심반품만 따로 모아 정상 확인, 불량 판정, 정상화율을 확인합니다.
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        제외: 불량반품 · 불량교환 · AS · 검수
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {REPORT_RANGE_OPTIONS.map((option) => (
                        <button
                          key={`normalization-range-${option.value}`}
                          type="button"
                          onClick={() => changeReportRange(option.value)}
                          className={`rounded-2xl border px-4 py-2 text-left transition ${
                            reportRange === option.value
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-200 bg-white/80 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
                          }`}
                        >
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className="block text-xs opacity-70">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-3xl border bg-white p-4">
                        <p className="text-xs font-semibold text-slate-500">전체 건수</p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                          {selectedNormalizationReportSummary.total}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">일반/변심 기준</p>
                      </div>
                      <div className="rounded-3xl border border-emerald-100 bg-white p-4">
                        <p className="text-xs font-semibold text-emerald-600">정상 확인</p>
                        <p className="mt-2 text-3xl font-bold text-emerald-600">
                          {selectedNormalizationReportSummary.normal}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">정상화 가능 건수</p>
                      </div>
                      <div className="rounded-3xl border border-rose-100 bg-white p-4">
                        <p className="text-xs font-semibold text-rose-600">불량 판정</p>
                        <p className="mt-2 text-3xl font-bold text-rose-600">
                          {selectedNormalizationReportSummary.defective}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">일반/변심 중 불량</p>
                      </div>
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-600 p-4 text-white">
                        <p className="text-xs font-semibold text-emerald-100">정상화율</p>
                        <p className="mt-2 text-3xl font-bold">
                          {selectedNormalizationReportSummary.normalRate}%
                        </p>
                        <p className="mt-1 text-xs text-emerald-100/80">정상 확인 ÷ 전체 건수</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white">
                        <p className="text-xs font-semibold text-slate-300">일반/변심 불량률</p>
                        <p className="mt-2 text-3xl font-bold">
                          {selectedNormalizationReportSummary.defectRate}%
                        </p>
                        <p className="mt-1 text-xs text-slate-400">불량 판정 ÷ 전체 건수</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] shadow-sm">
                  <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Clock3 className="h-5 w-5 text-slate-500" />
                        정상화 추이
                      </CardTitle>
                      <p className="mt-2 text-sm text-slate-500">
                        {reportRange === "today"
                          ? "오늘 일반/변심 기록의 정상 확인과 불량 판정을 확인합니다."
                          : reportRange === "week"
                            ? "이번주는 일반/변심 기록을 일별로 나눠 봅니다."
                            : "전체기록과 이번달은 일반/변심 기록을 주별로 나눠 봅니다."}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      일반/변심 전용
                    </span>
                  </CardHeader>
                  <CardContent>
                    {reportRange === "today" ? (
                      <ComboBarRateChart
                        rows={[
                          {
                            id: reportDateKeys.todayKey,
                            label: "오늘",
                            total: selectedNormalizationReportSummary.total,
                            normal: selectedNormalizationReportSummary.normal,
                            defective: selectedNormalizationReportSummary.defective,
                          },
                        ]}
                        emptyText="오늘 일반/변심 정상화 데이터가 없습니다."
                        height={300}
                      />
                    ) : reportRange === "week" ? (
                      <DailyInspectionTrendChart
                        rows={selectedNormalizationReportSummary.overallTrendRows}
                        startKey={reportDateKeys.weekStartKey}
                        endKey={reportDateKeys.weekEndKey}
                      />
                    ) : (
                      <WeeklyInspectionTrendChart
                        rows={selectedNormalizationReportSummary.overallWeeklyTrendRows}
                        maxWeeks={reportRange === "month" ? 6 : 8}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Smartphone className="h-5 w-5 text-slate-500" />
                      제품별 정상화 추이
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      일반반품과 변심반품만 기준으로 제품별 전체 건수, 정상 확인, 불량 판정을 비교합니다.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ComboBarRateChart
                      rows={normalizationProductChartRows}
                      emptyText="선택 기간에 일반/변심 제품별 정상화 데이터가 없습니다."
                      height={380}
                    />

                    {selectedNormalizationReportSummary.modelInspectionRows.length > 0 && (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {selectedNormalizationReportSummary.modelInspectionRows.map((row) => (
                          <div
                            key={`normalization-product-card-${row.productName}`}
                            className="rounded-3xl border border-slate-200 bg-white p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-slate-900">{row.productName}</p>
                                <p className="mt-1 text-sm text-slate-500">전체 {row.total}건</p>
                              </div>
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                                정상화율 {row.normalRate}%
                              </span>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                                <p className="text-xs font-semibold text-emerald-700">정상 확인</p>
                                <p className="mt-1 text-2xl font-bold text-emerald-700">{row.normal}</p>
                              </div>
                              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                                <p className="text-xs font-semibold text-rose-700">불량 판정</p>
                                <p className="mt-1 text-2xl font-bold text-rose-700">{row.defective}</p>
                              </div>
                            </div>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.max(row.normalRate, row.normal > 0 ? 4 : 0)}%` }}
                              />
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              일반/변심 불량률 {row.defectRate}%
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                        onClick={() => changeReportRange(option.value)}
                        className={`rounded-2xl border px-4 py-2 text-left transition ${
                          reportRange === option.value
                            ? "border-rose-600 bg-rose-600 text-white"
                            : "border-slate-200 bg-white/80 text-slate-700 hover:border-rose-200 hover:bg-rose-50"
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
                    <CheckCircle2 className="h-5 w-5 text-slate-500" />
                    모델별 정상 건수 / 불량 건수
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    선택 기간에 들어온 전체 모델을 기준으로 정상확인과 불량판정을 비교합니다.
                  </p>
                </CardHeader>
                <CardContent>
                  {selectedReportSummary.modelInspectionRows.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      선택 기간에 집계할 모델별 기록이 없습니다.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {selectedReportSummary.modelInspectionRows.map((row) => (
                        <div
                          key={`model-report-count-${row.productName}`}
                          className="rounded-3xl border border-slate-200 bg-white p-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900">{row.productName}</p>
                              <p className="mt-1 text-sm text-slate-500">입고 {row.total}건</p>
                            </div>
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                              {row.total}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                              <p className="text-xs font-semibold text-emerald-700">정상확인</p>
                              <p className="mt-1 text-2xl font-bold text-emerald-700">{row.normal}</p>
                              <p className="text-xs text-emerald-700/70">{row.normalRate}%</p>
                            </div>
                            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                              <p className="text-xs font-semibold text-rose-700">불량판정</p>
                              <p className="mt-1 text-2xl font-bold text-rose-700">{row.defective}</p>
                              <p className="text-xs text-rose-700/70">{row.defectRate}%</p>
                            </div>
                          </div>

                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-rose-500 transition-all"
                              style={{ width: `${Math.max(row.defectRate, row.defective > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {reportRange !== "today" && (
                <Card className="rounded-[2rem] shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Clock3 className="h-5 w-5 text-slate-500" />
                      모델별 입고 추이
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      {reportRange === "week"
                        ? "이번주는 4개 주요 모델의 일별 입고량 변화를 확인합니다."
                        : "전체기록과 이번달은 4개 주요 모델의 주별 입고량 변화를 확인합니다."}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex justify-end">
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {reportRange === "week" ? "4개 주요 모델 · 일별" : "4개 주요 모델 · 주별"}
                      </span>
                    </div>
                    <ModelInspectionComparisonChart
                      modelRows={selectedReportSummary.modelInspectionRows}
                      range={reportRange}
                      dateKeys={reportDateKeys}
                    />
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-[2rem] shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Smartphone className="h-5 w-5 text-slate-500" />
                불량 건수 / 불량내역
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
                  <div className="flex items-center justify-between gap-2">
                    <Label>제품명</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAddProductOption((nextOption) => {
                            setProductName(nextOption);
                            setCustomProductName("");
                          })
                        }
                        disabled={savingProductOption || loadingProductOptions}
                        className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="제품명 서버 추가"
                      >
                        {savingProductOption ? "저장중" : "+"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductManagerOpen(true)}
                        disabled={loadingProductOptions}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="제품명 수정/삭제"
                      >
                        관리
                      </button>
                    </div>
                  </div>
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
                      {productOptionsForSelect.map((item) => (
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
                            {getProcessActionDisplayName(item)}
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

                      {invoicePhotos.map((photo, index) => (
                        <div
                          key={photo.url}
                          className="rounded-2xl border bg-white p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-700">
                                송장사진 {index + 1}
                              </p>
                              <p className="truncate text-sm font-medium">{photo.filename}</p>
                              <p className="text-slate-500">{formatBytes(photo.size)}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => openPhotoInNewTab(photo)}
                              >
                                사진 보기
                              </Button>
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

                      {productPhotos.map((photo, index) => (
                        <div
                          key={photo.url}
                          className="rounded-2xl border bg-white p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-700">
                                제품사진 {index + 1}
                              </p>
                              <p className="truncate text-sm font-medium">{photo.filename}</p>
                              <p className="text-slate-500">{formatBytes(photo.size)}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => openPhotoInNewTab(photo)}
                              >
                                사진 보기
                              </Button>
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
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    조회한 결과만 엑셀로 내려받을 수 있습니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="min-w-[110px] whitespace-nowrap rounded-full bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700">
                    {recordSearchSubmitted ? `조회 결과 ${displayedRecords.length}건` : "조회 전"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadSearchResultsExcel}
                    disabled={!recordSearchSubmitted || displayedRecords.length === 0}
                    className="whitespace-nowrap rounded-2xl"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    조회 내려받기
                  </Button>
                </div>
              </div>

              <CardContent className="space-y-5 pt-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="space-y-3">
                <div className="grid gap-3 xl:grid-cols-[0.9fr_0.9fr_minmax(420px,2.2fr)_auto]">
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

                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      type="button"
                      className="rounded-2xl"
                      onClick={handleSearchRecords}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      조회
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl bg-white"
                      onClick={handleResetRecordSearch}
                    >
                      초기화
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

                <div className="grid gap-3 md:grid-cols-3">
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

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">이동/처리</Label>
                    <Select value={filterProcessAction} onValueChange={setFilterProcessAction}>
                      <SelectTrigger className="rounded-2xl bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="전체">전체 처리</SelectItem>
                        <SelectItem value="미선택">미선택</SelectItem>
                        <SelectItem value="안성물류이동">안성물류이동</SelectItem>
                        <SelectItem value="자체폐기">자체폐기</SelectItem>
                        <SelectItem value="원자재화">원자재화</SelectItem>
                        <SelectItem value="안성폐기">안성폐기</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAllFilteredRecordsSelected}
                    onChange={toggleSelectAllFilteredRecords}
                    disabled={!recordSearchSubmitted || displayedRecords.length === 0 || bulkDeleting}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  조회 결과 전체선택
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="whitespace-nowrap text-sm text-slate-500">
                    {recordSearchSubmitted
                      ? `조회 ${displayedRecords.length}건 / 선택 ${selectedRecordIds.length}건`
                      : "조회 전"}
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

            {!recordSearchSubmitted ? (
              <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/40 p-10 text-center text-slate-600">
                <p className="text-base font-semibold text-slate-800">조회 조건을 입력한 뒤 조회 버튼을 눌러주세요.</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  기록보기 화면에서는 처음부터 전체 기록을 펼치지 않아 화면 렌더링 부담을 줄입니다.
                </p>
              </div>
            ) : loadingRecords ? (
              <div className="flex items-center justify-center rounded-3xl border border-dashed p-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                기록 불러오는 중...
              </div>
            ) : displayedRecords.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-10 text-center text-slate-500">
                조회 조건에 맞는 기록이 없습니다.
              </div>
            ) : (
              <div className="grid gap-4">
                {displayedRecords.map((record) => {
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
                                {getProcessActionDisplayName(
                                  isInlineEditing
                                    ? inlineEditDraft.processAction
                                    : record.processAction || "미선택"
                                )}
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
                                <div className="flex items-center justify-between gap-2">
                                  <Label>제품명</Label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAddProductOption((nextOption) =>
                                          setInlineEditDraft((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  productName: nextOption,
                                                  customProductName: "",
                                                }
                                              : prev
                                          )
                                        )
                                      }
                                      disabled={savingProductOption || loadingProductOptions}
                                      className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      title="제품명 서버 추가"
                                    >
                                      {savingProductOption ? "저장중" : "+"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setProductManagerOpen(true)}
                                      disabled={loadingProductOptions}
                                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      title="제품명 수정/삭제"
                                    >
                                      관리
                                    </button>
                                  </div>
                                </div>
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
                                    {productOptionsForSelect.map((item) => (
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
                                        {getProcessActionDisplayName(item)}
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
                                  {getProcessActionDisplayName(record.processAction)}
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

                        {(() => {
                          const invoicePhotoList = record.invoicePhotos || [];
                          const productPhotoList = record.productPhotos || [];
                          const totalPhotoCount =
                            invoicePhotoList.length + productPhotoList.length;
                          const ageDays = getRecordAgeDays(record.createdAt);
                          const isExpired = isPhotoRetentionExpired(record.createdAt);
                          const isExpanded = expandedPhotoRecordIds.includes(record.id);

                          if (totalPhotoCount === 0) {
                            return (
                              <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                                등록된 사진이 없습니다.
                              </div>
                            );
                          }

                          if (isExpired) {
                            return (
                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <p className="font-bold">90일 초과 사진 정리 대상</p>
                                    <p className="mt-1 leading-6">
                                      등록 후 {ageDays ?? "90일 초과"}일 경과한 기록입니다.
                                      Blob 단순 연산 절감을 위해 사진 보기 버튼은 숨김 처리했습니다.
                                      필요 시 별도 백업 후 사진만 삭제하세요.
                                    </p>
                                    <p className="mt-1 text-xs">
                                      보유 사진: 송장 {invoicePhotoList.length}장 / 제품 {productPhotoList.length}장
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                                    onClick={() => handleDeleteOnlyRecordPhotos(record)}
                                    disabled={cleaningPhotoRecordId === record.id}
                                  >
                                    {cleaningPhotoRecordId === record.id ? "삭제 중" : "사진만 삭제"}
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="font-bold text-slate-800">사진 보관 중</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    최근 90일 이내 기록입니다. 사진 버튼은 접힘 처리되어 필요할 때만 열 수 있습니다.
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    경과일: {ageDays ?? "확인 불가"}일 / 송장 {invoicePhotoList.length}장 / 제품 {productPhotoList.length}장
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl bg-white"
                                  onClick={() => toggleRecordPhotoButtons(record.id)}
                                >
                                  {isExpanded ? "사진 버튼 닫기" : "사진 보기 버튼 열기"}
                                </Button>
                              </div>

                              {isExpanded && (
                                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                  <div>
                                    <p className="mb-2 font-medium">송장 사진</p>
                                    {invoicePhotoList.length === 0 ? (
                                      <div className="rounded-2xl border border-dashed bg-white p-4 text-sm text-slate-500">
                                        등록된 송장 사진이 없습니다.
                                      </div>
                                    ) : (
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {invoicePhotoList.map((photo, index) => (
                                          <div
                                            key={photo.url}
                                            className="rounded-2xl border bg-white p-3 text-sm"
                                          >
                                            <p className="font-semibold text-slate-700">
                                              송장사진 {index + 1}
                                            </p>
                                            <p className="mt-1 truncate font-medium">
                                              {photo.filename}
                                            </p>
                                            <p className="text-slate-500">
                                              {formatBytes(photo.size)}
                                            </p>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="mt-3 w-full rounded-xl"
                                              onClick={() => openPhotoInNewTab(photo)}
                                            >
                                              사진 보기
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <p className="mb-2 font-medium">제품 사진</p>
                                    {productPhotoList.length === 0 ? (
                                      <div className="rounded-2xl border border-dashed bg-white p-4 text-sm text-slate-500">
                                        등록된 제품 사진이 없습니다.
                                      </div>
                                    ) : (
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {productPhotoList.map((photo, index) => (
                                          <div
                                            key={photo.url}
                                            className="rounded-2xl border bg-white p-3 text-sm"
                                          >
                                            <p className="font-semibold text-slate-700">
                                              제품사진 {index + 1}
                                            </p>
                                            <p className="mt-1 truncate font-medium">
                                              {photo.filename}
                                            </p>
                                            <p className="text-slate-500">
                                              {formatBytes(photo.size)}
                                            </p>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="mt-3 w-full rounded-xl"
                                              onClick={() => openPhotoInNewTab(photo)}
                                            >
                                              사진 보기
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
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

        {productManagerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">제품명 관리</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    추가한 제품명은 수정/삭제할 수 있습니다. 기본 제품명은 OCR과 리포트 기준 보호를 위해 수정/삭제할 수 없습니다.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={fetchCustomProductOptions}
                    disabled={loadingProductOptions || savingProductOption}
                  >
                    {loadingProductOptions ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    새로고침
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => {
                      setProductManagerOpen(false);
                      cancelEditProductOption();
                    }}
                  >
                    닫기
                  </Button>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-5">
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  삭제는 선택 목록에서만 제거합니다. 이미 저장된 기존 기록과 리포트 데이터는 그대로 유지됩니다.
                </div>

                <div className="space-y-3">
                  {productManagerRows.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      등록된 제품명이 없습니다.
                    </div>
                  ) : (
                    productManagerRows.map((row) => {
                      const isEditing = editingProductOption === row.name;

                      return (
                        <div
                          key={`product-manager-${row.name}`}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <Input
                                  value={editingProductOptionValue}
                                  onChange={(e) =>
                                    setEditingProductOptionValue(e.target.value)
                                  }
                                  className="rounded-2xl bg-white"
                                  placeholder="변경할 제품명을 입력해주세요"
                                  disabled={savingProductOption}
                                />
                              ) : (
                                <p className="break-words font-bold text-slate-900">
                                  {row.name}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span
                                  className={`rounded-full px-3 py-1 font-semibold ${
                                    row.isDefault
                                      ? "bg-slate-200 text-slate-700"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {row.isDefault ? "기본 제품명" : "추가 제품명"}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-600">
                                  기존 기록 {row.usageCount}건
                                </span>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    type="button"
                                    className="rounded-2xl"
                                    onClick={() => handleRenameProductOption(row.name)}
                                    disabled={savingProductOption}
                                  >
                                    {savingProductOption ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    저장
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl"
                                    onClick={cancelEditProductOption}
                                    disabled={savingProductOption}
                                  >
                                    취소
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl"
                                    onClick={() => startEditProductOption(row.name)}
                                    disabled={row.isDefault || savingProductOption}
                                    title={
                                      row.isDefault
                                        ? "기본 제품명은 수정할 수 없습니다."
                                        : "제품명 수정"
                                    }
                                  >
                                    수정
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50"
                                    onClick={() => handleDeleteProductOption(row.name)}
                                    disabled={row.isDefault || savingProductOption}
                                    title={
                                      row.isDefault
                                        ? "기본 제품명은 삭제할 수 없습니다."
                                        : "제품명 삭제"
                                    }
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
