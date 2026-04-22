"use client";

import React, {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  Download,
  FileImage,
  Loader2,
  Package,
  Search,
  Trash2,
  Upload,
  User,
  X,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  RefreshCcw,
} from "lucide-react";

type ReturnType =
  | "일반반품"
  | "변심반품"
  | "불량반품"
  | "불량교환"
  | "AS"
  | "검수";

type ProductType =
  | "휴대용분유포트"
  | "분유쉐이커"
  | "LED분유쉐이커"
  | "일반반품"
  | "변심반품"
  | "기타";

type ResultType = "정상화 완료" | "불량 판정" | "검사 대기";

type UploadedImage = {
  url: string;
  name: string;
  size: number;
};

type ReturnRecord = {
  id: string;
  registeredAt: string;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  returnType: ReturnType;
  productName: string;
  result: ResultType;
  note: string;
  invoicePhotos: UploadedImage[];
  productPhotos: UploadedImage[];
};

type UploadFolder = "invoice" | "product";

const STORAGE_KEY = "ggumbi-return-records-v2";

const RETURN_TYPE_OPTIONS: ReturnType[] = [
  "일반반품",
  "변심반품",
  "불량반품",
  "불량교환",
  "AS",
  "검수",
];

const PRODUCT_OPTIONS: ProductType[] = [
  "휴대용분유포트",
  "분유쉐이커",
  "LED분유쉐이커",
  "일반반품",
  "변심반품",
  "기타",
];

const RESULT_OPTIONS: ResultType[] = ["검사 대기", "정상화 완료", "불량 판정"];

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function escapeCsv(value: string): string {
  const normalized = value ?? "";
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function normalizeRecords(raw: unknown): ReturnRecord[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Partial<ReturnRecord> & {
        invoicePhotos?: Array<string | UploadedImage>;
        productPhotos?: Array<string | UploadedImage>;
      };

      const normalizePhotos = (
        photos: Array<string | UploadedImage> | undefined
      ): UploadedImage[] => {
        if (!Array.isArray(photos)) return [];
        return photos
          .map((photo) => {
            if (typeof photo === "string") {
              return {
                url: photo,
                name: photo.split("/").pop() || "image.jpg",
                size: 0,
              };
            }
            if (
              photo &&
              typeof photo === "object" &&
              typeof photo.url === "string"
            ) {
              return {
                url: photo.url,
                name: photo.name || photo.url.split("/").pop() || "image.jpg",
                size: Number(photo.size || 0),
              };
            }
            return null;
          })
          .filter((photo): photo is UploadedImage => Boolean(photo));
      };

      return {
        id: String(record.id || crypto.randomUUID()),
        registeredAt: String(record.registeredAt || new Date().toISOString()),
        invoiceNumber: String(record.invoiceNumber || ""),
        orderNumber: String(record.orderNumber || ""),
        customerName: String(record.customerName || ""),
        returnType: (record.returnType as ReturnType) || "일반반품",
        productName: String(record.productName || "기타"),
        result: (record.result as ResultType) || "검사 대기",
        note: String(record.note || ""),
        invoicePhotos: normalizePhotos(record.invoicePhotos),
        productPhotos: normalizePhotos(record.productPhotos),
      };
    })
    .filter((record): record is ReturnRecord => Boolean(record));
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = imageUrl;
    });

    const maxWidth = 1800;
    const maxHeight = 1800;

    let { width, height } = img;

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.78);
    });

    if (!blob) return file;

    const compressedName = file.name.replace(/\.[^.]+$/, "") + ".jpg";

    if (blob.size >= file.size) {
      return file;
    }

    return new File([blob], compressedName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function uploadImages(
  files: File[],
  folder: UploadFolder
): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];

  for (const originalFile of files) {
    const file = await compressImage(originalFile);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "업로드 실패");
    }

    const data = await response.json();

    uploaded.push({
      url: data.url,
      name: file.name,
      size: file.size,
    });
  }

  return uploaded;
}

