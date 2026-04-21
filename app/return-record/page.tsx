"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PutBlobResult } from "@vercel/blob";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Camera,
  Download,
  Filter,
  ImagePlus,
  Package,
  Search,
  Trash2,
  Upload,
  Wrench,
  XCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";

const PRODUCTS = ["휴대용분유포트", "분유쉐이커", "LED분유쉐이커"] as const;
const RETURN_TYPES = ["일반반품", "변심반품"] as const;
const INSPECTION_RESULTS = ["정상화 완료", "불량 판정"] as const;
const STORAGE_KEY = "ggumbi-return-records-v2";

type ProductName = (typeof PRODUCTS)[number];
type ReturnTypeName = (typeof RETURN_TYPES)[number];
type InspectionResult = (typeof INSPECTION_RESULTS)[number];

type PhotoItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  pathname: string;
  uploadedAt: string;
};

type ReturnRecord = {
  id: string;
  createdAt: string;
  product: ProductName;
  returnType: ReturnTypeName;
  result: InspectionResult;
  memo: string;
  invoicePhotos: PhotoItem[];
  productPhotos: PhotoItem[];
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadJSON(data: ReturnRecord[], filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(rows: ReturnRecord[], filename: string): void {
  const headers = [
    "등록일시",
    "제품명",
    "반품유형",
    "검사결과",
    "송장사진수",
    "제품사진수",
    "비고",
  ];

  const escape = (v: string | number): string =>
    `"${String(v ?? "").replaceAll('"', '""')}"`;

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      [
        formatDateTime(row.createdAt),
        row.product,
        row.returnType,
        row.result,
        row.invoicePhotos.length,
        row.productPhotos.length,
        row.memo,
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function uploadPhotos(
  files: FileList,
  folder: "invoice" | "product",
): Promise<PhotoItem[]> {
  const uploaded: PhotoItem[] = [];

  for (const file of Array.from(files)) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "업로드 실패");
    }

    const blob = (await response.json()) as PutBlobResult;

    uploaded.push({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      url: blob.url,
      pathname: blob.pathname,
      uploadedAt: new Date().toISOString(),
    });
  }

  return uploaded;
}

type StatCardProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  subtitle: string;
};

