import { google } from "googleapis";

const RECORDS_SHEET_NAME = "반품기록";
const SETTINGS_SHEET_NAME = "설정";
const PHOTO_FOLDER_NAME = "반품검사 사진";
const SPREADSHEET_NAME = "반품검사 데이터";
const RECORD_HEADERS = [
  "프로그램 ID", "등록일시", "송장번호", "주문번호", "고객명", "반품유형", "제품명",
  "이동/처리", "검사결과", "비고", "송장 사진 JSON", "제품 사진 JSON", "삭제일시",
];
const SETTINGS_HEADERS = ["설정명", "값"];

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

async function findOrCreatePhotoFolder(drive) {
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) return process.env.GOOGLE_DRIVE_FOLDER_ID;
  const found = await drive.files.list({
    q: `name = '${PHOTO_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    spaces: "drive",
    pageSize: 1,
    fields: "files(id,name)",
  });
  if (found.data.files?.[0]?.id) return found.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: PHOTO_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id,name",
  });
  if (!created.data.id) throw new Error("Google Drive 사진 폴더를 만들지 못했습니다.");
  return created.data.id;
}

async function findOrCreateSpreadsheet(sheets, drive) {
  if (process.env.GOOGLE_SHEETS_ID) return process.env.GOOGLE_SHEETS_ID;
  const found = await drive.files.list({
    q: `name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    spaces: "drive",
    pageSize: 1,
    fields: "files(id,name)",
  });
  if (found.data.files?.[0]?.id) return found.data.files[0].id;
  const created = await sheets.spreadsheets.create({
    requestBody: { properties: { title: SPREADSHEET_NAME } },
  });
  if (!created.data.spreadsheetId) throw new Error("Google Sheets 파일을 만들지 못했습니다.");
  return created.data.spreadsheetId;
}

async function main() {
  const { sheets, drive } = clients();
  const photoFolderId = await findOrCreatePhotoFolder(drive);
  const spreadsheetId = await findOrCreateSpreadsheet(sheets, drive);
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((spreadsheet.data.sheets || []).map((sheet) => sheet.properties?.title));
  const requests = [];
  if (!existing.has(RECORDS_SHEET_NAME)) requests.push({ addSheet: { properties: { title: RECORDS_SHEET_NAME } } });
  if (!existing.has(SETTINGS_SHEET_NAME)) requests.push({ addSheet: { properties: { title: SETTINGS_SHEET_NAME } } });
  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  const [recordsHeader, settingsHeader, settings] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${RECORDS_SHEET_NAME}'!A1:M1` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${SETTINGS_SHEET_NAME}'!A1:B1` }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `'${SETTINGS_SHEET_NAME}'!A2:B` }),
  ]);
  const updates = [];
  if ((recordsHeader.data.values || []).length === 0) updates.push({ range: `'${RECORDS_SHEET_NAME}'!A1:M1`, values: [RECORD_HEADERS] });
  if ((settingsHeader.data.values || []).length === 0) updates.push({ range: `'${SETTINGS_SHEET_NAME}'!A1:B1`, values: [SETTINGS_HEADERS] });
  if (updates.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: updates } });

  const settingNames = new Set((settings.data.values || []).map((row) => String(row[0] || "")));
  const defaults = [["사용자 제품명 목록", "[]"], ["추가 불량 비고 목록", "[]"]]
    .filter(([name]) => !settingNames.has(name));
  if (defaults.length) await sheets.spreadsheets.values.append({
    spreadsheetId, range: `'${SETTINGS_SHEET_NAME}'!A:B`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: defaults },
  });

  console.log("\nGoogle 저장공간 초기화 완료. 아래 두 줄을 .env.local과 Vercel에 추가하세요.\n");
  console.log(`GOOGLE_SHEETS_ID=${spreadsheetId}`);
  console.log(`GOOGLE_DRIVE_FOLDER_ID=${photoFolderId}\n`);
  console.log(`Google Sheets: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log(`Google Drive 사진 폴더: https://drive.google.com/drive/folders/${photoFolderId}`);
}

main().catch((error) => {
  console.error(`초기화 실패: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
