import {
  listReturnRecords,
  saveReturnRecord,
} from "@/app/lib/google-storage";
import { requireGptActionAuth } from "@/app/lib/gpt-action-auth";
import {
  createReturnRecord,
  filterReturnRecords,
  findDuplicateRecord,
  summarizeReturnRecords,
  type CreateReturnRecordInput,
} from "@/app/lib/return-record-gpt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withoutPhotos(record: Awaited<ReturnType<typeof listReturnRecords>>[number]) {
  return {
    ...record,
    invoicePhotos: undefined,
    productPhotos: undefined,
    invoicePhotoCount: record.invoicePhotos.length,
    productPhotoCount: record.productPhotos.length,
  };
}

export async function GET(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const records = await listReturnRecords({ startDate, endDate });
    const filtered = filterReturnRecords(records, {
      startDate,
      endDate,
      invoiceNumber: searchParams.get("invoiceNumber") || undefined,
      orderNumber: searchParams.get("orderNumber") || undefined,
      productName: searchParams.get("productName") || undefined,
      inspectionResult: searchParams.get("inspectionResult") || undefined,
      limit: Number(searchParams.get("limit") || 50),
    });

    return Response.json({
      filters: Object.fromEntries(searchParams.entries()),
      summary: summarizeReturnRecords(filtered),
      records: filtered.map(withoutPhotos),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "기록 조회 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const authError = requireGptActionAuth(request);
  if (authError) return authError;

  try {
    const input = (await request.json()) as CreateReturnRecordInput;
    const record = createReturnRecord(input);

    if (!input.allowDuplicate) {
      const records = await listReturnRecords();
      const duplicate = findDuplicateRecord(records, record);
      if (duplicate) {
        return Response.json(
          {
            error: "같은 송장번호 또는 주문번호와 제품명의 기존 기록이 있습니다.",
            duplicate: withoutPhotos(duplicate),
          },
          { status: 409 }
        );
      }
    }

    const saved = await saveReturnRecord(record);
    return Response.json(
      {
        success: true,
        message: "반품 처리 기록을 등록했습니다.",
        record: withoutPhotos(saved),
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "기록 저장 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
