export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const reportProperties = {
    title: {
      type: "string",
      description: "보고서 제목",
    },
    startDate: {
      type: "string",
      format: "date",
      description: "분석 시작일",
    },
    endDate: {
      type: "string",
      format: "date",
      description: "분석 종료일",
    },
    productName: {
      type: "string",
    },
    mainSymptom: {
      type: "string",
    },
    occurrenceCount: {
      type: "integer",
      minimum: 0,
    },
    previousCount: {
      type: "integer",
      minimum: 0,
      description: "직전 동일 기간 발생건수",
    },
    changeRatePercent: {
      type: "number",
      description: "직전 동일 기간 대비 증감률",
    },
    risk: {
      type: "string",
      enum: ["일반", "주의", "긴급"],
    },
    confirmedFacts: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
      description: "자료와 기록에서 직접 확인된 사실만 기재",
    },
    estimatedCauses: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
      description: "추정임을 명확히 표시한 원인",
    },
    inspectionProblems: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
      description: "품질검수 기준과 기록 방식의 보완점",
    },
    recommendations: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
    references: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
      description: "참고한 노션 페이지명 또는 자료명. 고객 개인정보는 넣지 않음",
    },
  };

  const reportRequired = [
    "title",
    "startDate",
    "endDate",
    "productName",
    "mainSymptom",
    "occurrenceCount",
    "risk",
    "confirmedFacts",
    "estimatedCauses",
    "inspectionProblems",
    "recommendations",
    "references",
  ];

  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "꿈비 AS·품질 분석 GPT API",
      version: "1.2.0",
      description:
        "AS 제품 지식 및 품질검수 자료 조회, 반복 품질 문제 분석, 승인 기반 노션 품질 보고서 등록을 위한 비공개 GPT Action API",
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/gpt/as-knowledge": {
        get: {
          operationId: "searchAsKnowledge",
          summary: "노션에서 AS 제품 지식과 품질검수 자료 검색",
          description:
            "query를 생략하면 연결 대상별 접근 상태를 확인합니다. query를 입력하면 AS 관리, 제품 스크립트, 품질검수와 불량 분석 자료에서 관련 내용을 검색합니다. 민감정보와 개인정보는 결과에서 제외합니다.",
          parameters: [
            {
              name: "query",
              in: "query",
              schema: { type: "string" },
              description: "제품명, 증상 또는 품질 이슈 검색어",
            },
            {
              name: "limit",
              in: "query",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 10,
                default: 5,
              },
            },
          ],
          responses: {
            "200": {
              description: "노션 연결 상태 또는 검색 결과",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      ok: { type: "boolean" },
                      notionVersion: { type: "string" },
                      accessibleCount: { type: "integer" },
                      totalCount: { type: "integer" },
                      query: { type: "string" },
                      count: { type: "integer" },
                      note: { type: "string" },
                      resources: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            type: { type: "string" },
                            accessible: { type: "boolean" },
                            error: { type: "string" },
                          },
                        },
                      },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            source: { type: "string" },
                            title: { type: "string" },
                            pageId: { type: "string" },
                            url: { type: "string" },
                            lastEditedTime: { type: "string" },
                            excerpt: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "검색어 또는 노션 연결 오류",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "인증 실패",
            },
          },
        },
      },
      "/api/gpt/quality-analysis": {
        post: {
          operationId: "analyzeRecurringProductIssues",
          summary: "반품검사 기록에서 반복 품질 문제 분석",
          description:
            "선택 기간을 직전 동일 길이의 기간과 비교합니다. 동일 제품·증상 3건 이상, 50% 이상 증가 또는 안전 관련 증상 1건 이상을 경고로 표시합니다.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["startDate", "endDate"],
                  properties: {
                    startDate: {
                      type: "string",
                      format: "date",
                      description: "분석 시작일",
                    },
                    endDate: {
                      type: "string",
                      format: "date",
                      description: "분석 종료일",
                    },
                    productName: {
                      type: "string",
                      description:
                        "선택 입력. 입력하면 해당 문구가 포함된 제품만 분석",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "반복 품질 문제 분석 결과",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      period: {
                        type: "object",
                        properties: {
                          startDate: { type: "string" },
                          endDate: { type: "string" },
                          days: { type: "integer" },
                        },
                      },
                      comparisonPeriod: {
                        type: "object",
                        properties: {
                          startDate: { type: "string" },
                          endDate: { type: "string" },
                          days: { type: "integer" },
                        },
                      },
                      filters: {
                        type: "object",
                        properties: {
                          productName: { type: "string" },
                        },
                      },
                      thresholds: {
                        type: "object",
                        properties: {
                          recurringCount: { type: "integer" },
                          increaseRatePercent: { type: "number" },
                          safetySingleCaseAlert: { type: "boolean" },
                        },
                      },
                      sourceRecords: {
                        type: "object",
                        properties: {
                          current: { type: "integer" },
                          previous: { type: "integer" },
                        },
                      },
                      summary: {
                        type: "object",
                        properties: {
                          detectedIssueGroups: { type: "integer" },
                          alerts: { type: "integer" },
                          urgentAlerts: { type: "integer" },
                          cautionAlerts: { type: "integer" },
                        },
                      },
                      alerts: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            productName: { type: "string" },
                            symptom: { type: "string" },
                            currentCount: { type: "integer" },
                            previousCount: { type: "integer" },
                            changeRatePercent: { type: "number" },
                            trend: { type: "string" },
                            risk: {
                              type: "string",
                              enum: ["일반", "주의", "긴급"],
                            },
                            isAlert: { type: "boolean" },
                            triggerReasons: {
                              type: "array",
                              items: { type: "string" },
                            },
                            evidenceSamples: {
                              type: "array",
                              items: { type: "string" },
                            },
                          },
                        },
                      },
                      issues: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            productName: { type: "string" },
                            symptom: { type: "string" },
                            currentCount: { type: "integer" },
                            previousCount: { type: "integer" },
                            changeRatePercent: { type: "number" },
                            trend: { type: "string" },
                            risk: {
                              type: "string",
                              enum: ["일반", "주의", "긴급"],
                            },
                            isAlert: { type: "boolean" },
                            triggerReasons: {
                              type: "array",
                              items: { type: "string" },
                            },
                            evidenceSamples: {
                              type: "array",
                              items: { type: "string" },
                            },
                          },
                        },
                      },
                      note: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "날짜 또는 분석 조건 오류",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "인증 실패",
            },
          },
        },
      },
      "/api/gpt/as-quality-report/preview": {
        post: {
          operationId: "previewAsQualityReport",
          summary: "AS 품질 보고서 노션 등록 전 미리보기",
          description:
            "보고서를 정리하고 AS 품질 이슈 보고서 데이터베이스 접근 및 구조를 확인합니다. 노션에는 아무것도 등록하지 않습니다. 실제 등록 전에 반드시 이 작업을 먼저 호출하고 결과를 사용자에게 보여주세요.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: reportRequired,
                  properties: reportProperties,
                },
              },
            },
          },
          responses: {
            "200": {
              description: "보고서 미리보기",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      previewOnly: { type: "boolean" },
                      message: { type: "string" },
                      canCreateReport: { type: "boolean" },
                      dataSource: {
                        type: "object",
                        properties: {
                          accessible: { type: "boolean" },
                          schemaValid: { type: "boolean" },
                          dataSourceId: { type: "string" },
                          missingProperties: {
                            type: "array",
                            items: { type: "string" },
                          },
                          wrongTypeProperties: {
                            type: "array",
                            items: { type: "string" },
                          },
                          error: { type: "string" },
                        },
                      },
                      report: {
                        type: "object",
                        properties: reportProperties,
                      },
                      previewText: { type: "string" },
                      approvalInstruction: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "보고서 입력값 오류",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "인증 실패",
            },
          },
        },
      },
      "/api/gpt/as-quality-report/create": {
        post: {
          operationId: "createAsQualityReport",
          summary: "사용자 승인 후 AS 품질 보고서를 노션에 등록",
          description:
            "실제 노션 페이지를 생성합니다. previewAsQualityReport 결과를 사용자에게 먼저 보여주고, 사용자가 명시적으로 등록을 승인한 뒤에만 호출하세요. 승인되지 않은 상태에서 호출하지 마세요.",
          "x-openai-isConsequential": true,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    ...reportRequired,
                    "approvalConfirmed",
                    "approvalText",
                  ],
                  properties: {
                    ...reportProperties,
                    approvalConfirmed: {
                      type: "boolean",
                      description:
                        "사용자가 현재 미리보기 내용을 노션에 등록한다고 명시적으로 승인했을 때만 true",
                    },
                    approvalText: {
                      type: "string",
                      enum: ["노션 등록 승인"],
                    },
                    allowDuplicate: {
                      type: "boolean",
                      default: false,
                      description:
                        "같은 보고서명이 이미 있을 때 사용자의 별도 중복 승인 후에만 true",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "노션 보고서 등록 완료",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      message: { type: "string" },
                      pageId: { type: "string" },
                      url: { type: "string" },
                      report: {
                        type: "object",
                        properties: reportProperties,
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "승인 또는 입력값 오류",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                    },
                  },
                },
              },
            },
            "409": {
              description: "같은 보고서명이 이미 존재함",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                      duplicate: {
                        type: "object",
                        properties: {
                          pageId: { type: "string" },
                          url: { type: "string" },
                        },
                      },
                      instruction: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "인증 실패",
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
