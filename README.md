# 반품검사 프로그램 — 개인 Google Drive · Sheets 저장형

기존 반품검사 화면과 Google Vision OCR 규칙은 그대로 유지합니다.

- OCR 자동 입력: 송장번호, 주문번호, 고객명, 반품유형, 제품명
- 반품 기록 · 제품명 목록 · 추가 불량 비고: **Google Sheets** 저장
- 송장 · 제품 사진: **현재 로그인한 Google Drive** 저장
- `@vercel/blob` 및 `BLOB_READ_WRITE_TOKEN`: 사용하지 않음
- 프로그램을 처음 열 때는 전체 기록을 불러오지 않음
- 기록보기에서 조회하거나 리포트를 열 때만 기록을 읽음
- 사진은 자동 미리보기하지 않고 `사진 보기`를 눌렀을 때만 열림

## 1. Google Cloud에서 Drive / Sheets API 사용 설정

기존 OCR에 사용 중인 `ggumbi-ocr` 프로젝트에서 아래 API를 사용 설정합니다.

1. Google Cloud Console → **API 및 서비스 → 라이브러리**
2. `Google Drive API` 검색 → **사용 설정**
3. `Google Sheets API` 검색 → **사용 설정**

## 2. Google OAuth 클라이언트 만들기

1. Google Cloud Console → **API 및 서비스 → 사용자 인증 정보**
2. **사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
3. 처음이면 동의 화면을 먼저 만들고, 현재 Google Drive 계정을 테스트 사용자로 추가합니다.
4. 애플리케이션 유형은 **데스크톱 앱**, 이름은 `반품검사 프로그램`으로 생성합니다.
5. 생성 화면의 클라이언트 ID와 클라이언트 보안 비밀을 복사합니다.

## 3. `.env.local`에 OAuth 정보 입력

```env
# 기존 OCR 키는 그대로 유지합니다.
GOOGLE_VISION_CREDENTIALS={"type":"service_account"}

# 2단계에서 만든 OAuth 값
GOOGLE_STORAGE_CLIENT_ID=복사한_클라이언트_ID
GOOGLE_STORAGE_CLIENT_SECRET=복사한_클라이언트_보안_비밀
```

## 4. 현재 Google 계정에 한 번만 권한 부여

```bash
npm run authorize:google-storage
```

터미널에 나온 긴 주소를 현재 PC Chrome 주소창에 붙여넣고, 반품 사진을 보관할 Google 계정으로 로그인합니다. 완료되면 터미널에 아래 값이 출력됩니다.

```env
GOOGLE_STORAGE_REFRESH_TOKEN=...
```

이 값을 `.env.local`에 추가합니다.

## 5. Sheets / Drive 공간 자동 만들기

```bash
npm run setup:google-storage
```

이 명령은 내 Drive에 아래를 자동 생성합니다.

- `반품검사 사진` 폴더
- `반품검사 데이터` Google Sheets
- Sheets 안의 `반품기록`, `설정` 시트

터미널에 출력되는 아래 두 줄도 `.env.local`에 추가합니다.

```env
GOOGLE_SHEETS_ID=...
GOOGLE_DRIVE_FOLDER_ID=...
```

## 6. 기존 2026-07-13 기록 · 사진 한 번에 이관

압축 파일에 포함된 `data/반품검사기록_전체_20260713.xlsx`를 사용해 기록 290건과 엑셀 안의 사진 링크를 Google Drive로 옮깁니다.

```bash
npm run migrate:return-records
```

- 같은 명령을 다시 실행해도 이미 옮긴 기록은 중복 추가하지 않습니다.
- 사진 링크가 더 이상 열리지 않는 경우, 해당 사진만 건너뛰고 텍스트 기록은 이관합니다.
- 이관이 끝난 후 출력되는 `사진 실패` 숫자가 `0`인지 확인합니다.

## 7. Vercel 환경변수 · 배포

Vercel 프로젝트 `cs-as-app` → **Settings → Environment Variables**에 아래 값을 등록합니다.

```env
GOOGLE_VISION_CREDENTIALS=기존_값_그대로
GOOGLE_STORAGE_CLIENT_ID=...
GOOGLE_STORAGE_CLIENT_SECRET=...
GOOGLE_STORAGE_REFRESH_TOKEN=...
GOOGLE_SHEETS_ID=...
GOOGLE_DRIVE_FOLDER_ID=...
```

정상 작동을 확인한 뒤 `BLOB_READ_WRITE_TOKEN`, `NOTION_API_KEY`, `NOTION_RETURN_DATA_SOURCE_ID`, `NOTION_CONFIG_DATA_SOURCE_ID`는 Vercel과 `.env.local`에서 삭제해도 됩니다.

```bash
npm run build
git add .
git commit -m "Google Sheets Drive 저장소로 Blob 제거"
git push
```
