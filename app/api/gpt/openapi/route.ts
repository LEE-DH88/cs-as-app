export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "轅덈퉬 諛섑뭹 泥섎━ GPT API",
      version: "1.2.0",
      description:
        "諛섑뭹 泥섎━ 湲곕줉 議고쉶쨌?깅줉, 湲곌컙蹂??묒? ?앹꽦, ?몄뀡 ?곸꽭 湲곕줉 諛?泥섎━?꾪솴 ?숆린?붾? ?꾪븳 鍮꾧났媛?GPT Action API",
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/gpt/health": {
        get: {
          operationId: "checkReturnAppConnection",
          summary: "諛섑뭹 ?꾨줈洹몃옩 ?곌껐 ?곹깭 ?뺤씤",
          responses: {
            "200": {
              description: "?뺤긽 ?곌껐",
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
          summary: "諛섑뭹 泥섎━ 湲곕줉 議고쉶",
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
              description: "議고쉶 寃곌낵",
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
          summary: "諛섑뭹 泥섎━ 湲곕줉 ?깅줉",
          description:
            "?ㅼ젣 湲곕줉???앹꽦?⑸땲?? 諛섎뱶???ъ슜?먯뿉寃??깅줉 ?덉젙 ?댁슜??蹂댁뿬二쇨퀬 紐낆떆???뺤씤??諛쏆? ???몄텧?섏꽭??",
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
                      description: "誘몄엯?????ㅻ뒛 ?좎쭨",
                    },
                    invoiceNumber: { type: "string", description: "?≪옣踰덊샇" },
                    orderNumber: {
                      type: "string",
                      description: "二쇰Ц踰덊샇, PO ?묐몢 ?ы븿 媛??,
                    },
                    customerName: {
                      type: "string",
                      description: "怨좉컼紐? 留덉뒪???쒓린 ?좎? 沅뚯옣",
                    },
                    returnType: {
                      type: "string",
                      enum: ["?쇰컲諛섑뭹", "蹂?щ컲??, "遺덈웾諛섑뭹", "遺덈웾援먰솚", "AS", "寃??],
                    },
                    productName: { type: "string" },
                    processAction: {
                      type: "string",
                      enum: ["誘몄꽑??, "?덉꽦臾쇰쪟?대룞", "?덉꽦?먭린", "?먯껜?먭린", "?먯옄?ы솕"],
                    },
                    inspectionResult: {
                      type: "string",
                      enum: ["寃???湲?, "?뺤긽?뺤씤", "遺덈웾?먯젙", "?꾩냽 ?뺤씤 ?꾩슂"],
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
              description: "?깅줉 ?꾨즺",
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
              description: "以묐났 ?섏떖 湲곕줉",
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
          summary: "湲곌컙蹂?諛섑뭹 湲곕줉 ?묒? ?ㅼ슫濡쒕뱶 留곹겕 ?앹꽦",
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
              description: "10遺??숈븞 ?좏슚???ㅼ슫濡쒕뱶 留곹겕",
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
      "/api/gpt/as-knowledge": {
        get: {
          operationId: "searchAsKnowledge",
          summary: "노션에서 AS 제품 지식과 품질검수 자료 검색",
          description:
            "query가 없으면 AS 품질 보고서 데이터베이스 연결 상태를 확인합니다. query가 있으면 접근 가능한 노션 페이지를 검색하고 민감정보를 숨긴 본문 발췌를 반환합니다.",
          parameters: [
            { name: "query", in: "query", schema: { type: "string" } },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 10, default: 5 },
            },
          ],
          responses: {
            "200": {
              description: "노션 지식 조회 결과",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/gpt/quality-analysis": {
        post: {
          operationId: "analyzeRecurringProductIssues",
          summary: "반품검사 기록에서 반복 품질 문제 분석",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["startDate", "endDate"],
                  properties: {
                    startDate: { type: "string", format: "date" },
                    endDate: { type: "string", format: "date" },
                    productName: { type: "string" },
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
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/gpt/as-quality-report": {
        post: {
          operationId: "manageAsQualityReport",
          summary: "AS 품질 보고서 미리보기 또는 승인 후 노션 등록",
          description:
            "항상 mode=preview로 먼저 보여주세요. 사용자가 명시적으로 등록을 승인한 뒤에만 mode=create와 confirmed=true로 호출하세요.",
          "x-openai-isConsequential": true,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "mode",
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
                  ],
                  properties: {
                    mode: { type: "string", enum: ["preview", "create"] },
                    confirmed: { type: "boolean", default: false },
                    title: { type: "string" },
                    startDate: { type: "string", format: "date" },
                    endDate: { type: "string", format: "date" },
                    productName: { type: "string" },
                    mainSymptom: { type: "string" },
                    occurrenceCount: { type: "integer", minimum: 0 },
                    changeRate: { type: "number" },
                    risk: { type: "string", enum: ["일반", "주의", "긴급"] },
                    confirmedFacts: { type: "array", items: { type: "string" } },
                    estimatedCauses: { type: "array", items: { type: "string" } },
                    inspectionProblems: { type: "array", items: { type: "string" } },
                    recommendations: { type: "array", items: { type: "string" } },
                    references: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "보고서 미리보기",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            "201": {
              description: "노션 보고서 등록 완료",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },      "/api/gpt/notion-sync": {
        get: {
          operationId: "checkNotionConnection",
          summary: "?몄뀡 ?곗씠?곕쿋?댁뒪 ?곌껐 ?곹깭 ?뺤씤",
          responses: {
            "200": {
              description: "?몄뀡 ?곌껐 ?뺤긽",
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
          summary: "湲곌컙蹂?諛섑뭹 湲곕줉???몄뀡???숆린??,
          description:
            "泥섏쓬?먮뒗 dryRun=true濡??ㅽ뻾???덉젙 嫄댁닔瑜?蹂댁뿬二쇱꽭?? ?ъ슜?먭? 紐낆떆?곸쑝濡??뱀씤???ㅼ뿉留?dryRun=false濡??ㅼ젣 ?몄뀡 諛섏쁺???ㅽ뻾?섏꽭?? ?꾨줈洹몃옩 ID? ?좎쭨쨌?쒗뭹쨌泥섎━寃곌낵瑜?湲곗??쇰줈 以묐났??諛⑹??⑸땲??",
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
                      description: "?숆린???쒖옉??,
                    },
                    endDate: {
                      type: "string",
                      format: "date",
                      description: "?숆린??醫낅즺??,
                    },
                    dryRun: {
                      type: "boolean",
                      description:
                        "true?대㈃ 誘몃━蹂닿린留??섑뻾?섍퀬 ?몄뀡???곗? ?딆쓬. ?ъ슜???뱀씤 ??false濡??ㅽ뻾",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "?숆린??誘몃━蹂닿린 ?먮뒗 ?ㅽ뻾 寃곌낵",
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

