"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Download, Filter, ImagePlus, Package, Search, Trash2, Upload, Wrench, XCircle } from "lucide-react";
import { motion } from "framer-motion";

const PRODUCTS = ["휴대용분유포트", "분유쉐이커", "LED분유쉐이커"];
const RETURN_TYPES = ["일반반품", "변심반품"];
const INSPECTION_RESULTS = ["정상화 완료", "불량 판정"];
const STORAGE_KEY = "ggumbi-return-records-v1";

// ✅ 여기 수정됨 (핵심)
function formatDateTime(value: string) {
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

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(rows: any[], filename: string) {
  const headers = ["등록일시","제품명","반품유형","검사결과","송장사진수","제품사진수","비고"];
  const escape = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      [
        formatDateTime(row.createdAt),
        row.product,
        row.returnType,
        row.result,
        row.invoicePhotos?.length ?? 0,
        row.productPhotos?.length ?? 0,
        row.memo,
      ].map(escape).join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readFilesAsDataUrls(fileList: FileList) {
  return Promise.all(
    Array.from(fileList).map(
      (file) =>
        new Promise<any>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: crypto.randomUUID(),
              name: file.name,
              type: file.type,
              size: file.size,
              dataUrl: reader.result,
            });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}

function StatCard({ title, value, icon: Icon, subtitle }: any) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReturnRecordApp() {
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const productInputRef = useRef<HTMLInputElement | null>(null);

  const [records, setRecords] = useState<any[]>([]);
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [returnType, setReturnType] = useState(RETURN_TYPES[0]);
  const [result, setResult] = useState(INSPECTION_RESULTS[0]);
  const [memo, setMemo] = useState("");
  const [invoicePhotos, setInvoicePhotos] = useState<any[]>([]);
  const [productPhotos, setProductPhotos] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setRecords(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const handleAddRecord = () => {
    const newRecord = {
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
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">반품 기록 프로그램</h1>
      <Button onClick={handleAddRecord}>테스트 저장</Button>
    </div>
  );
}
