export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "꿈비 AS·품질 분석 GPT API",
      version: "1.0.0",
      description:
        "AS 제품 지식과 품질검수 자료를 노션에서 안전하게 조회하기 위한 비공개 GPT Action API",
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
                    additionalProperties: true,
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