function StatCard({ title, value, icon: Icon, subtitle }: StatCardProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className="rounded-2xl border p-3">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type PhotoGridProps = {
  title: string;
  photos: PhotoItem[];
};

function PhotoGrid({ title, photos }: PhotoGridProps) {
  if (!photos.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-2xl border bg-white"
          >
            <img
              src={photo.url}
              alt={photo.name}
              className="h-28 w-full object-cover"
            />
            <div className="truncate px-2 py-1 text-xs text-slate-500">
              {photo.name}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function ReturnRecordApp() {
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const productInputRef = useRef<HTMLInputElement | null>(null);

  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [product, setProduct] = useState<ProductName>(PRODUCTS[0]);
  const [returnType, setReturnType] = useState<ReturnTypeName>(RETURN_TYPES[0]);
  const [result, setResult] = useState<InspectionResult>(INSPECTION_RESULTS[0]);
  const [memo, setMemo] = useState("");
  const [invoicePhotos, setInvoicePhotos] = useState<PhotoItem[]>([]);
  const [productPhotos, setProductPhotos] = useState<PhotoItem[]>([]);
  const [query, setQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState("전체");
  const [filterResult, setFilterResult] = useState("전체");
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ReturnRecord[];
        setRecords(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchQuery =
        !query ||
        [r.product, r.returnType, r.result, r.memo]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());

      const matchProduct = filterProduct === "전체" || r.product === filterProduct;
      const matchResult = filterResult === "전체" || r.result === filterResult;

      return matchQuery && matchProduct && matchResult;
    });
  }, [records, query, filterProduct, filterResult]);

  const stats = useMemo(() => {
    const normal = records.filter((r) => r.result === "정상화 완료").length;
    const bad = records.filter((r) => r.result === "불량 판정").length;

    return {
      total: records.length,
      normal,
      bad,
      photos: records.reduce(
        (sum, r) => sum + r.invoicePhotos.length + r.productPhotos.length,
        0,
      ),
    };
  }, [records]);

  const resetForm = (): void => {
    setProduct(PRODUCTS[0]);
    setReturnType(RETURN_TYPES[0]);
    setResult(INSPECTION_RESULTS[0]);
    setMemo("");
    setInvoicePhotos([]);
    setProductPhotos([]);
    setSaveError("");

    if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    if (productInputRef.current) productInputRef.current.value = "";
  };

  const handleAddRecord = (): void => {
    setSaveError("");

    if (isUploadingInvoice || isUploadingProduct) {
      setSaveError("사진 업로드가 끝난 뒤에 기록 저장을 눌러주세요.");
      return;
    }

    const newRecord: ReturnRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      product,
      returnType,
      result,
      memo,
      invoicePhotos,
      productPhotos,
    };

    setRecords((prev) => [newRecord, ...prev]);
    resetForm();
  };

  const handleDelete = (id: string): void => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleInvoiceUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      setSaveError("");
      setIsUploadingInvoice(true);
      const uploaded = await uploadPhotos(files, "invoice");
      setInvoicePhotos((prev) => [...prev, ...uploaded]);
    } catch (error) {
      console.error(error);
      setSaveError("송장 사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingInvoice(false);
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    }
  };

  const handleProductUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      setSaveError("");
      setIsUploadingProduct(true);
      const uploaded = await uploadPhotos(files, "product");
      setProductPhotos((prev) => [...prev, ...uploaded]);
    } catch (error) {
      console.error(error);
      setSaveError("제품 사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingProduct(false);
      if (productInputRef.current) productInputRef.current.value = "";
    }
  };

  const removePhoto = (type: "invoice" | "product", id: string): void => {
    if (type === "invoice") {
      setInvoicePhotos((prev) => prev.filter((p) => p.id !== id));
      return;
    }

    setProductPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                3종 반품 검사/수리 기록 프로그램
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                대상: 휴대용분유포트 · 분유쉐이커 · LED분유쉐이커 / 일반반품 · 변심반품
              </p>
              <p className="mt-1 text-sm text-slate-500">
                링크맘에서 검사 및 수리 후 정상화 제품과 불량 제품을 구분하고, 송장
                사진 중심으로 기록을 남기는 용도입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => downloadCSV(records, "반품기록.csv")}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV 내보내기
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadJSON(records, "반품기록백업.json")}
              >
                <Download className="mr-2 h-4 w-4" />
                백업 저장
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="전체 기록"
            value={stats.total}
            subtitle="누적 등록 건수"
            icon={Package}
          />
          <StatCard
            title="정상화 완료"
            value={stats.normal}
            subtitle="안성 물류 재고추가 대상"
            icon={Wrench}
          />
          <StatCard
            title="불량 판정"
            value={stats.bad}
            subtitle="안성 물류 폐기 대상"
            icon={XCircle}
          />
          <StatCard
            title="사진 수"
            value={stats.photos}
            subtitle="송장/제품 사진 합계"
            icon={Camera}
          />
        </div>

        <Tabs defaultValue="write" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl">
            <TabsTrigger value="write">기록 등록</TabsTrigger>
            <TabsTrigger value="list">기록 조회</TabsTrigger>
          </TabsList>

          <TabsContent value="write">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <CardTitle>새 기록 등록</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>제품명</Label>
                      <Select
                        value={product}
                        onValueChange={(value) => setProduct(value as ProductName)}
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCTS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>반품유형</Label>
                      <Select
                        value={returnType}
                        onValueChange={(value) =>
                          setReturnType(value as ReturnTypeName)
                        }
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
                      <Label>검사결과</Label>
                      <Select
                        value={result}
                        onValueChange={(value) =>
                          setResult(value as InspectionResult)
                        }
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INSPECTION_RESULTS.map((item) => (
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
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      className="min-h-[120px] rounded-2xl"
                      placeholder="예: 검사 완료 후 정상화 / 모터 불량으로 불량 판정 / 안성물류 송장 매칭 완료 등"
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">송장 사진</p>
                          <p className="text-xs text-slate-500">
                            주문번호 대신 송장 사진으로 기록
                          </p>
                        </div>
                        <Label htmlFor="invoice-upload" className="cursor-pointer">
                          <div className="inline-flex items-center rounded-2xl border px-3 py-2 text-sm">
                            <ImagePlus className="mr-2 h-4 w-4" />
                            업로드
                          </div>
                        </Label>
                      </div>

                      <Input
                        ref={invoiceInputRef}
                        id="invoice-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        className="hidden"
                        onChange={handleInvoiceUpload}
                      />

                      {(isUploadingInvoice || !!invoicePhotos.length) && (
                        <div className="space-y-3">
                          {isUploadingInvoice && (
                            <div className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              송장 사진 업로드 중...
                            </div>
                          )}

                          {!!invoicePhotos.length && (
                            <div className="grid grid-cols-2 gap-3">
                              {invoicePhotos.map((photo) => (
                                <div
                                  key={photo.id}
                                  className="relative overflow-hidden rounded-2xl border"
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.name}
                                    className="h-28 w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto("invoice", photo.id)}
                                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-2xl border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">제품 사진</p>
                          <p className="text-xs text-slate-500">
                            필요 시 외관/불량 상태 함께 저장
                          </p>
                        </div>
                        <Label htmlFor="product-upload" className="cursor-pointer">
                          <div className="inline-flex items-center rounded-2xl border px-3 py-2 text-sm">
                            <Upload className="mr-2 h-4 w-4" />
                            업로드
                          </div>
                        </Label>
                      </div>

                      <Input
                        ref={productInputRef}
                        id="product-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        className="hidden"
                        onChange={handleProductUpload}
                      />

                      {(isUploadingProduct || !!productPhotos.length) && (
                        <div className="space-y-3">
                          {isUploadingProduct && (
                            <div className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              제품 사진 업로드 중...
                            </div>
                          )}

                          {!!productPhotos.length && (
                            <div className="grid grid-cols-2 gap-3">
                              {productPhotos.map((photo) => (
                                <div
                                  key={photo.id}
                                  className="relative overflow-hidden rounded-2xl border"
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.name}
                                    className="h-28 w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePhoto("product", photo.id)}
                                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {saveError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {saveError}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="rounded-2xl"
                      onClick={handleAddRecord}
                      disabled={isUploadingInvoice || isUploadingProduct}
                    >
                      기록 저장
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={resetForm}
                    >
                      입력 초기화
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <CardTitle>기록 기준</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div className="rounded-2xl border p-4">
                    <p className="font-medium text-slate-900">운영 흐름</p>
                    <ol className="mt-2 list-decimal space-y-2 pl-5">
                      <li>3종 제품의 일반반품/변심반품은 링크맘 입고</li>
                      <li>검사 및 수리 후 정상화 완료 / 불량 판정 구분</li>
                      <li>들어온 송장과 매칭하여 기록 남김</li>
                      <li>안성물류센터 전달</li>
                      <li>안성물류: 정상품 재고 추가 / 불량품 폐기 처리</li>
                    </ol>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <p className="font-medium text-slate-900">기록 팁</p>
                    <ul className="mt-2 list-disc space-y-2 pl-5">
                      <li>주문번호는 생략하고 송장 사진으로 대체 가능</li>
                      <li>제품 사진은 외관 상태나 불량 흔적 기록용</li>
                      <li>비고란에 수리 여부, 매칭 여부, 특이사항만 간단히 남기면 됨</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="list">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>기록 조회</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="제품명, 반품유형, 결과, 비고 검색"
                      className="rounded-2xl pl-9"
                    />
                  </div>

                  <div>
                    <Select value={filterProduct} onValueChange={setFilterProduct}>
                      <SelectTrigger className="rounded-2xl">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="전체">전체 제품</SelectItem>
                        {PRODUCTS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Select value={filterResult} onValueChange={setFilterResult}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="전체">전체 결과</SelectItem>
                        {INSPECTION_RESULTS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredRecords.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">
                      아직 등록된 기록이 없어요.
                    </div>
                  ) : (
                    filteredRecords.map((record) => (
                      <motion.div
                        key={record.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card className="rounded-3xl border shadow-sm">
                          <CardContent className="p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{record.product}</Badge>
                                  <Badge variant="outline">{record.returnType}</Badge>
                                  <Badge className="rounded-full">{record.result}</Badge>
                                </div>
                                <p className="text-sm text-slate-500">
                                  등록일시: {formatDateTime(record.createdAt)}
                                </p>
                                {record.memo && (
                                  <p className="text-sm leading-6 text-slate-700">
                                    {record.memo}
                                  </p>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" className="rounded-2xl">
                                      상세보기
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-4xl">
                                    <DialogHeader>
                                      <DialogTitle>
                                        {record.product} / {record.returnType}
                                      </DialogTitle>
                                    </DialogHeader>

                                    <div className="space-y-5 text-sm">
                                      <div className="grid gap-3 md:grid-cols-3">
                                        <div className="rounded-2xl border p-3">
                                          <span className="text-slate-500">검사결과</span>
                                          <div className="mt-1 font-medium">
                                            {record.result}
                                          </div>
                                        </div>
                                        <div className="rounded-2xl border p-3">
                                          <span className="text-slate-500">송장 사진</span>
                                          <div className="mt-1 font-medium">
                                            {record.invoicePhotos.length}장
                                          </div>
                                        </div>
                                        <div className="rounded-2xl border p-3">
                                          <span className="text-slate-500">제품 사진</span>
                                          <div className="mt-1 font-medium">
                                            {record.productPhotos.length}장
                                          </div>
                                        </div>
                                      </div>

                                      {record.memo && (
                                        <div className="rounded-2xl border p-4">
                                          <p className="mb-2 font-medium">비고</p>
                                          <p className="whitespace-pre-wrap leading-6 text-slate-700">
                                            {record.memo}
                                          </p>
                                        </div>
                                      )}

                                      <PhotoGrid
                                        title="송장 사진"
                                        photos={record.invoicePhotos}
                                      />
                                      <PhotoGrid
                                        title="제품 사진"
                                        photos={record.productPhotos}
                                      />
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                <Button
                                  variant="outline"
                                  className="rounded-2xl"
                                  onClick={() => handleDelete(record.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  삭제
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}