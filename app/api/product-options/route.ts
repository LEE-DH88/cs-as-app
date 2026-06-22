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

function isDefaultProductOption(option: string) {
  return DEFAULT_PRODUCT_OPTIONS.includes(normalizeProductOptionText(option));
}

function getProductOptionsPayload(customProductOptions: string[]) {
  return {
    customProductOptions,
    productOptions: getUniqueProductOptions([
      ...DEFAULT_PRODUCT_OPTIONS,
      ...customProductOptions,
    ]),
  };
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

    return NextResponse.json(getProductOptionsPayload(customProductOptions));
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

    return NextResponse.json(getProductOptionsPayload(customProductOptions));
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const currentOption = normalizeProductOptionText(
      typeof body?.option === "string" ? body.option : ""
    );
    const nextOption = normalizeProductOptionText(
      typeof body?.nextOption === "string" ? body.nextOption : ""
    );

    if (!currentOption || !nextOption) {
      return NextResponse.json(
        { error: "수정할 제품명과 변경할 제품명을 입력해주세요." },
        { status: 400 }
      );
    }

    if (currentOption === "직접입력" || nextOption === "직접입력") {
      return NextResponse.json(
        { error: "'직접입력'은 수정할 수 없습니다." },
        { status: 400 }
      );
    }

    if (isDefaultProductOption(currentOption)) {
      return NextResponse.json(
        { error: "기본 제품명은 보호 항목이라 수정할 수 없습니다." },
        { status: 400 }
      );
    }

    const currentCustomProductOptions = await readCustomProductOptions();

    if (!currentCustomProductOptions.includes(currentOption)) {
      return NextResponse.json(
        { error: "수정할 제품명을 찾지 못했습니다." },
        { status: 404 }
      );
    }

    if (currentOption === nextOption) {
      return NextResponse.json(
        getProductOptionsPayload(currentCustomProductOptions)
      );
    }

    const duplicated = getUniqueProductOptions([
      ...DEFAULT_PRODUCT_OPTIONS,
      ...currentCustomProductOptions.filter((option) => option !== currentOption),
    ]).includes(nextOption);

    if (duplicated) {
      return NextResponse.json(
        { error: "이미 등록된 제품명입니다." },
        { status: 409 }
      );
    }

    const customProductOptions = await writeCustomProductOptions(
      currentCustomProductOptions.map((option) =>
        option === currentOption ? nextOption : option
      )
    );

    return NextResponse.json(getProductOptionsPayload(customProductOptions));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "제품명 수정에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const option = normalizeProductOptionText(
      typeof body?.option === "string" ? body.option : ""
    );

    if (!option) {
      return NextResponse.json(
        { error: "삭제할 제품명을 입력해주세요." },
        { status: 400 }
      );
    }

    if (option === "직접입력") {
      return NextResponse.json(
        { error: "'직접입력'은 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    if (isDefaultProductOption(option)) {
      return NextResponse.json(
        { error: "기본 제품명은 보호 항목이라 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    const currentCustomProductOptions = await readCustomProductOptions();

    if (!currentCustomProductOptions.includes(option)) {
      return NextResponse.json(
        { error: "삭제할 제품명을 찾지 못했습니다." },
        { status: 404 }
      );
    }

    const customProductOptions = await writeCustomProductOptions(
      currentCustomProductOptions.filter((item) => item !== option)
    );

    return NextResponse.json(getProductOptionsPayload(customProductOptions));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "제품명 삭제에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
