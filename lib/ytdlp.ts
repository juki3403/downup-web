import ytdl from "@distube/ytdl-core";

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

function toNumber(value: string | number | undefined | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchVideoInfo(url: string): Promise<VideoInfoResult> {
  if (!ytdl.validateURL(url)) {
    throw new Error("URL YouTube tidak valid");
  }

  const info = await ytdl.getInfo(url);
  const formats = Array.isArray(info.formats) ? info.formats : [];
  const videoOptions: StreamOption[] = [];
  const audioOptions: StreamOption[] = [];

  for (const f of formats) {
    const vcodec = f.videoCodec || (f.hasVideo ? f.codecs?.split(",")[0]?.trim() : null) || null;
    const acodec = f.audioCodec || (f.hasAudio ? f.codecs?.split(",")[1]?.trim() : null) || null;
    const ext = f.container || (f.mimeType?.split("/")[1]?.split(";")[0] ?? "");
    const formatId = String(f.itag);
    const filesize = toNumber(f.contentLength);

    if (f.hasVideo && f.height) {
      if (ext !== "mp4" && ext !== "webm") continue;
      videoOptions.push({
        formatId,
        label: f.qualityLabel || `${f.height}p`,
        ext,
        vcodec,
        acodec,
        filesizeBytes: filesize,
        isProgressive: !!f.hasAudio,
        isH264: isH264Codec(vcodec),
      });
    } else if (f.hasAudio) {
      const bitrate = f.audioBitrate || f.averageBitrate || 0;
      audioOptions.push({
        formatId,
        label: bitrate > 0 ? `${Math.round(bitrate)} kbps` : "Audio",
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
      (opt.isH264 === existing.isH264 && existing.ext !== "mp4" && opt.ext === "mp4") ||
      (opt.isProgressive && !existing.isProgressive);
    if (shouldReplace) bestPerHeight.set(key, opt);
  }

  const dedupedVideo = Array.from(bestPerHeight.values()).sort((a, b) => {
    const heightA = parseInt(a.label, 10) || 0;
    const heightB = parseInt(b.label, 10) || 0;
    return heightB - heightA;
  });

  const bestAudioPerLabel = new Map<string, StreamOption>();
  for (const opt of audioOptions) {
    const existing = bestAudioPerLabel.get(opt.label);
    if (!existing || (opt.filesizeBytes ?? 0) > (existing.filesizeBytes ?? 0)) {
      bestAudioPerLabel.set(opt.label, opt);
    }
  }

  return {
    title: info.videoDetails.title || "Video",
    thumbnailUrl: info.videoDetails.thumbnails?.[0]?.url || null,
    durationSeconds: toNumber(info.videoDetails.lengthSeconds),
    uploader: info.videoDetails.author || null,
    videoOptions: dedupedVideo,
    audioOptions: Array.from(bestAudioPerLabel.values()),
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
  if (!ytdl.validateURL(url)) {
    throw new Error("URL YouTube tidak valid");
  }

  const info = await ytdl.getInfo(url);
  const selected = info.formats.find((f) => String(f.itag) === formatId);
  if (!selected) throw new Error("Format video tidak ditemukan");

  if (isProgressive || selected.hasAudio) {
    return {
      videoUrl: selected.url,
      audioUrl: null,
      needsSeparateAudio: false,
    };
  }

  const audioFormats = info.formats
    .filter((f) => f.hasAudio && !f.hasVideo && f.url)
    .sort((a, b) => (b.audioBitrate || b.averageBitrate || 0) - (a.audioBitrate || a.averageBitrate || 0));

  const audio = audioFormats[0];
  return {
    videoUrl: selected.url,
    audioUrl: audio?.url || null,
    needsSeparateAudio: !!audio,
  };
}

export { isH264Codec, isPoorlySupportedCodec };
