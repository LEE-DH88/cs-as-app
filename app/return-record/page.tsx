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
  | "직접입력";

type ProcessAction =
  | "미선택"
  | "안성물류이동"
  | "안성물류폐기이동"
  | "자체폐기"
  | "자체 B급활용";

type InspectionResult =
  | "검사 대기"
  | "정상화 완료"
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
  "정상화 완료",
  "불량 판정",
  "후속 확인 필요",
];

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

  // 노션 처리현황에는 아래 4종 제품만 포함
  // 젖병살균세척기 등 기타 제품은 B급활용이어도 제외
  const productMap: Record<string, string> = {
    "휴대용분유포트": "[꿈비] 휴대용 분유포트",
    "(분리형) 휴대용분유포트": "[꿈비] 분리형 휴대용 분유포트",
    "분유쉐이커": "[꿈비] 분유쉐이커",
    "LED분유쉐이커": "[꿈비] 뭉침없이 조용한 분유쉐이커",
  };

  return productMap[normalized] || "";
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
  // 자체폐기는 노션 처리현황에 기재하지 않음
  if (record.processAction === "자체폐기") {
    return "";
  }

  // 자체 B급활용은 원자재화로 기재
  if (record.processAction === "자체 B급활용") {
    return "원자재화";
  }

  // 정상화 완료는 재상품화로 기재
  if (record.inspectionResult === "정상화 완료") {
    return "재상품화";
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

  const [invoicePhotos, setInvoicePhotos] = useState<UploadedPhoto[]>([]);
  const [productPhotos, setProductPhotos] = useState<UploadedPhoto[]>([]);

  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingProduct, setUploadingProduct] = useState(false);

  const [isRecordSearchOpen, setIsRecordSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [filterProduct, setFilterProduct] = useState<string>("전체");
  const [filterResult, setFilterResult] = useState<string>("전체");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const summary = useMemo(() => {
    const total = records.length;
    const normal = records.filter((r) => r.inspectionResult === "정상화 완료").length;
    const defective = records.filter((r) => r.inspectionResult === "불량 판정").length;
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
        filterResult === "전체" || record.inspectionResult === filterResult;

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

    if (value && PRODUCT_TYPES.includes(value as ProductSelectValue)) {
      return value;
    }

    return value || "";
  }

  function detectReturnType(parsed: OcrParsedResult) {
    const text = `${parsed.returnType || ""} ${parsed.rawText || ""}`.toUpperCase();

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

  function applyOcrResult(parsed: OcrParsedResult) {
    const detectedInvoiceNumber = parsed.trackingNumber || parsed.invoiceNumber;

    if (detectedInvoiceNumber) setInvoiceNumber(detectedInvoiceNumber);
    if (parsed.orderNumber) setOrderNumber(parsed.orderNumber);
    if (parsed.customerName) setCustomerName(parsed.customerName);

    const detectedReturnType = detectReturnType(parsed);
    if (detectedReturnType) {
      setReturnType(detectedReturnType);
    }

    const normalizedProductName = normalizeProductName(
      parsed.productName,
      parsed.rawText
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

    setOcrRawText(parsed.rawText || "");
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
    setProcessAction(record.processAction || "미선택");
    setInspectionResult(record.inspectionResult);
    setNote(record.note || "");
    setInvoicePhotos(record.invoicePhotos || []);
    setProductPhotos(record.productPhotos || []);

    setStatusMessage("수정할 기록을 불러왔습니다. 내용 수정 후 수정 저장을 눌러주세요.");
    setStatusError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function makeInlineEditDraft(record: ReturnRecord): InlineEditDraft {
    const isKnownProduct = PRODUCT_TYPES.includes(
      record.productName as ProductSelectValue
    );

    return {
      invoiceNumber: record.invoiceNumber || "",
      orderNumber: record.orderNumber || "",
      customerName: record.customerName || "",
      returnType: record.returnType,
      productName: isKnownProduct
        ? (record.productName as ProductSelectValue)
        : "직접입력",
      customProductName: isKnownProduct ? "" : record.productName || "",
      processAction: record.processAction || "미선택",
      inspectionResult: record.inspectionResult,
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
      processAction: inlineEditDraft.processAction,
      inspectionResult: inlineEditDraft.inspectionResult,
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
      processAction,
      inspectionResult,
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
                대상: 휴대용분유포트 · (분리형) 휴대용분유포트 · 분유쉐이커 · LED분유쉐이커 / 일반반품 ·
                변심반품 · 불량반품 · 불량교환 · AS · 검수
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

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-slate-500">전체 기록</p>
                <p className="mt-2 text-3xl font-bold">{summary.total}</p>
                <p className="mt-1 text-xs text-slate-500">누적 등록 건수</p>
              </div>
              <ClipboardList className="h-10 w-10 text-slate-300" />
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-slate-500">정상화 완료</p>
                <p className="mt-2 text-3xl font-bold">{summary.normal}</p>
                <p className="mt-1 text-xs text-slate-500">재고 추가 가능 대상</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-slate-300" />
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-slate-500">불량 판정</p>
                <p className="mt-2 text-3xl font-bold">{summary.defective}</p>
                <p className="mt-1 text-xs text-slate-500">폐기/불량 처리 대상</p>
              </div>
              <XCircle className="h-10 w-10 text-slate-300" />
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-slate-500">후속 확인 필요</p>
                <p className="mt-2 text-3xl font-bold">{summary.followUp}</p>
                <p className="mt-1 text-xs text-slate-500">추가 점검 대상</p>
              </div>
              <Clock3 className="h-10 w-10 text-slate-300" />
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-slate-500">사진 사용량</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatBytes(summary.totalPhotoSize)}
                </p>
                <p className="mt-1 text-xs text-slate-500">저장된 사진 총합</p>
              </div>
              <Database className="h-10 w-10 text-slate-300" />
            </CardContent>
          </Card>
        </div>

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
                    onValueChange={(value) =>
                      setInspectionResult(value as InspectionResult)
                    }
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
                      {PROCESS_ACTIONS.map((item) => (
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
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="예: 검사 완료 후 정상화 / 모터 불량으로 불량 판정 / 안성물류 송장 매칭 완료 등"
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

        <Card className="mt-6 overflow-hidden rounded-3xl border-slate-200 bg-white/95 shadow-sm">
          <button
            type="button"
            onClick={() => setIsRecordSearchOpen((prev) => !prev)}
            className="flex w-full flex-col gap-4 p-6 text-left transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-slate-500">기록 관리</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                기록 조회 및 삭제
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                평소에는 접어두고, 필요한 날짜만 펼쳐서 조회하거나 선택 삭제할 수 있습니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                조회 결과 {filteredRecords.length}건
              </span>
              <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                {isRecordSearchOpen ? "접기 ▲" : "열기 ▼"}
              </span>
            </div>
          </button>

          {isRecordSearchOpen && (
            <CardContent className="space-y-5 border-t border-slate-100 pt-6">
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
                                  onValueChange={(value) =>
                                    setInlineEditDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            inspectionResult:
                                              value as InspectionResult,
                                          }
                                        : prev
                                    )
                                  }
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
                                    {PROCESS_ACTIONS.map((item) => (
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
          )}
        </Card>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <Card className="rounded-3xl border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">하단 안내</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">운영 가이드</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 group-open:hidden">
                    열기 ▼
                  </span>
                  <span className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white group-open:inline-block">
                    접기 ▲
                  </span>
                </summary>

                <div className="border-t border-slate-100 p-6 pt-5">
                  <ol className="space-y-3 rounded-3xl border bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                    <li>1. 반품 입고 후 송장 사진 기준으로 먼저 등록합니다.</li>
                    <li>2. 주문번호, 고객명은 확인 가능한 범위만 입력해도 됩니다.</li>
                    <li>3. 검사 전에는 ‘검사 대기’로 저장해두고, 판정 후에는 기록 조회에서 바로 수정합니다.</li>
                    <li>4. 제품 사진은 외관, 침수 흔적, 불량 흔적 위주로 남기면 됩니다.</li>
                    <li>5. 삭제 시 기록과 연결된 사진이 함께 삭제됩니다.</li>
                  </ol>
                </div>
              </details>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">하단 안내</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">실사용 기준 요약</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 group-open:hidden">
                    열기 ▼
                  </span>
                  <span className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white group-open:inline-block">
                    접기 ▲
                  </span>
                </summary>

                <div className="grid gap-4 border-t border-slate-100 p-6 pt-5 md:grid-cols-2">
                  <div className="rounded-3xl border bg-slate-50 p-5">
                    <div className="mb-2 flex items-center gap-2 text-base font-semibold">
                      <Smartphone className="h-5 w-5" />
                      PC/휴대폰 동시 조회
                    </div>
                    <p className="text-sm leading-6 text-slate-700">
                      서버 저장 방식이라 사무실 PC에서 등록한 기록을 휴대폰에서도 그대로 확인할 수 있습니다.
                    </p>
                  </div>

                  <div className="rounded-3xl border bg-slate-50 p-5">
                    <div className="mb-2 flex items-center gap-2 text-base font-semibold">
                      <Camera className="h-5 w-5" />
                      사진 용량 낭비 최소화
                    </div>
                    <p className="text-sm leading-6 text-slate-700">
                      업로드 전에 자동 압축 처리되고, 송장 2장 / 제품 4장 제한으로 저장공간 사용량을 줄입니다.
                    </p>
                  </div>

                  <div className="rounded-3xl border bg-slate-50 p-5">
                    <div className="mb-2 flex items-center gap-2 text-base font-semibold">
                      <Search className="h-5 w-5" />
                      날짜 범위 조회
                    </div>
                    <p className="text-sm leading-6 text-slate-700">
                      하루만 볼 때는 시작일과 종료일을 같은 날짜로 넣으면 됩니다.
                    </p>
                  </div>

                  <div className="rounded-3xl border bg-amber-50 p-5">
                    <div className="mb-2 flex items-center gap-2 text-base font-semibold text-amber-900">
                      <AlertTriangle className="h-5 w-5" />
                      추천 운영 방식
                    </div>
                    <p className="text-sm leading-6 text-amber-900">
                      입고 즉시 1차 등록 → 판정 후 검사결과/비고 보완 → 필요 시 엑셀 공유 흐름으로 쓰면 됩니다.
                    </p>
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
