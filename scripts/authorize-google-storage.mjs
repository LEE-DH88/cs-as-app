import { google } from "googleapis";
import http from "node:http";

const REDIRECT_URI = "http://127.0.0.1:42813/oauth2callback";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 없습니다.`);
  return value;
}

async function main() {
  const auth = new google.auth.OAuth2(
    required("GOOGLE_STORAGE_CLIENT_ID"),
    required("GOOGLE_STORAGE_CLIENT_SECRET"),
    REDIRECT_URI
  );
  const authUrl = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", REDIRECT_URI);
      const error = requestUrl.searchParams.get("error");
      const code = requestUrl.searchParams.get("code");
      if (error || !code) throw new Error(error || "Google 인증 코드를 받지 못했습니다.");

      const { tokens } = await auth.getToken(code);
      if (!tokens.refresh_token) {
        throw new Error("새로 발급된 갱신 토큰을 받지 못했습니다. Google 계정 접근 권한을 제거한 후 다시 시도해주세요.");
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h2>연결 완료</h2><p>이 창을 닫고 터미널에서 갱신 토큰을 복사하세요.</p>");
      console.log("\nGOOGLE_STORAGE_REFRESH_TOKEN=" + tokens.refresh_token + "\n");
      server.close();
    } catch (error) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h2>연결 실패</h2><p>터미널의 오류 내용을 확인하세요.</p>");
      console.error(error instanceof Error ? error.message : error);
      server.close();
      process.exitCode = 1;
    }
  });

  server.listen(42813, "127.0.0.1", () => {
    console.log("아래 주소를 현재 PC의 Chrome 주소창에 붙여넣어 Google 로그인을 완료하세요.\n");
    console.log(authUrl + "\n");
  });
}

main().catch((error) => {
  console.error(`Google 인증 준비 실패: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
