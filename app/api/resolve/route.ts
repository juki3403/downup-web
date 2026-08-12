import { NextRequest, NextResponse } from "next/server";
import { resolveStreamUrl } from "@/lib/ytdlp";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { url?: string; formatId?: string; isProgressive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  const url = body.url?.trim();
  const formatId = body.formatId?.trim();
  const isProgressive = !!body.isProgressive;

  if (!url || !formatId) {
    return NextResponse.json({ error: "url dan formatId wajib diisi" }, { status: 400 });
  }

  try {
    const resolved = await resolveStreamUrl(url, formatId, isProgressive);
    if (!resolved.videoUrl || !resolved.videoUrl.startsWith("http")) {
      throw new Error("URL stream tidak valid dari hasil resolve");
    }
    return NextResponse.json(resolved);
  } catch (err: any) {
    const message = err?.stderr || err?.message || "Gagal resolve link download";
    return NextResponse.json(
      { error: typeof message === "string" ? message.slice(0, 300) : "Gagal resolve link download" },
      { status: 500 }
    );
  }
}
