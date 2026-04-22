import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const RECORDS_PREFIX = "ggumbi-return-record/records/";

export const dynamic = "force-dynamic";

type UploadedPhoto = {
  url: string;
  pathname?: string;
  filename: string;
  size: number;
  contentType?: string;
};

type ReturnRecord = {
  id: string;
  createdAt: string;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  returnType: string;
  productName: string;
  inspectionResult: string;
  note: string;
  invoicePhotos: UploadedPhoto[];
  productPhotos: UploadedPhoto[];
};

type ListedBlob = {
  url: string;
  pathname: string;
};

type BlobListResult = {
  blobs: ListedBlob[];
  cursor?: string;
  hasMore: boolean;
};

async function fetchAllRecords(): Promise<ReturnRecord[]> {
  const allBlobs: ListedBlob[] = [];
  let cursor: string | undefined = undefined;

  do {
    const result: BlobListResult = await list({
      prefix: RECORDS_PREFIX,
      cursor,
      limit: 1000,
    });

    for (const blob of result.blobs) {
      if (blob.pathname.endsWith(".json")) {
        allBlobs.push({
          url: blob.url,
          pathname: blob.pathname,
        });
      }
    }

    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  const records = await Promise.all(
    allBlobs.map(async (blob): Promise<ReturnRecord | null> => {
      try {
        const response = await fetch(blob.url, { cache: "no-store" });
        if (!response.ok) return null;

        const data = (await response.json()) as ReturnRecord;
        return data;
      } catch {
        return null;
      }
    })
  );

  return records
    .filter((record): record is ReturnRecord => record !== null)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export async function GET() {
  try {
    const records = await fetchAllRecords();
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "기록 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReturnRecord;

    if (!body?.id) {
      return NextResponse.json(
        { error: "기록 ID가 없습니다." },
        { status: 400 }
      );
    }

    const pathname = `${RECORDS_PREFIX}${body.id}.json`;

    await put(pathname, JSON.stringify(body, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json; charset=utf-8",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "기록 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      photoUrls?: string[];
    };

    if (!body?.id) {
      return NextResponse.json(
        { error: "삭제할 기록 ID가 없습니다." },
        { status: 400 }
      );
    }

    const targets: string[] = [
      `${RECORDS_PREFIX}${body.id}.json`,
      ...(body.photoUrls || []),
    ];

    await del(targets);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "기록 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}