export default function ReturnRecordApp() {
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"register" | "records">("register");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [returnType, setReturnType] = useState<ReturnType>("일반반품");
  const [productName, setProductName] = useState<string>("휴대용분유포트");
  const [result, setResult] = useState<ResultType>("검사 대기");
  const [note, setNote] = useState("");

  const [invoicePhotos, setInvoicePhotos] = useState<UploadedImage[]>([]);
  const [productPhotos, setProductPhotos] = useState<UploadedImage[]>([]);

  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [filterProduct, setFilterProduct] = useState("전체 제품");
  const [filterResult, setFilterResult] = useState("전체 결과");
  const [selectedRecord, setSelectedRecord] = useState<ReturnRecord | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const productInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setRecords(normalizeRecords(parsed));
    } catch (error) {
      console.error("기록 불러오기 실패", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const totalPhotoCount = useMemo(() => {
    return records.reduce(
      (sum, record) =>
        sum + record.invoicePhotos.length + record.productPhotos.length,
      0
    );
  }, [records]);

  const totalPhotoBytes = useMemo(() => {
    return records.reduce((sum, record) => {
      const invoiceSize = record.invoicePhotos.reduce(
        (acc, photo) => acc + (photo.size || 0),
        0
      );
      const productSize = record.productPhotos.reduce(
        (acc, photo) => acc + (photo.size || 0),
        0
      );
      return sum + invoiceSize + productSize;
    }, 0);
  }, [records]);

  const normalCount = useMemo(
    () => records.filter((record) => record.result === "정상화 완료").length,
    [records]
  );

  const defectiveCount = useMemo(
    () => records.filter((record) => record.result === "불량 판정").length,
    [records]
  );

  const pendingCount = useMemo(
    () => records.filter((record) => record.result === "검사 대기").length,
    [records]
  );

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        const text = searchText.trim().toLowerCase();

        const matchesText =
          !text ||
          [
            record.invoiceNumber,
            record.orderNumber,
            record.customerName,
            record.returnType,
            record.productName,
            record.result,
            record.note,
          ]
            .join(" ")
            .toLowerCase()
            .includes(text);

        const matchesProduct =
          filterProduct === "전체 제품" || record.productName === filterProduct;

        const matchesResult =
          filterResult === "전체 결과" || record.result === filterResult;

        return matchesText && matchesProduct && matchesResult;
      })
      .sort(
        (a, b) =>
          new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
      );
  }, [records, searchText, filterProduct, filterResult]);

  const resetForm = (): void => {
    setInvoiceNumber("");
    setOrderNumber("");
    setCustomerName("");
    setReturnType("일반반품");
    setProductName("휴대용분유포트");
    setResult("검사 대기");
    setNote("");
    setInvoicePhotos([]);
    setProductPhotos([]);
    setErrorMessage("");
    if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    if (productInputRef.current) productInputRef.current.value = "";
  };

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    folder: UploadFolder
  ): Promise<void> => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setErrorMessage("");

    try {
      if (folder === "invoice") setIsUploadingInvoice(true);
      if (folder === "product") setIsUploadingProduct(true);

      const limit = folder === "invoice" ? 2 : 4;
      const currentPhotos = folder === "invoice" ? invoicePhotos : productPhotos;

      if (currentPhotos.length + files.length > limit) {
        throw new Error(
          folder === "invoice"
            ? `송장 사진은 최대 ${limit}장까지 업로드할 수 있습니다.`
            : `제품 사진은 최대 ${limit}장까지 업로드할 수 있습니다.`
        );
      }

      const uploaded = await uploadImages(files, folder);

      if (folder === "invoice") {
        setInvoicePhotos((prev) => [...prev, ...uploaded]);
      } else {
        setProductPhotos((prev) => [...prev, ...uploaded]);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "사진 업로드 중 오류가 발생했습니다."
      );
    } finally {
      if (folder === "invoice") setIsUploadingInvoice(false);
      if (folder === "product") setIsUploadingProduct(false);
      event.target.value = "";
    }
  };

  const removePhotoFromForm = async (
    folder: UploadFolder,
    targetUrl: string
  ): Promise<void> => {
    const confirmed = window.confirm("이 사진을 업로드 목록에서 제거하시겠습니까?");
    if (!confirmed) return;

    try {
      await fetch("/api/delete-blob", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls: [targetUrl] }),
      });

      if (folder === "invoice") {
        setInvoicePhotos((prev) => prev.filter((photo) => photo.url !== targetUrl));
      } else {
        setProductPhotos((prev) => prev.filter((photo) => photo.url !== targetUrl));
      }
    } catch (error) {
      console.error(error);
      alert("사진 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleSave = async (): Promise<void> => {
    setErrorMessage("");

    if (!productName.trim()) {
      setErrorMessage("제품명을 입력해주세요.");
      return;
    }

    if (invoicePhotos.length === 0) {
      setErrorMessage("송장 사진은 최소 1장 필요합니다.");
      return;
    }

    try {
      setIsSaving(true);

      const newRecord: ReturnRecord = {
        id: crypto.randomUUID(),
        registeredAt: new Date().toISOString(),
        invoiceNumber: invoiceNumber.trim(),
        orderNumber: orderNumber.trim(),
        customerName: customerName.trim(),
        returnType,
        productName: productName.trim(),
        result,
        note: note.trim(),
        invoicePhotos,
        productPhotos,
      };

      setRecords((prev) => [newRecord, ...prev]);
      resetForm();
      setActiveTab("records");
    } catch (error) {
      console.error(error);
      setErrorMessage("기록 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    const target = records.find((record) => record.id === id);
    if (!target) return;

    const confirmed = window.confirm(
      "삭제하시겠습니까?\n기록과 연결된 사진도 Blob 저장소에서 함께 삭제됩니다."
    );
    if (!confirmed) return;

    try {
      setDeletingId(id);

      const urls = [
        ...target.invoicePhotos.map((photo) => photo.url),
        ...target.productPhotos.map((photo) => photo.url),
      ].filter(Boolean);

      if (urls.length > 0) {
        const response = await fetch("/api/delete-blob", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ urls }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Blob 사진 삭제 실패");
        }
      }

      setRecords((prev) => prev.filter((record) => record.id !== id));

      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error(error);
      alert("기록 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const downloadCsv = (): void => {
    const header = [
      "등록일자",
      "송장번호",
      "주문번호",
      "고객명",
      "반품유형",
      "제품명",
      "검사결과",
      "비고",
      "송장사진수",
      "제품사진수",
    ];

    const rows = filteredRecords.map((record) => [
      formatDateTime(record.registeredAt),
      record.invoiceNumber,
      record.orderNumber,
      record.customerName,
      record.returnType,
      record.productName,
      record.result,
      record.note,
      String(record.invoicePhotos.length),
      String(record.productPhotos.length),
    ]);

    const csv = [
      header.join(","),
      ...rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `반품기록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({
    title,
    value,
    sub,
    icon,
  }: {
    title: string;
    value: string | number;
    sub: string;
    icon: React.ReactNode;
  }) => (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</div>
      </div>
      <p className="text-sm text-slate-500">{sub}</p>
    </div>
  );

  const PhotoGrid = ({
    photos,
    title,
    onRemove,
  }: {
    photos: UploadedImage[];
    title: string;
    onRemove?: (url: string) => void;
  }) => {
    if (photos.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          등록된 사진이 없습니다.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((photo) => (
          <div
            key={photo.url}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <a href={photo.url} target="_blank" rel="noreferrer">
              <img
                src={photo.url}
                alt={photo.name}
                className="h-32 w-full object-cover"
              />
            </a>
            <div className="space-y-2 p-3">
              <p className="truncate text-xs text-slate-600">{photo.name}</p>
              <p className="text-xs text-slate-400">{formatBytes(photo.size)}</p>
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(photo.url)}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  제거
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-7 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  3종 반품 검사/수리 기록 프로그램
                </h1>
                <p className="mt-2 text-sm text-slate-200">
                  대상: 휴대용분유포트 · 분유쉐이커 · LED분유쉐이커 · 일반반품 · 변심반품
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  송장/제품 사진을 기반으로 반품 기록을 남기고, 정상화/불량 판정을 관리합니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  <Download className="h-4 w-4" />
                  CSV 내려받기
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  입력 초기화
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              title="전체 기록"
              value={records.length}
              sub="누적 등록 건수"
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <StatCard
              title="정상화 완료"
              value={normalCount}
              sub="재고 추가 가능 대상"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              title="불량 판정"
              value={defectiveCount}
              sub="폐기/불량 처리 대상"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatCard
              title="검사 대기"
              value={pendingCount}
              sub="후속 확인 필요"
              icon={<Package className="h-5 w-5" />}
            />
            <StatCard
              title="사진 사용량"
              value={formatBytes(totalPhotoBytes)}
              sub={`총 ${totalPhotoCount}장 저장`}
              icon={<ImageIcon className="h-5 w-5" />}
            />
          </div>

          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("register")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === "register"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                기록 등록
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("records")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === "records"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                기록 조회
              </button>
            </div>
          </div>

          <div className="px-4 pb-6">
            {activeTab === "register" ? (
              <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900">새 기록 등록</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    사진은 자동 압축 후 업로드되어 저장공간 사용량을 줄입니다.
                  </p>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        송장번호
                      </label>
                      <input
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="예: 1234567890"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        주문번호
                      </label>
                      <input
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="예: 20260421-0001"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        고객명
                      </label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="예: 홍길동"
                          className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        반품유형
                      </label>
                      <select
                        value={returnType}
                        onChange={(e) => setReturnType(e.target.value as ReturnType)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      >
                        {RETURN_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        제품명
                      </label>
                      <select
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      >
                        {PRODUCT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        검사결과
                      </label>
                      <select
                        value={result}
                        onChange={(e) => setResult(e.target.value as ResultType)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      >
                        {RESULT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      비고
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={5}
                      placeholder="예: 검사 완료 후 정상화 / 모터 불량으로 불량 판정 / 안성물류 송장 매칭 완료 등"
                      className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">송장 사진</h3>
                          <p className="text-sm text-slate-500">
                            최대 2장 / 필수 / 자동 압축 업로드
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => invoiceInputRef.current?.click()}
                          disabled={isUploadingInvoice}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUploadingInvoice ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          업로드
                        </button>
                      </div>

                      <input
                        ref={invoiceInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => void handleUpload(e, "invoice")}
                      />

                      <PhotoGrid
                        photos={invoicePhotos}
                        title="송장 사진"
                        onRemove={(url) => void removePhotoFromForm("invoice", url)}
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">제품 사진</h3>
                          <p className="text-sm text-slate-500">
                            최대 4장 / 선택 / 외관/불량 상태 기록
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => productInputRef.current?.click()}
                          disabled={isUploadingProduct}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUploadingProduct ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          업로드
                        </button>
                      </div>

                      <input
                        ref={productInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => void handleUpload(e, "product")}
                      />

                      <PhotoGrid
                        photos={productPhotos}
                        title="제품 사진"
                        onRemove={(url) => void removePhotoFromForm("product", url)}
                      />
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        <>
                          <ClipboardList className="h-4 w-4" />
                          기록 저장
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      입력 초기화
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900">운영 기준</h3>
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <ol className="space-y-2 text-sm leading-6 text-slate-700">
                        <li>1. 3종 제품 및 일반/변심 반품은 사진 기준으로 기록합니다.</li>
                        <li>2. 송장사진은 주문번호 대체 확인 자료로 활용 가능합니다.</li>
                        <li>3. 검사 후 정상화 / 불량 판정 / 검사 대기로 구분합니다.</li>
                        <li>4. 제품 사진은 외관 상태, 침수 흔적, 불량 흔적 기록용입니다.</li>
                        <li>5. 삭제 시 기록과 사진이 함께 제거되므로 신중히 처리합니다.</li>
                      </ol>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900">실사용 개선 포인트</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">1. 사진 용량 관리</p>
                        <p className="mt-1">
                          업로드 전 자동 압축, 송장 2장 / 제품 4장 제한으로 저장공간 낭비를 줄였습니다.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">2. 검색성 강화</p>
                        <p className="mt-1">
                          송장번호, 주문번호, 고객명으로 검색 가능하게 구성했습니다.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">3. 보고/공유용 CSV</p>
                        <p className="mt-1">
                          등록일자, 송장번호, 주문번호, 고객명, 반품유형, 제품명, 검사결과, 비고까지 내려받을 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">기록 조회</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      제품명, 반품유형, 결과, 고객명, 송장번호, 주문번호, 비고로 검색할 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadCsv}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Download className="h-4 w-4" />
                    CSV 내려받기
                  </button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.45fr_0.45fr]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="제품명, 반품유형, 결과, 고객명, 송장번호, 주문번호, 비고 검색"
                      className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <select
                    value={filterProduct}
                    onChange={(e) => setFilterProduct(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option>전체 제품</option>
                    {PRODUCT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterResult}
                    onChange={(e) => setFilterResult(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option>전체 결과</option>
                    {RESULT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  {filteredRecords.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                      <p className="text-sm text-slate-500">아직 등록된 기록이 없어요.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredRecords.map((record) => (
                        <div
                          key={record.id}
                          className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                                  {record.productName}
                                </span>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {record.returnType}
                                </span>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    record.result === "정상화 완료"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : record.result === "불량 판정"
                                        ? "bg-rose-100 text-rose-700"
                                        : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {record.result}
                                </span>
                              </div>

                              <div>
                                <p className="text-sm text-slate-400">
                                  등록일자: {formatDateTime(record.registeredAt)}
                                </p>
                                <p className="mt-1 text-base font-semibold text-slate-900">
                                  고객명: {record.customerName || "-"}
                                </p>
                              </div>

                              <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                <p>송장번호: {record.invoiceNumber || "-"}</p>
                                <p>주문번호: {record.orderNumber || "-"}</p>
                                <p>송장 사진: {record.invoicePhotos.length}장</p>
                                <p>제품 사진: {record.productPhotos.length}장</p>
                              </div>

                              <p className="line-clamp-2 text-sm text-slate-600">
                                비고: {record.note || "-"}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedRecord(record)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                <FileImage className="h-4 w-4" />
                                상세보기
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleDelete(record.id)}
                                disabled={deletingId === record.id}
                                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingId === record.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    삭제 중...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4" />
                                    삭제
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {selectedRecord.productName} / {selectedRecord.returnType}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  등록일자: {formatDateTime(selectedRecord.registeredAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-2xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">검사결과</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {selectedRecord.result}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">송장번호</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {selectedRecord.invoiceNumber || "-"}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">주문번호</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {selectedRecord.orderNumber || "-"}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">고객명</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {selectedRecord.customerName || "-"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">비고</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {selectedRecord.note || "-"}
              </p>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-slate-500" />
                  <h4 className="font-bold text-slate-900">
                    송장 사진 ({selectedRecord.invoicePhotos.length}장)
                  </h4>
                </div>
                <PhotoGrid photos={selectedRecord.invoicePhotos} title="송장 사진" />
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-slate-500" />
                  <h4 className="font-bold text-slate-900">
                    제품 사진 ({selectedRecord.productPhotos.length}장)
                  </h4>
                </div>
                <PhotoGrid photos={selectedRecord.productPhotos} title="제품 사진" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}