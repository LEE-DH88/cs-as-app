"use client";

import { useState } from "react";

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      alert("파일을 선택해주세요.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/test-vision-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            success: false,
            error: error instanceof Error ? error.message : "알 수 없는 오류",
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Vision 업로드 테스트</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={handleUpload} disabled={loading}>
          {loading ? "테스트 중..." : "업로드 테스트"}
        </button>
      </div>

      <pre
        style={{
          marginTop: 20,
          background: "#f4f4f4",
          padding: 16,
          whiteSpace: "pre-wrap",
        }}
      >
        {result}
      </pre>
    </main>
  );
}