import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { env } from "@/lib/env";
import { localPath, verifyLocalToken, writeLocal } from "@/lib/storage/local.driver";

/** Development stand-in for R2 presigned URLs. Disabled when R2 is the active driver. */
function enabled() {
  const e = env();
  return (e.STORAGE_DRIVER ?? (e.R2_BUCKET ? "r2" : "local")) === "local" && (e.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_STORAGE);
}

export async function PUT(req: NextRequest) {
  if (!enabled()) return new NextResponse("Not found", { status: 404 });
  const t = verifyLocalToken(req.nextUrl.searchParams.get("token") ?? "");
  if (!t || t.op !== "put") return new NextResponse("Forbidden", { status: 403 });
  if (req.headers.get("content-type") !== t.type) return new NextResponse("Content-Type mismatch", { status: 403 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength !== t.len) return new NextResponse("Content-Length mismatch", { status: 403 });
  await writeLocal(t.key, bytes, t.type!);
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest) {
  if (!enabled()) return new NextResponse("Not found", { status: 404 });
  const t = verifyLocalToken(req.nextUrl.searchParams.get("token") ?? "");
  if (!t || t.op !== "get") return new NextResponse("Forbidden", { status: 403 });
  try {
    const p = localPath(t.key);
    const meta = JSON.parse(await readFile(`${p}.meta`, "utf8"));
    return new NextResponse(new Uint8Array(await readFile(p)), {
      headers: { "Content-Type": meta.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
