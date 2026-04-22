import { NextResponse } from "next/server";

export async function GET() {
  const projectId = process.env.GOOGLE_VISION_PROJECT_ID || "";
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL || "";
  const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY || "";

  return NextResponse.json({
    hasProjectId: !!projectId,
    hasClientEmail: !!clientEmail,
    hasPrivateKey: !!privateKey,
    privateKeyStartsCorrectly: privateKey.startsWith("-----BEGIN PRIVATE KEY-----"),
    privateKeyEndsCorrectly: privateKey.trim().endsWith("-----END PRIVATE KEY-----"),
    privateKeyHasNewLine: privateKey.includes("\n"),
    privateKeyLength: privateKey.length,
  });
}