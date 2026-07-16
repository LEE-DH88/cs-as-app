# 반품 처리 앱 GPT Actions 연결 안내

## 구성된 기능

- 기간·송장·주문번호·제품명으로 기록 조회
- 사용자 승인 후 신규 기록 등록
- 중복 의심 기록 차단
- 기존 프로그램과 동일한 2개 시트 엑셀 생성
  - `반품검사기록`
  - `노션_처리현황`
- 엑셀은 서버에 저장하지 않고 요청할 때 생성
- 다운로드 주소는 10분 후 만료

## 1. 파일 복사

이 패키지의 `app` 폴더를 아래 프로젝트에 덮어씁니다.

```powershell
C:\Users\DESKTOP\Desktop\cs-as-app
```

기존 파일을 교체하지 않고 새로운 GPT 전용 파일만 추가됩니다.

## 2. 보안키 생성

PowerShell에서 실행합니다.

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

출력된 값을 외부에 공개하지 않습니다.

## 3. 로컬 환경변수

프로젝트의 `.env.local` 마지막 줄에 추가합니다.

```env
GPT_ACTION_API_KEY=방금_생성한_값
```

## 4. 로컬 확인

```powershell
cd C:\Users\DESKTOP\Desktop\cs-as-app
npm run build
npm run dev
```

브라우저에서 아래 주소를 열었을 때 `401`이 나오면 API가 외부에 무방비로 열린 것이 아니라 정상적으로 보호되고 있는 상태입니다.

```text
http://localhost:3000/api/gpt/health
```

PowerShell 인증 테스트:

```powershell
$headers = @{ Authorization = "Bearer 방금_생성한_값" }
Invoke-RestMethod -Uri "http://localhost:3000/api/gpt/health" -Headers $headers
```

## 5. GitHub 및 Vercel 배포

```powershell
cd C:\Users\DESKTOP\Desktop\cs-as-app
git add app/lib/gpt-action-auth.ts app/lib/return-record-gpt.ts app/api/gpt docs/gpt-actions-setup.md
git commit -m "GPT Actions 반품 기록 조회 등록 엑셀 연동"
git push
```

Vercel 프로젝트 설정의 Environment Variables에 다음 값을 추가합니다.

```text
Key: GPT_ACTION_API_KEY
Value: 로컬에 넣은 것과 동일한 값
```

Production, Preview, Development를 모두 선택한 뒤 재배포합니다.

## 6. Custom GPT 만들기

ChatGPT 웹에서:

1. `GPT 탐색` → `만들기`
2. 이름: `반품 프로그램 관리 직원`
3. `구성` → `Actions` 추가
4. 스키마 가져오기 주소:

```text
https://실제-반품앱-주소/api/gpt/openapi
```

5. 인증 방식: `API Key`
6. 인증 유형: `Bearer`
7. API Key 값: `GPT_ACTION_API_KEY`와 동일한 값
8. 공개 범위는 `나만 사용`으로 설정

## 7. GPT 지침 권장문

```text
너는 꿈비 반품 프로그램 관리 직원이다.

기록 조회 요청은 searchReturnRecords를 사용한다.
신규 등록 요청은 먼저 등록 예정 필드를 표로 보여주고 사용자가 명확히 승인한 후 createReturnRecord를 호출한다.
불량판정인데 이동/처리가 없으면 반드시 사용자에게 자체폐기, 원자재화, 안성폐기 중 하나를 확인한다.
정상확인은 이동/처리를 안성물류이동으로 적용한다.
고객명은 입력된 마스킹을 복원하지 않는다.
엑셀 요청은 createReturnRecordsExcelDownload를 호출하고 반환된 downloadUrl을 사용자에게 제공한다.
중복 오류가 나오면 임의로 allowDuplicate=true를 사용하지 말고 기존 기록을 보여주며 사용자에게 확인한다.
사진을 자동 조회하지 않는다.
```

## 테스트 문장

```text
반품 프로그램 연결 상태 확인해줘.

2026년 7월 14일부터 오늘까지 분리형 휴대용 분유포트 기록을 조회해줘.

송장번호 1234-5678-9012, 주문번호 PO2026000000001, 고객명 김*영,
일반반품, 휴대용분유포트, 정상확인, 정상화 완료로 등록해줘.

2026년 7월 14일부터 오늘까지 엑셀 다운로드 링크 만들어줘.
```

## 현재 범위

이 1차 버전은 반품 프로그램의 조회·신규 등록·엑셀 다운로드를 GPT와 연결합니다.
Custom GPT는 Apps와 Actions를 동시에 사용할 수 없으므로, 현재 ChatGPT의 노션 앱을 같은 Custom GPT 안에서 함께 사용하는 방식은 지원되지 않습니다. 노션 자동 반영은 다음 단계에서 반품 앱 서버가 노션에 직접 전송하도록 별도 연결해야 합니다.
