"use client";

export default function CSASDiagnosisApp() {
  const React = require("react");
  const { useMemo, useState } = React;
type ResultItem = {
  product: string;
  symptom: string;
  title: string;
  causes: string[];
  firstAction: string[];
  asNeed: string;
  asLevel: string;
  parts: string[];
  csPoint: string;
};
  const sampleResults: Record<string, ResultItem> = {
    E1: {
      product: "젖병살균세척기",
      symptom: "E1",
      title: "물 과주입 영향 + 급수 계통 점검 필요",
      causes: [
        "물 과주입으로 인한 내부 영향 발생 가능성",
        "급수펌프 이상 가능성",
        "순환기 이상 가능성",
      ],
      firstAction: [
        "물 주입량을 기준 이하로 조정",
        "전원을 끄고 1회 재작동 진행",
        "동일 증상이 반복되는지 확인",
      ],
      asNeed: "반복 발생 시 AS 점검 필요",
      asLevel: "medium",
      parts: ["급수펌프", "순환기"],
      csPoint:
        "물 과주입으로 발생할 수 있는 증상이지만 반복될 경우 내부 부품 영향 가능성이 있으므로 동일 증상 지속 시 AS 접수 안내가 필요합니다.",
    },
    E3: {
      product: "젖병살균세척기",
      symptom: "E3",
      title: "누수 영향으로 펌프류 손상 가능",
      causes: [
        "물 과주입으로 인한 내부 누수 발생 가능성",
        "누수로 인해 내부 부품에 수분 영향 발생 가능성",
        "급수펌프 / 세척펌프 / 배수펌프 손상 가능성",
      ],
      firstAction: [
        "제품 내부 수분 제거 및 충분한 건조 진행",
        "전원을 끄고 재작동 진행",
        "물 주입량을 기준 이하로 조정",
      ],
      asNeed: "반복 발생 또는 작동 이상 시 AS 점검 필요",
      asLevel: "high",
      parts: ["급수펌프", "세척펌프", "배수펌프"],
      csPoint:
        "초기에는 일시적 오류일 수 있으나 누수가 지속되면 부품 손상으로 이어질 수 있어 반복 시 빠른 AS 접수 안내가 필요합니다.",
    },
    E4: {
      product: "젖병살균세척기",
      symptom: "E4 / E5",
      title: "디스플레이 계열 부품 점검 필요",
      causes: [
        "LCD 모듈 불량 가능성",
        "LCD 와이어 하네스 접촉 불량 또는 단선 가능성",
      ],
      firstAction: ["전원을 끄고 재작동 진행", "동일 증상 반복 여부 확인"],
      asNeed: "대부분 부품 문제로 AS 점검 필요",
      asLevel: "high",
      parts: ["1·2세대: LCD 교체", "3세대: LCD 와이어하네스 교체"],
      csPoint:
        "사용 문제보다는 디스플레이 관련 부품 이상 가능성이 높은 케이스이며 제품 세대에 따라 수리 방법이 달라질 수 있습니다.",
    },
    E5: {
      product: "젖병살균세척기",
      symptom: "E4 / E5",
      title: "디스플레이 계열 부품 점검 필요",
      causes: [
        "LCD 모듈 불량 가능성",
        "LCD 와이어 하네스 접촉 불량 또는 단선 가능성",
      ],
      firstAction: ["전원을 끄고 재작동 진행", "동일 증상 반복 여부 확인"],
      asNeed: "대부분 부품 문제로 AS 점검 필요",
      asLevel: "high",
      parts: ["1·2세대: LCD 교체", "3세대: LCD 와이어하네스 교체"],
      csPoint:
        "사용 문제보다는 디스플레이 관련 부품 이상 가능성이 높은 케이스이며 제품 세대에 따라 수리 방법이 달라질 수 있습니다.",
    },
    E6: {
      product: "젖병살균세척기",
      symptom: "E6",
      title: "가열 계통 또는 세척펌프 점검 필요",
      causes: ["가열판 이상 가능성", "세척펌프 이상 가능성"],
      firstAction: ["전원을 끄고 재작동 진행", "동일 증상 반복 여부 확인"],
      asNeed: "대부분 내부 부품 이상으로 AS 점검 필요",
      asLevel: "high",
      parts: ["가열판", "세척펌프"],
      csPoint:
        "사용 문제로 해결되는 경우는 드물며 내부 부품 이상 가능성이 높아 빠른 AS 접수 안내가 권장됩니다.",
    },
  };

  const [product, setProduct] = useState("젖병살균세척기");
  const [query, setQuery] = useState("E3");

  const normalized = query.trim().toUpperCase();
  const result = useMemo(() => sampleResults[normalized] || null, [normalized]);

  const codeButtons = ["E1", "E3", "E4", "E5", "E6"];

  const pageStyle = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
    padding: "28px",
  };

  const shellStyle = {
    maxWidth: "1200px",
    margin: "0 auto",
  };

  const heroStyle = {
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%)",
    color: "white",
    borderRadius: "28px",
    padding: "28px",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
    marginBottom: "24px",
  };

  const badgeStyle = {
    display: "inline-block",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    fontSize: "13px",
    marginRight: "8px",
    marginTop: "8px",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "20px",
  };

  const cardStyle = {
    background: "white",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 12px 35px rgba(15, 23, 42, 0.08)",
    border: "1px solid #e2e8f0",
  };

  const sectionTitle = {
    fontSize: "18px",
    fontWeight: 700,
    margin: "0 0 14px 0",
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #cbd5e1",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  };

  const smallLabel = {
    fontSize: "13px",
    fontWeight: 700,
    color: "#475569",
    marginBottom: "8px",
    display: "block",
  };

  const quickWrap = {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "8px",
  };

  const quickBtn = (active) => ({
    padding: "10px 14px",
    borderRadius: "999px",
    border: active ? "1px solid #4338ca" : "1px solid #cbd5e1",
    background: active ? "#eef2ff" : "white",
    color: active ? "#312e81" : "#334155",
    fontWeight: 700,
    cursor: "pointer",
  });

  const statusStyle = {
    low: { background: "#ecfdf5", color: "#065f46", label: "안내 후 경과 확인" },
    medium: { background: "#fff7ed", color: "#9a3412", label: "반복 시 AS 권장" },
    high: { background: "#fef2f2", color: "#991b1b", label: "AS 우선 안내" },
  };

  const currentStatus = result ? statusStyle[result.asLevel] : statusStyle.low;

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={heroStyle}>
          <div style={{ fontSize: "14px", opacity: 0.85, marginBottom: "8px" }}>GGUMBI CS Assistant Prototype</div>
          <div style={{ fontSize: "34px", fontWeight: 800, lineHeight: 1.2 }}>
            CS 직원이 바로 쓰는<br />
            <span style={{ color: "#c7d2fe" }}>AS 진단 지식 앱</span>
          </div>
          <div style={{ marginTop: "14px", fontSize: "15px", lineHeight: 1.6, color: "#e2e8f0", maxWidth: "760px" }}>
            제품명과 증상코드만 입력하면, 기존 개선품질 데이터와 AS 경험을 바탕으로 가능 원인, 1차 조치,
            AS 필요 여부, CS 안내 멘트를 즉시 확인하는 발표용 프로토타입입니다.
          </div>
          <div style={{ marginTop: "12px" }}>
            <span style={badgeStyle}>CS 반복문의 감소</span>
            <span style={badgeStyle}>응답 표준화</span>
            <span style={badgeStyle}>AS 경험 데이터 재활용</span>
          </div>
        </div>

        <div style={gridStyle}>
          <div style={cardStyle}>
            <div style={sectionTitle}>검색 조건</div>

            <label style={smallLabel}>제품명</label>
            <input
              style={inputStyle}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="예: 젖병살균세척기"
            />

            <div style={{ height: "16px" }} />

            <label style={smallLabel}>증상코드 / 증상명</label>
            <input
              style={inputStyle}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: E3"
            />

            <div style={{ marginTop: "16px" }}>
              <div style={smallLabel}>빠른 선택</div>
              <div style={quickWrap}>
                {codeButtons.map((code) => (
                  <button key={code} style={quickBtn(normalized === code)} onClick={() => setQuery(code)}>
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                borderRadius: "18px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>발표 포인트</div>
              <div style={{ fontSize: "14px", color: "#475569", lineHeight: 1.7 }}>
                • CS가 AS에 반복 문의하던 내용을 즉시 확인<br />
                • 코드 기반 응답을 표준화된 데이터 응대로 전환<br />
                • 향후 자연어 검색과 더 많은 제품 확장 가능
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {result ? (
              <>
                <div style={{ ...cardStyle, paddingBottom: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "6px" }}>{product}</div>
                      <div style={{ fontSize: "28px", fontWeight: 800 }}>{result.symptom}</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "#334155", marginTop: "6px" }}>{result.title}</div>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "999px",
                        background: currentStatus.background,
                        color: currentStatus.color,
                        fontWeight: 800,
                        fontSize: "14px",
                      }}
                    >
                      {currentStatus.label}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div style={cardStyle}>
                    <div style={sectionTitle}>가능 원인</div>
                    {result.causes.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" }}>
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: "#eef2ff",
                            color: "#3730a3",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div style={{ fontSize: "15px", lineHeight: 1.6, color: "#334155" }}>{item}</div>
                      </div>
                    ))}
                  </div>

                  <div style={cardStyle}>
                    <div style={sectionTitle}>1차 조치 방법</div>
                    {result.firstAction.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "flex-start" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1", marginTop: "8px", flexShrink: 0 }} />
                        <div style={{ fontSize: "15px", lineHeight: 1.6, color: "#334155" }}>{item}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div style={cardStyle}>
                    <div style={sectionTitle}>AS 필요 여부</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", lineHeight: 1.6 }}>{result.asNeed}</div>
                  </div>

                  <div style={cardStyle}>
                    <div style={sectionTitle}>연관 부품 / 조치 기준</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {result.parts.map((part, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 14px",
                            borderRadius: "999px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#334155",
                          }}
                        >
                          {part}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={sectionTitle}>CS 안내 멘트</div>
                  <div
                    style={{
                      background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
                      border: "1px solid #dbeafe",
                      borderRadius: "18px",
                      padding: "18px",
                      fontSize: "15px",
                      lineHeight: 1.8,
                      color: "#334155",
                    }}
                  >
                    {result.csPoint}
                  </div>
                </div>
              </>
            ) : (
              <div style={cardStyle}>
                <div style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>검색 결과가 없습니다</div>
                <div style={{ fontSize: "15px", color: "#64748b", lineHeight: 1.7 }}>
                  현재는 젖병살균세척기의 E1, E3, E4, E5, E6 예시 데이터가 들어가 있습니다.<br />
                  추후에는 제품명 + 자연어 증상 검색까지 확장할 수 있습니다.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
