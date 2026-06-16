import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BLOB_PREFIX = "return-record-config/note-options/custom-defective/";

const BASE_DEFECTIVE_NOTE_OPTIONS = [
  "전원불량",
  "사용감",
  "소음",
  "누수",
  "충전불량",
  "회전불량",
  "수분유입",
  "이물질",
];

function normalizeNoteOptionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getUniqueCustomOptions(options: string[]) {
  const optionSet = new Set<string>();

  options.forEach((option) => {
    const normalized = normalizeNoteOptionText(option);

    if (!normalized) return;
    if (BASE_DEFECTIVE_NOTE_OPTIONS.includes(normalized)) return;

    optionSet.add(normalized);
  });

  return Array.from(optionSet);
}

async function readCustomDefectiveNoteOptions() {
  const { blobs } = await list({ prefix: BLOB_PREFIX });

  if (!blobs.length) return [];

  const latestBlob = [...blobs].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )[0];

  if (!latestBlob?.url) return [];

  const response = await fetch(latestBlob.url, { cache: "no-store" });

  if (!response.ok) return [];

  const data = await response.json().catch(() => ({}));
  const rawOptions = Array.isArray(data.customDefectiveNoteOptions)
    ? data.customDefectiveNoteOptions
    : Array.isArray(data.options)
      ? data.options
      : [];

  return getUniqueCustomOptions(rawOptions.map((item: unknown) => String(item)));
}

async function writeCustomDefectiveNoteOptions(options: string[]) {
  const customDefectiveNoteOptions = getUniqueCustomOptions(options);
  const uploadedAt = new Date().toISOString();
  const pathname = `${BLOB_PREFIX}${Date.now()}.json`;

  await put(
    pathname,
    JSON.stringify(
      {
        customDefectiveNoteOptions,
        uploadedAt,
      },
      null,
      2
    ),
    {
      access: "public",
    }
  );

  return customDefectiveNoteOptions;
}

export async function GET() {
  try {
    const customDefectiveNoteOptions = await readCustomDefectiveNoteOptions();

    return NextResponse.json({ customDefectiveNoteOptions });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "비고 문구 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const currentOptions = await readCustomDefectiveNoteOptions();
    const incomingOptions = [
      typeof body.option === "string" ? body.option : "",
      ...(Array.isArray(body.options) ? body.options : []),
    ].map((item) => String(item));

    const customDefectiveNoteOptions = await writeCustomDefectiveNoteOptions([
      ...currentOptions,
      ...incomingOptions,
    ]);

    return NextResponse.json({ customDefectiveNoteOptions });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "비고 문구 저장에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
