import { create as createYoutubeDl } from "youtube-dl-exec";
import path from "path";

const YTDLP_BINARY_PATH = path.join(
  process.cwd(),
  "node_modules",
  "youtube-dl-exec",
  "bin",
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
);

const youtubedl = createYoutubeDl(YTDLP_BINARY_PATH);

export type PlatformId = "youtube" | "facebook" | "instagram";

export interface StreamOption {
  formatId: string;
  label: string;
  ext: string;
  vcodec: string | null;
  acodec: string | null;
  filesizeBytes: number | null;
  isProgressive: boolean;
  isH264: boolean;
}

export interface VideoInfoResult {
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  uploader: string | null;
  videoOptions: StreamOption[];
  audioOptions: StreamOption[];
}

// Keep only options supported by the installed youtube-dl-exec typings.
const FORMAT_SORT = ["codec:h264", "codec:aac"] as any;

function isH264Codec(vcodec: string | null | undefined): boolean {
  if (!vcodec) return false;
  return vcodec.startsWith("avc1") || vcodec.startsWith("h264");
}

function isPoorlySupportedCodec(vcodec: string | null | undefined): boolean {
  if (!vcodec) return false;
  return (
    vcodec.startsWith("av01") ||
    vcodec.includes("vp9") ||
    vcodec.includes("vp09") ||
    vcodec.includes("vp8")
  );
}

export async function fetchVideoInfo(url: string): Promise<VideoInfoResult> {
  const raw = await youtubedl(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: false,
    noPlaylist: true,
    formatSort: FORMAT_SORT,
  });

  const data = raw as any;
  const formats: any[] = Array.isArray(data.formats) ? data.formats : [];
  const videoOptions: StreamOption[] = [];
  const audioOptions: StreamOption[] = [];

  for (const f of formats) {
    const vcodec: string | null = f.vcodec && f.vcodec !== "none" ? f.vcodec : null;
    const acodec: string | null = f.acodec && f.acodec !== "none" ? f.acodec : null;
    const ext: string = f.ext || "";
    const formatId: string = f.format_id || "";
    const filesize: number | null = f.filesize ?? f.filesize_approx ?? null;
    if (!formatId) continue;

    if (vcodec) {
      const height = f.height || 0;
      if (height <= 0) continue;
      if (ext !== "mp4" && ext !== "webm") continue;
      videoOptions.push({
        formatId,
        label: `${height}p`,
        ext,
        vcodec,
        acodec,
        filesizeBytes: filesize,
        isProgressive: !!acodec,
        isH264: isH264Codec(vcodec),
      });
    } else if (acodec) {
      const abr = f.abr || 0;
      audioOptions.push({
        formatId,
        label: abr > 0 ? `${Math.round(abr)} kbps` : "Audio",
        ext: ext || "m4a",
        vcodec: null,
        acodec,
        filesizeBytes: filesize,
        isProgressive: false,
        isH264: false,
      });
    }
  }

  const bestPerHeight = new Map<string, StreamOption>();
  for (const opt of videoOptions) {
    const key = opt.label;
    const existing = bestPerHeight.get(key);
    const shouldReplace =
      !existing ||
      (opt.isH264 && !existing.isH264) ||
      (opt.isH264 === existing.isH264 && existing.ext !== "mp4" && opt.ext === "mp4");
    if (shouldReplace) bestPerHeight.set(key, opt);
  }
  const dedupedVideo = Array.from(bestPerHeight.values()).sort((a, b) => {
    const heightA = parseInt(a.label, 10) || 0;
    const heightB = parseInt(b.label, 10) || 0;
    return heightB - heightA;
  });

  const bestAudioPerLabel = new Map<string, StreamOption>();
  for (const opt of audioOptions) {
    if (!bestAudioPerLabel.has(opt.label)) bestAudioPerLabel.set(opt.label, opt);
  }
  const dedupedAudio = Array.from(bestAudioPerLabel.values());

  return {
    title: data.title || "Video",
    thumbnailUrl: data.thumbnail || null,
    durationSeconds: typeof data.duration === "number" ? data.duration : null,
    uploader: data.uploader || data.channel || null,
    videoOptions: dedupedVideo,
    audioOptions: dedupedAudio.length > 0 ? dedupedAudio : [],
  };
}

export interface ResolvedStream {
  videoUrl: string;
  audioUrl: string | null;
  needsSeparateAudio: boolean;
}

export async function resolveStreamUrl(
  url: string,
  formatId: string,
  isProgressive: boolean
): Promise<ResolvedStream> {
  if (isProgressive) {
    const raw = await youtubedl(url, {
      format: formatId,
      getUrl: true,
      noWarnings: true,
      noCheckCertificates: true,
      noPlaylist: true,
      formatSort: FORMAT_SORT,
    });
    const videoUrl = String(raw).trim().split("\n")[0];
    return { videoUrl, audioUrl: null, needsSeparateAudio: false };
  }

  const raw = await youtubedl(url, {
    format: `${formatId}+bestaudio`,
    getUrl: true,
    noWarnings: true,
    noCheckCertificates: true,
    noPlaylist: true,
    formatSort: FORMAT_SORT,
  });
  const lines = String(raw).trim().split("\n").filter(Boolean);
  const videoUrl = lines[0];
  const audioUrl = lines.length > 1 ? lines[1] : null;

  return {
    videoUrl,
    audioUrl,
    needsSeparateAudio: !!audioUrl,
  };
}

export { isH264Codec, isPoorlySupportedCodec };
