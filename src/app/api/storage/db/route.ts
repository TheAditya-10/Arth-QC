import { NextResponse, type NextRequest } from "next/server";
import { verifyLocalToken } from "@/lib/storage/local.driver";
import { DB_DRIVER_MAX_BYTES, readDbObject, writeDbObject } from "@/lib/storage/db.driver";
import { storageDriverName } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Presigned PUT/GET endpoint for the Postgres storage driver (token = HMAC-signed, short-lived). */
export async function PUT(req: NextRequest) {
  if (storageDriverName() !== "db") return new NextResponse("Not found", { status: 404 });
  const t = verifyLocalToken(req.nextUrl.searchParams.get("token") ?? "");
  if (!t || t.op !== "put") return new NextResponse("Forbidden", { status: 403 });
  if (req.headers.get("content-type") !== t.type) return new NextResponse("Content-Type mismatch", { status: 403 });
  const declared = Number(req.headers.get("content-length") ?? t.len);
  if (declared !== t.len || (t.len ?? 0) > DB_DRIVER_MAX_BYTES) return new NextResponse("Content-Length mismatch", { status: 403 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength !== t.len) return new NextResponse("Content-Length mismatch", { status: 403 });
  await writeDbObject(t.key, bytes, t.type!);
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest) {
  if (storageDriverName() !== "db") return new NextResponse("Not found", { status: 404 });
  const t = verifyLocalToken(req.nextUrl.searchParams.get("token") ?? "");
  if (!t || t.op !== "get") return new NextResponse("Forbidden", { status: 403 });
  const row = await readDbObject(t.key);
  if (!row) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(row.data), {
    headers: { "Content-Type": row.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
}
