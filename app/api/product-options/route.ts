import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PRODUCT_OPTIONS_BLOB_PATH = "return-record/product-options.json";

const DEFAULT_PRODUCT_OPTIONS = [
  "휴대용분유포트",
  "(분리형) 휴대용분유포트",
  "분유쉐이커",
  "LED분유쉐이커",
  "젖병살균세척기",
];

function normalizeProductOptionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getUniqueProductOptions(options: string[]) {
  const optionSet = new Set<string>();

  options.forEach((option) => {
    const normalized = normalizeProductOptionText(option);

    if (normalized && normalized !== "직접입력") {
      optionSet.add(normalized);
    }
  });

  return Array.from(optionSet);
}

function getCustomOnlyOptions(options: string[]) {
  return getUniqueProductOptions(options).filter(
    (option) => !DEFAULT_PRODUCT_OPTIONS.includes(option)
  );
}

async function readCustomProductOptions() {
  const { blobs } = await list({
    prefix: PRODUCT_OPTIONS_BLOB_PATH,
    limit: 1,
  });

  const targetBlob = blobs.find(
    (blob) => blob.pathname === PRODUCT_OPTIONS_BLOB_PATH
  );

  if (!targetBlob?.url) return [];

  const response = await fetch(`${targetBlob.url}?t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) return [];

  const data = await response.json().catch(() => null);

  return getCustomOnlyOptions(
    Array.isArray(data?.customProductOptions)
      ? data.customProductOptions.map((item: unknown) => String(item))
      : Array.isArray(data?.productOptions)
        ? data.productOptions.map((item: unknown) => String(item))
        : []
  );
}

async function writeCustomProductOptions(customProductOptions: string[]) {
  const nextCustomProductOptions = getCustomOnlyOptions(customProductOptions);

  await put(
    PRODUCT_OPTIONS_BLOB_PATH,
    JSON.stringify(
      {
        customProductOptions: nextCustomProductOptions,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    {
      access: "public",
      allowOverwrite: true,
      contentType: "application/json",
    }
  );

  return nextCustomProductOptions;
}

export async function GET() {
  try {
    const customProductOptions = await readCustomProductOptions();

    return NextResponse.json({
      customProductOptions,
      productOptions: getUniqueProductOptions([
        ...DEFAULT_PRODUCT_OPTIONS,
        ...customProductOptions,
      ]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "제품명 목록 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const incomingOptions = [
      ...(typeof body?.option === "string" ? [body.option] : []),
      ...(Array.isArray(body?.options)
        ? body.options.map((item: unknown) => String(item))
        : []),
    ];

    const normalizedIncomingOptions = getCustomOnlyOptions(incomingOptions);

    if (normalizedIncomingOptions.length === 0) {
      return NextResponse.json(
        { error: "추가할 제품명을 입력해주세요." },
        { status: 400 }
      );
    }

    const currentCustomProductOptions = await readCustomProductOptions();
    const customProductOptions = await writeCustomProductOptions([
      ...currentCustomProductOptions,
      ...normalizedIncomingOptions,
    ]);

    return NextResponse.json({
      customProductOptions,
      productOptions: getUniqueProductOptions([
        ...DEFAULT_PRODUCT_OPTIONS,
        ...customProductOptions,
      ]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "제품명 저장에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
