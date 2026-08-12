import { NextRequest, NextResponse } from "next/server";
import { fetchVideoInfo } from "@/lib/ytdlp";

export const maxDuration = 60;

function detectPlatform(url: string): "youtube" | "facebook" | "instagram" | null {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/instagram\.com/i.test(url)) return "instagram";
  return null;
}

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "URL wajib diisi" }, { status: 400 });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: "URL tidak dikenali. Gunakan link YouTube, Facebook, atau Instagram." },
      { status: 400 }
    );
  }

  try {
    // fetchVideoInfo currently accepts only the URL. Platform detection above
    // is kept for input validation; yt-dlp handles the supported extractor.
    const info = await fetchVideoInfo(url);
    return NextResponse.json(info);
  } catch (err: any) {
    const message = err?.stderr || err?.message || "Gagal mengambil informasi video";
    return NextResponse.json(
      { error: typeof message === "string" ? message.slice(0, 500) : "Gagal mengambil informasi video" },
      { status: 500 }
    );
  }
}
