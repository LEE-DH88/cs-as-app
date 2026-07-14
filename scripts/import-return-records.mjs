import { google } from "googleapis";
import XLSX from "xlsx";
import { basename, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

const RECORDS_SHEET_NAME = "반품기록";
const SOURCE_FILE = process.env.IMPORT_XLSX_FILE || "data/반품검사기록_전체_20260713.xlsx";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 없습니다.`);
  return value;
}

function clients() {
  const auth = new google.auth.OAuth2(
    required("GOOGLE_STORAGE_CLIENT_ID"),
    required("GOOGLE_STORAGE_CLIENT_SECRET")
  );
  auth.setCredentials({ refresh_token: required("GOOGLE_STORAGE_REFRESH_TOKEN") });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function photoUrl(fileId) {
  return `/api/photos/${encodeURIComponent(fileId)}`;
}

function fileNameFromUrl(url, fallback) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || fallback);
  } catch {
    return fallback;
  }
}

async function uploadBlobPhoto({ drive, folderId, url, fallbackName }) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileNameFromUrl(url, fallbackName),
      mimeType: contentType,
      parents: [folderId],
    },
    media: { mimeType: contentType, body: Readable.from(buffer) },
    fields: "id,name,mimeType,size",
  });

  const driveFileId = text(created.data.id);
  if (!driveFileId) throw new Error("Google Drive 파일 ID를 받지 못했습니다.");
  return {
    driveFileId,
    filename: text(created.data.name) || fallbackName,
    size: Number(created.data.size) || buffer.length,
    contentType: text(created.data.mimeType) || contentType,
    url: photoUrl(driveFileId),
  };
}

function linkedPhotoUrls(worksheet, rowIndex, startColumn, count) {
  const urls = [];
  for (let offset = 0; offset < count; offset += 1) {
    const cellAddress = XLSX.utils.encode_cell({ c: startColumn + offset, r: rowIndex });
    const target = worksheet[cellAddress]?.l?.Target;
    if (typeof target === "string" && target.startsWith("http")) urls.push(target);
  }
  return urls;
}

async function main() {
  const spreadsheetId = required("GOOGLE_SHEETS_ID");
  const folderId = required("GOOGLE_DRIVE_FOLDER_ID");
  const { sheets, drive } = clients();
  const sourcePath = resolve(SOURCE_FILE);
  const workbook = XLSX.readFile(sourcePath);
  const worksheet = workbook.Sheets["반품검사기록"];
  if (!worksheet) throw new Error("엑셀에 '반품검사기록' 시트가 없습니다.");

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${RECORDS_SHEET_NAME}'!A2:A` });
  const existingIds = new Set((existing.data.values || []).map((row) => text(row[0])));
  const migratedRows = [];
  const photoFailures = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const id = `legacy-20260713-${String(index + 1).padStart(4, "0")}`;
    if (existingIds.has(id)) continue;

    const worksheetRowIndex = index + 1;
    const invoicePhotos = [];
    const productPhotos = [];
    const groups = [
      { target: invoicePhotos, urls: linkedPhotoUrls(worksheet, worksheetRowIndex, 9, 2), label: "송장" },
      { target: productPhotos, urls: linkedPhotoUrls(worksheet, worksheetRowIndex, 11, 4), label: "제품" },
    ];

    for (const group of groups) {
      for (let photoIndex = 0; photoIndex < group.urls.length; photoIndex += 1) {
        const url = group.urls[photoIndex];
        try {
          group.target.push(
            await uploadBlobPhoto({
              drive,
              folderId,
              url,
              fallbackName: `${id}-${group.label}-${photoIndex + 1}.jpg`,
            })
          );
        } catch (error) {
          photoFailures.push({ id, url, error: error instanceof Error ? error.message : String(error) });
          console.warn(`[사진 건너뜀] ${id} ${url}`);
        }
      }
    }

    const createdDate = text(row["등록일자"]);
    migratedRows.push([
      id,
      createdDate ? `${createdDate.slice(0, 10)}T00:00:00.000Z` : new Date().toISOString(),
      text(row["송장번호"]),
      text(row["주문번호"]),
      text(row["고객명"]),
      text(row["반품유형"]),
      text(row["제품명"]),
      text(row["이동/처리"]) || "미선택",
      text(row["검사결과"]),
      text(row["비고"]),
      JSON.stringify(invoicePhotos.map(({ url, ...photo }) => photo)),
      JSON.stringify(productPhotos.map(({ url, ...photo }) => photo)),
      "",
    ]);
    console.log(`이관 준비: ${index + 1}/${rows.length} (${text(row["제품명"]) || "제품명 미입력"})`);
  }

  if (migratedRows.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${RECORDS_SHEET_NAME}'!A:M`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: migratedRows },
    });
  }

  console.log(`완료: 기록 ${migratedRows.length}건을 Google Sheets로 이관했습니다.`);
  console.log(`사진 실패: ${photoFailures.length}건`);
  if (photoFailures.length) {
    console.log(JSON.stringify(photoFailures, null, 2));
  }
  console.log(`원본 파일: ${basename(sourcePath)}`);
}

main().catch((error) => {
  console.error(`이관 실패: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
