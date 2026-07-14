import { readStringArrayConfig, writeStringArrayConfig } from "@/app/lib/google-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIG_NAME = "사용자 제품명 목록";
const DEFAULT_PRODUCT_OPTIONS = ["휴대용분유포트", "(분리형) 휴대용분유포트", "분유쉐이커", "LED분유쉐이커", "젖병살균세척기"];

function normalize(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function onlyCustom(values: unknown[]) {
  return unique(values).filter((value) => !DEFAULT_PRODUCT_OPTIONS.includes(value) && value !== "직접입력");
}

async function payload() {
  const customProductOptions = onlyCustom(await readStringArrayConfig(CONFIG_NAME));
  return { customProductOptions, productOptions: unique([...DEFAULT_PRODUCT_OPTIONS, ...customProductOptions]) };
}

export async function GET() {
  try {
    return NextResponse.json(await payload());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "제품명 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const current = onlyCustom(await readStringArrayConfig(CONFIG_NAME));
    const incoming = [
      ...(typeof body?.option === "string" ? [body.option] : []),
      ...(Array.isArray(body?.options) ? body.options : []),
    ];
    const customProductOptions = await writeStringArrayConfig(CONFIG_NAME, onlyCustom([...current, ...incoming]));
    return NextResponse.json({ customProductOptions, productOptions: unique([...DEFAULT_PRODUCT_OPTIONS, ...customProductOptions]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "제품명 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const option = normalize(body?.option);
    const nextOption = normalize(body?.nextOption);

    if (!option || !nextOption) {
      return NextResponse.json({ error: "수정할 제품명을 입력해주세요." }, { status: 400 });
    }
    if (DEFAULT_PRODUCT_OPTIONS.includes(option)) {
      return NextResponse.json({ error: "기본 제품명은 수정할 수 없습니다." }, { status: 400 });
    }

    const current = onlyCustom(await readStringArrayConfig(CONFIG_NAME));
    if (!current.includes(option)) {
      return NextResponse.json({ error: "수정할 제품명을 찾지 못했습니다." }, { status: 404 });
    }

    const customProductOptions = await writeStringArrayConfig(
      CONFIG_NAME,
      onlyCustom(current.map((value) => (value === option ? nextOption : value)))
    );
    return NextResponse.json({ customProductOptions, productOptions: unique([...DEFAULT_PRODUCT_OPTIONS, ...customProductOptions]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "제품명 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const option = normalize(body?.option);
    if (!option) return NextResponse.json({ error: "삭제할 제품명을 입력해주세요." }, { status: 400 });
    if (DEFAULT_PRODUCT_OPTIONS.includes(option)) {
      return NextResponse.json({ error: "기본 제품명은 삭제할 수 없습니다." }, { status: 400 });
    }

    const current = onlyCustom(await readStringArrayConfig(CONFIG_NAME));
    const customProductOptions = await writeStringArrayConfig(CONFIG_NAME, current.filter((value) => value !== option));
    return NextResponse.json({ customProductOptions, productOptions: unique([...DEFAULT_PRODUCT_OPTIONS, ...customProductOptions]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "제품명 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
