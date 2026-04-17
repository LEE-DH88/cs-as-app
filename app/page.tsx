"use client";

import { useState, useMemo } from "react";
import type { CSSProperties } from "react";

type ResultItem = {
  product: string;
  symptom: string;
  title: string;
  causes: string[];
  firstAction: string[];
  asNeed: string;
  asLevel: "low" | "medium" | "high";
  parts: string[];
  csPoint: string;
};

const sampleResults: Record<string, ResultItem> = {
  E1: {
    product: "젖병살균세척기",
    symptom: "물 과주입",
    title: "급수 이상",
    causes: ["물 과주입"],
    firstAction: ["물 제거 후 재작동"],
    asNeed: "필요 시 AS",
    asLevel: "low",
    parts: ["급수펌프", "순환기"],
    csPoint: "과주입 안내 필수",
  },
  E3: {
    product: "젖병살균세척기",
    symptom: "누수 데미지",
    title: "펌프 손상",
    causes: ["누수로 인한 손상"],
    firstAction: ["사용 중지"],
    asNeed: "AS 필요",
    asLevel: "high",
    parts: ["급수펌프", "세척펌프", "배수펌프"],
    csPoint: "즉시 AS 안내",
  },
  E4: {
    product: "젖병살균세척기",
    symptom: "화면 오류",
    title: "LCD 문제",
    causes: ["LCD 불량"],
    firstAction: ["재부팅"],
    asNeed: "AS 필요",
    asLevel: "medium",
    parts: ["LCD", "와이어"],
    csPoint: "모델별 안내",
  },
  E5: {
    product: "젖병살균세척기",
    symptom: "화면 오류",
    title: "LCD 문제",
    causes: ["LCD 불량"],
    firstAction: ["재부팅"],
    asNeed: "AS 필요",
    asLevel: "medium",
    parts: ["LCD", "와이어"],
    csPoint: "모델별 안내",
  },
  E6: {
    product: "젖병살균세척기",
    symptom: "가열 불량",
    title: "히터 문제",
    causes: ["가열판 이상"],
    firstAction: ["전원 재시작"],
    asNeed: "AS 필요",
    asLevel: "high",
    parts: ["가열판", "세척펌프"],
    csPoint: "즉시 AS 권장",
  },
};

const statusStyle = {
  low: { label: "낮음", color: "green" },
  medium: { label: "보통", color: "orange" },
  high: { label: "높음", color: "red" },
};

export default function Page() {
  const [query, setQuery] = useState("E3");

  const normalized = query.trim().toUpperCase();

  const result = useMemo(
    () => sampleResults[normalized] || null,
    [normalized]
  );

  const currentStatus = result
    ? statusStyle[result.asLevel]
    : statusStyle.low;

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "12px",
    marginBottom: "12px",
  };

  const btnStyle = (active: boolean): CSSProperties => ({
    padding: "10px",
    marginRight: "6px",
    background: active ? "#4f46e5" : "#e5e7eb",
    color: active ? "white" : "black",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>CS 진단 앱</h2>

      <input
        style={inputStyle}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="E코드 입력"
      />

      {["E1", "E3", "E4", "E5", "E6"].map((code) => (
        <button
          key={code}
          style={btnStyle(code === normalized)}
          onClick={() => setQuery(code)}
        >
          {code}
        </button>
      ))}

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>{result.title}</h3>
          <p>증상: {result.symptom}</p>
          <p>원인: {result.causes.join(", ")}</p>
          <p>조치: {result.firstAction.join(", ")}</p>
          <p>AS: {result.asNeed}</p>
          <p style={{ color: currentStatus.color }}>
            위험도: {currentStatus.label}
          </p>
        </div>
      )}
    </div>
  );
}