import { google } from "googleapis";
import { Readable } from "node:stream";

export type AppPhoto = {
  url: string;
  filename: string;
  size: number;
  contentType?: string;
  driveFileId?: string;
};

export type AppReturnRecord = {
  id: string;
  createdAt: string;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  returnType: string;
  productName: string;
  processAction?: string;
  inspectionResult: string;
  note: string;
  invoicePhotos: AppPhoto[];
  productPhotos: AppPhoto[];
};

const RECORDS_SHEET_NAME = "반품기록";
const SETTINGS_SHEET_NAME = "설정";

const RECORD_HEADERS = [
  "프로그램 ID",
  "등록일시",
  "송장번호",
  "주문번호",
  "고객명",
  "반품유형",
  "제품명",
  "이동/처리",
  "검사결과",
  "비고",
  "송장 사진 JSON",
  "제품 사진 JSON",
  "삭제일시",
];

const SETTINGS_HEADERS = ["설정명", "값"];

function getRequiredEnv(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} 환경변수가 누락되었습니다.`);
  return value;
}

function getGoogleClients() {
  const auth = new google.auth.OAuth2(
    getRequiredEnv(process.env.GOOGLE_STORAGE_CLIENT_ID, "GOOGLE_STORAGE_CLIENT_ID"),
    getRequiredEnv(process.env.GOOGLE_STORAGE_CLIENT_SECRET, "GOOGLE_STORAGE_CLIENT_SECRET")
  );
  auth.setCredentials({
    refresh_token: getRequiredEnv(process.env.GOOGLE_STORAGE_REFRESH_TOKEN, "GOOGLE_STORAGE_REFRESH_TOKEN"),
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

function spreadsheetId() {
  return getRequiredEnv(process.env.GOOGLE_SHEETS_ID, "GOOGLE_SHEETS_ID");
}

function driveFolderId() {
  return getRequiredEnv(process.env.GOOGLE_DRIVE_FOLDER_ID, "GOOGLE_DRIVE_FOLDER_ID");
}

function normalized(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dateOnly(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function photoUrl(fileId: string) {
  return `/api/photos/${encodeURIComponent(fileId)}`;
}

function parsePhotos(value: unknown): AppPhoto[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [];
    const photos: AppPhoto[] = [];
    for (const photo of parsed) {
      const driveFileId = normalized(photo?.driveFileId);
      if (!driveFileId) continue;
      const contentType = normalized(photo?.contentType);
      photos.push({
        url: photoUrl(driveFileId),
        filename: normalized(photo?.filename) || "반품 사진",
        size: Number(photo?.size) || 0,
        ...(contentType ? { contentType } : {}),
        driveFileId,
      });
    }
    return photos;
  } catch {
    return [];
  }
}

function stringifyPhotos(photos: AppPhoto[]) {
  return JSON.stringify(
    photos
      .filter((photo) => photo.driveFileId)
      .map((photo) => ({
        driveFileId: photo.driveFileId,
        filename: photo.filename,
        size: photo.size,
        contentType: photo.contentType || "",
      }))
  );
}

function recordToRow(record: AppReturnRecord, deletedAt = "") {
  return [
    record.id,
    record.createdAt,
    record.invoiceNumber,
    record.orderNumber,
    record.customerName,
    record.returnType,
    record.productName,
    record.processAction || "미선택",
    record.inspectionResult,
    record.note,
    stringifyPhotos(record.invoicePhotos),
    stringifyPhotos(record.productPhotos),
    deletedAt,
  ];
}

function rowToRecord(row: string[]): AppReturnRecord | null {
  const id = normalized(row[0]);
  if (!id || normalized(row[12])) return null;

  return {
    id,
    createdAt: normalized(row[1]),
    invoiceNumber: normalized(row[2]),
    orderNumber: normalized(row[3]),
    customerName: normalized(row[4]),
    returnType: normalized(row[5]),
    productName: normalized(row[6]),
    processAction: normalized(row[7]) || "미선택",
    inspectionResult: normalized(row[8]),
    note: normalized(row[9]),
    invoicePhotos: parsePhotos(row[10]),
    productPhotos: parsePhotos(row[11]),
  };
}

async function getValues(range: string) {
  const { sheets } = getGoogleClients();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range,
  });
  return (response.data.values || []).map((row) => row.map((cell) => String(cell ?? "")));
}

async function appendRow(range: string, values: string[]) {
  const { sheets } = getGoogleClients();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function updateRow(range: string, values: string[]) {
  const { sheets } = getGoogleClients();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

async function recordsWithRowNumbers() {
  const values = await getValues(`'${RECORDS_SHEET_NAME}'!A:M`);
  if (values.length === 0) {
    throw new Error("Google Sheets에 '반품기록' 시트가 없습니다. 설정 안내의 초기화 단계를 먼저 진행해주세요.");
  }

  return values.slice(1).map((row, index) => ({ row, rowNumber: index + 2 }));
}

export async function listReturnRecords(options?: { startDate?: string; endDate?: string }) {
  const records = (await recordsWithRowNumbers())
    .map(({ row }) => rowToRecord(row))
    .filter((record): record is AppReturnRecord => record !== null)
    .filter((record) => {
      const date = dateOnly(record.createdAt);
      if (options?.startDate && date < options.startDate) return false;
      if (options?.endDate && date > options.endDate) return false;
      return true;
    });

  return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveReturnRecord(record: AppReturnRecord) {
  const rows = await recordsWithRowNumbers();
  const existing = rows.find(({ row }) => normalized(row[0]) === record.id);

  if (existing) {
    await updateRow(`'${RECORDS_SHEET_NAME}'!A${existing.rowNumber}:M${existing.rowNumber}`, recordToRow(record));
  } else {
    await appendRow(`'${RECORDS_SHEET_NAME}'!A:M`, recordToRow(record));
  }

  return record;
}

export async function saveReturnRecords(records: AppReturnRecord[]) {
  for (const record of records) {
    await saveReturnRecord(record);
  }
}

export async function trashReturnRecord(record: AppReturnRecord) {
  const rows = await recordsWithRowNumbers();
  const existing = rows.find(({ row }) => normalized(row[0]) === record.id);

  if (!existing) throw new Error("삭제할 Google Sheets 기록을 찾지 못했습니다.");

  const photoIds = [...record.invoicePhotos, ...record.productPhotos]
    .map((photo) => photo.driveFileId)
    .filter((id): id is string => Boolean(id));

  const { drive } = getGoogleClients();
  await Promise.all(
    photoIds.map(async (fileId) => {
      try {
        await drive.files.delete({ fileId, supportsAllDrives: true });
      } catch (error) {
        const code = (error as { code?: number })?.code;
        if (code !== 404) throw error;
      }
    })
  );

  await updateRow(
    `'${RECORDS_SHEET_NAME}'!A${existing.rowNumber}:M${existing.rowNumber}`,
    recordToRow(record, new Date().toISOString())
  );
}

export async function uploadDriveFile(file: File) {
  const { drive } = getGoogleClients();
  const buffer = Buffer.from(await file.arrayBuffer());
  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: file.name || "return-photo.jpg",
      mimeType: file.type || "image/jpeg",
      parents: [driveFolderId()],
    },
    media: {
      mimeType: file.type || "image/jpeg",
      body: Readable.from(buffer),
    },
    fields: "id,name,mimeType,size",
  });

  const driveFileId = normalized(response.data.id);
  if (!driveFileId) throw new Error("Google Drive 사진 ID를 받지 못했습니다.");

  return {
    url: photoUrl(driveFileId),
    filename: normalized(response.data.name) || file.name || "return-photo.jpg",
    size: Number(response.data.size) || file.size,
    contentType: normalized(response.data.mimeType) || file.type || "image/jpeg",
    driveFileId,
  } satisfies AppPhoto;
}

export async function getDrivePhoto(fileId: string) {
  const { drive } = getGoogleClients();
  const metadata = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "name,mimeType",
  });
  const content = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );

  return {
    filename: normalized(metadata.data.name) || "return-photo.jpg",
    contentType: normalized(metadata.data.mimeType) || "image/jpeg",
    body: Buffer.from(content.data as ArrayBuffer),
  };
}

async function settingsWithRowNumbers() {
  const values = await getValues(`'${SETTINGS_SHEET_NAME}'!A:B`);
  if (values.length === 0) {
    throw new Error("Google Sheets에 '설정' 시트가 없습니다. 설정 안내의 초기화 단계를 먼저 진행해주세요.");
  }

  return values.slice(1).map((row, index) => ({ row, rowNumber: index + 2 }));
}

export async function readStringArrayConfig(name: string) {
  const found = (await settingsWithRowNumbers()).find(({ row }) => normalized(row[0]) === name);
  if (!found) return [];

  try {
    const value = JSON.parse(found.row[1] || "[]");
    return Array.isArray(value) ? value.map((item) => normalized(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function writeStringArrayConfig(name: string, values: string[]) {
  const normalizedValues = Array.from(new Set(values.map(normalized).filter(Boolean)));
  const rows = await settingsWithRowNumbers();
  const found = rows.find(({ row }) => normalized(row[0]) === name);
  const nextRow = [name, JSON.stringify(normalizedValues)];

  if (found) {
    await updateRow(`'${SETTINGS_SHEET_NAME}'!A${found.rowNumber}:B${found.rowNumber}`, nextRow);
  } else {
    await appendRow(`'${SETTINGS_SHEET_NAME}'!A:B`, nextRow);
  }

  return normalizedValues;
}

export const GOOGLE_STORAGE_SHEET_HEADERS = {
  records: RECORD_HEADERS,
  settings: SETTINGS_HEADERS,
};
