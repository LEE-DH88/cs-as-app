export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "꿈비 반품 처리 GPT API",
      version: "1.1.0",
      description:
        "반품 처리 기록 조회·등록, 기간별 엑셀 생성, 노션 상세 기록 및 처리현황 동기화를 위한 비공개 GPT Action API",
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
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      service: { type: "string" },
                      timestamp: { type: "string" },
                    },
                    required: ["ok", "service", "timestamp"],
                  },
                },
              },
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
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            },
          ],
          responses: {
            "200": {
              description: "조회 결과",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      filters: { type: "object", additionalProperties: true },
                      summary: {
                        type: "object",
                        properties: {
                          total: { type: "integer" },
                          normal: { type: "integer" },
                          defective: { type: "integer" },
                          pending: { type: "integer" },
                          followUp: { type: "integer" },
                        },
                      },
                      records: {
                        type: "array",
                        items: { type: "object", additionalProperties: true },
                      },
                    },
                  },
                },
              },
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
                    createdDate: {
                      type: "string",
                      format: "date",
                      description: "미입력 시 오늘 날짜",
                    },
                    invoiceNumber: { type: "string", description: "송장번호" },
                    orderNumber: {
                      type: "string",
                      description: "주문번호, PO 접두 포함 가능",
                    },
                    customerName: {
                      type: "string",
                      description: "고객명, 마스킹 표기 유지 권장",
                    },
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
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      message: { type: "string" },
                      record: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
            },
            "409": {
              description: "중복 의심 기록",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                      duplicate: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
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
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      filename: { type: "string" },
                      summary: { type: "object", additionalProperties: true },
                      downloadUrl: { type: "string", format: "uri" },
                      expiresInMinutes: { type: "integer" },
                      note: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/gpt/notion-sync": {
        get: {
          operationId: "checkNotionConnection",
          summary: "노션 데이터베이스 연결 상태 확인",
          responses: {
            "200": {
              description: "노션 연결 정상",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      notionVersion: { type: "string" },
                      rawDataSource: { type: "string" },
                      summaryDataSource: { type: "string" },
                    },
                    required: [
                      "ok",
                      "notionVersion",
                      "rawDataSource",
                      "summaryDataSource",
                    ],
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: "syncReturnRecordsToNotion",
          summary: "기간별 반품 기록을 노션에 동기화",
          description:
            "처음에는 dryRun=true로 실행해 예정 건수를 보여주세요. 사용자가 명시적으로 승인한 뒤에만 dryRun=false로 실제 노션 반영을 실행하세요. 프로그램 ID와 날짜·제품·처리결과를 기준으로 중복을 방지합니다.",
          "x-openai-isConsequential": true,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["startDate", "endDate", "dryRun"],
                  properties: {
                    startDate: {
                      type: "string",
                      format: "date",
                      description: "동기화 시작일",
                    },
                    endDate: {
                      type: "string",
                      format: "date",
                      description: "동기화 종료일",
                    },
                    dryRun: {
                      type: "boolean",
                      description:
                        "true이면 미리보기만 수행하고 노션에 쓰지 않음. 사용자 승인 후 false로 실행",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "동기화 미리보기 또는 실행 결과",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      dryRun: { type: "boolean" },
                      period: {
                        type: "object",
                        properties: {
                          startDate: { type: "string" },
                          endDate: { type: "string" },
                        },
                      },
                      sourceRecords: { type: "integer" },
                      raw: {
                        type: "object",
                        properties: {
                          createPlanned: { type: "integer" },
                          created: { type: "integer" },
                          skippedExisting: { type: "integer" },
                          failed: { type: "integer" },
                        },
                      },
                      summary: {
                        type: "object",
                        properties: {
                          eligibleSourceRecords: { type: "integer" },
                          rowsCalculated: { type: "integer" },
                          createPlanned: { type: "integer" },
                          updatePlanned: { type: "integer" },
                          unchanged: { type: "integer" },
                          created: { type: "integer" },
                          updated: { type: "integer" },
                          failed: { type: "integer" },
                        },
                      },
                      errors: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  });
}
