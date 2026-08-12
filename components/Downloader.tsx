"use client";

import { useState } from "react";

type Platform = "youtube" | "facebook" | "instagram";
type Mode = "video" | "audio";

interface StreamOption {
  formatId: string;
  label: string;
  ext: string;
  vcodec: string | null;
  acodec: string | null;
  filesizeBytes: number | null;
  isProgressive: boolean;
  isH264: boolean;
}

interface VideoInfoResult {
  platform: Platform;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  uploader: string | null;
  videoOptions: StreamOption[];
  audioOptions: StreamOption[];
}

const PLATFORM_META: Record<Platform, { label: string; color: string; placeholder: string }> = {
  youtube: { label: "▶ YouTube", color: "#FF0000", placeholder: "https://www.youtube.com/watch?v=..." },
  facebook: { label: "f Facebook", color: "#1877F2", placeholder: "https://www.facebook.com/.../videos/..." },
  instagram: { label: "📷 Instagram", color: "#E1306C", placeholder: "https://www.instagram.com/reel/..." },
};

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Downloader() {
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfoResult | null>(null);
  const [separateLinks, setSeparateLinks] = useState<{ videoUrl: string; audioUrl: string; title: string } | null>(null);
  const [downloadHint, setDownloadHint] = useState(false);

  async function handleFetch() {
    setError(null); setInfo(null);
    if (!url.trim()) { setError("Masukkan URL video terlebih dahulu"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/fetch-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil data video");
      setInfo(data); setMode("video");
    } catch (err: any) { setError(err.message || "Terjadi kesalahan"); }
    finally { setLoading(false); }
  }

  async function handleDownload(opt: StreamOption) {
    if (!info) return;
    setError(null); setResolving(opt.formatId);
    try {
      const res = await fetch("/api/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), formatId: opt.formatId, isProgressive: mode === "audio" ? true : opt.isProgressive }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal resolve link download");
      if (data.needsSeparateAudio && data.audioUrl) { setSeparateLinks({ videoUrl: data.videoUrl, audioUrl: data.audioUrl, title: info.title }); return; }
      window.open(data.videoUrl, "_blank", "noopener,noreferrer");
      setDownloadHint(true);
    } catch (err: any) { setError(err.message || "Gagal memulai download"); }
    finally { setResolving(null); }
  }

  const meta = PLATFORM_META[platform];
  const options = mode === "video" ? info?.videoOptions ?? [] : info?.audioOptions ?? [];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", minHeight: "100vh" }}>
      <header style={{ background: "#FF0000", padding: 20 }}><h1 style={{ fontSize: 22, fontWeight: 700 }}>▶ DownUp</h1></header>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(Object.keys(PLATFORM_META) as Platform[]).map((p) => <button key={p} onClick={() => setPlatform(p)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: p === platform ? "#fff" : "#aaa", background: p === platform ? PLATFORM_META[p].color : "#2a2a2a" }}>{PLATFORM_META[p].label}</button>)}
        </div>
        <div style={{ background: "#1e1e1e", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 6 }}>URL Video</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={meta.placeholder} style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #333", color: "#fff", fontSize: 14, paddingBottom: 8, marginBottom: 12, outline: "none" }} />
          <button onClick={handleFetch} disabled={loading} style={{ width: "100%", height: 44, borderRadius: 6, background: meta.color, color: "#fff", fontSize: 15, fontWeight: 700, opacity: loading ? 0.6 : 1 }}>{loading ? "Mengambil data…" : "⬇ AMBIL VIDEO"}</button>
        </div>
        {error && <div style={{ background: "#2a1414", border: "1px solid #ff4444", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#ff8888" }}>❌ {error}</div>}
        {downloadHint && <div style={{ background: "#142a1e", border: "1px solid #2e7d4f", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#8fd6ac", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><span>ℹ️ Tab baru sudah terbuka. Kalau video langsung terputar (bukan otomatis ter-download), klik kanan pada video → <strong>Save Video As…</strong> untuk menyimpannya. Ini keterbatasan browser untuk link dari CDN luar, bukan bug.</span><button onClick={() => setDownloadHint(false)} style={{ background: "transparent", color: "#8fd6ac", fontSize: 14, flexShrink: 0 }}>✕</button></div>}
        {info && <div style={{ background: "#1e1e1e", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            {info.thumbnailUrl && <img src={info.thumbnailUrl} alt="" width={110} height={72} style={{ objectFit: "cover", borderRadius: 6, background: "#2a2a2a" }} />}
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{info.title}</div><div style={{ fontSize: 12, color: "#888" }}>{info.uploader ? `${info.uploader} • ` : ""}{formatDuration(info.durationSeconds)}</div></div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button onClick={() => setMode("video")} style={{ padding: "6px 16px", borderRadius: 14, fontSize: 12, fontWeight: 700, color: mode === "video" ? "#fff" : "#aaa", background: mode === "video" ? meta.color : "#2a2a2a" }}>🎬 MP4</button>
            <button onClick={() => setMode("audio")} style={{ padding: "6px 16px", borderRadius: 14, fontSize: 12, fontWeight: 700, color: mode === "audio" ? "#fff" : "#aaa", background: mode === "audio" ? meta.color : "#2a2a2a" }}>🎵 MP3</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {options.length === 0 && <div style={{ fontSize: 12, color: "#666" }}>Tidak ada opsi tersedia</div>}
            {options.map((opt) => { const warn = mode === "video" && opt.vcodec && !opt.isH264; const needsMerge = mode === "video" && !opt.isProgressive; return <button key={opt.formatId} onClick={() => handleDownload(opt)} disabled={resolving === opt.formatId} title={needsMerge ? "Kualitas ini butuh 2 file terpisah (video & audio) karena keterbatasan download langsung dari browser" : warn ? "Codec ini mungkin tidak bisa diputar di sebagian player bawaan" : undefined} style={{ padding: "10px 16px", borderRadius: 16, background: meta.color, color: "#fff", fontSize: 12, fontWeight: 700, opacity: resolving === opt.formatId ? 0.6 : 1 }}>{resolving === opt.formatId ? "Menyiapkan…" : `${opt.label}${formatSize(opt.filesizeBytes) ? " · " + formatSize(opt.filesizeBytes) : ""}${needsMerge ? " 🔗" : ""}${warn ? " ⚠" : ""}`}</button>; })}
          </div>
          {options.some((o) => mode === "video" && !o.isProgressive) && <div style={{ fontSize: 11, color: "#666", marginTop: 10 }}>🔗 = kualitas ini akan memberi 2 link terpisah (video & audio) — lihat instruksi setelah diklik</div>}
        </div>}
        {separateLinks && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={() => setSeparateLinks(null)}><div style={{ background: "#1e1e1e", borderRadius: 12, padding: 20, maxWidth: 480, width: "100%" }} onClick={(e) => e.stopPropagation()}><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🔗 Kualitas ini perlu 2 file terpisah</div><div style={{ fontSize: 13, color: "#aaa", marginBottom: 16, lineHeight: 1.5 }}>Browser tidak bisa menggabungkan video dan audio secara otomatis. Klik kedua tombol di bawah (masing-masing membuka tab baru) — kalau file langsung terputar alih-alih ter-download, klik kanan → <strong>Save Video/Audio As…</strong> untuk menyimpannya. Setelah itu gabungkan pakai VLC atau situs seperti online-video-cutter.com (gratis). Alternatif lebih mudah: pilih kualitas yang <strong>tidak</strong> ada tanda 🔗 — biasanya sampai 720p sudah tersedia sebagai satu file langsung.</div><a href={separateLinks.videoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: 12, borderRadius: 8, background: "#333", color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>⬇ Buka Video (tanpa audio)</a><a href={separateLinks.audioUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: 12, borderRadius: 8, background: "#333", color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>⬇ Buka Audio</a><button onClick={() => setSeparateLinks(null)} style={{ width: "100%", padding: 10, borderRadius: 8, background: "transparent", color: "#888", fontSize: 13 }}>Tutup</button></div></div>}
      </div>
    </div>
  );
}
