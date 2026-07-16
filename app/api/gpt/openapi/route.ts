export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "꿈비 반품 처리 GPT API",
      version: "1.0.0",
      description:
        "반품 처리 기록 조회·등록과 기간별 엑셀 다운로드 링크 생성을 위한 비공개 GPT Action API",
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/gpt/health": {
        get: {
          operationId: "checkReturnAppConnection",
          summary: "반품 프로그램 연결 상태 확인",
          responses: {
            "200": {
              description: "정상 연결",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/gpt/records": {
        get: {
          operationId: "searchReturnRecords",
          summary: "반품 처리 기록 조회",
          parameters: [
            { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
            { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
            { name: "invoiceNumber", in: "query", schema: { type: "string" } },
            { name: "orderNumber", in: "query", schema: { type: "string" } },
            { name: "productName", in: "query", schema: { type: "string" } },
            { name: "inspectionResult", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
          ],
          responses: {
            "200": {
              description: "조회 결과",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
        post: {
          operationId: "createReturnRecord",
          summary: "반품 처리 기록 등록",
          description:
            "실제 기록을 생성합니다. 반드시 사용자에게 등록 예정 내용을 보여주고 명시적 확인을 받은 뒤 호출하세요.",
          "x-openai-isConsequential": true,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["returnType", "productName", "inspectionResult"],
                  properties: {
                    createdDate: { type: "string", format: "date", description: "미입력 시 오늘 날짜" },
                    invoiceNumber: { type: "string", description: "송장번호" },
                    orderNumber: { type: "string", description: "주문번호, PO 접두 포함 가능" },
                    customerName: { type: "string", description: "고객명, 마스킹 표기 유지 권장" },
                    returnType: {
                      type: "string",
                      enum: ["일반반품", "변심반품", "불량반품", "불량교환", "AS", "검수"],
                    },
                    productName: { type: "string" },
                    processAction: {
                      type: "string",
                      enum: ["미선택", "안성물류이동", "안성폐기", "자체폐기", "원자재화"],
                    },
                    inspectionResult: {
                      type: "string",
                      enum: ["검사 대기", "정상확인", "불량판정", "후속 확인 필요"],
                    },
                    note: { type: "string" },
                    allowDuplicate: { type: "boolean", default: false },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "등록 완료",
              content: { "application/json": { schema: { type: "object" } } },
            },
            "409": {
              description: "중복 의심 기록",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/gpt/export": {
        post: {
          operationId: "createReturnRecordsExcelDownload",
          summary: "기간별 반품 기록 엑셀 다운로드 링크 생성",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    startDate: { type: "string", format: "date" },
                    endDate: { type: "string", format: "date" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "10분 동안 유효한 다운로드 링크",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  });
}
