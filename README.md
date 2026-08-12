# DownUp Web

Versi web dari DownUp — download video YouTube, Facebook, dan Instagram
directly dari browser, di-deploy di Vercel.

## Arsitektur (penting dibaca sebelum deploy)

Vercel serverless function punya keterbatasan keras: durasi eksekusi
terbatas (default 10 detik di Hobby, bisa 60 detik dengan konfigurasi
`maxDuration`) dan **tidak ada disk persisten**. Karena itu, proyek ini
**tidak** mendownload atau memproses file video sama sekali di server.

Alurnya:
1. Server (Vercel Function) memanggil yt-dlp HANYA untuk dua hal ringan:
   - Ambil metadata (judul, thumbnail, daftar kualitas) — endpoint
     `/api/fetch-info`
   - Resolve satu format_id pilihan user menjadi URL stream ASLI
     (langsung ke CDN platform, mis. `googlevideo.com`,
     `fbcdn.net`) — endpoint `/api/resolve`
2. Browser user sendiri yang melakukan request GET ke URL CDN itu untuk
   mengunduh file — server DownUp Web **tidak pernah** menyentuh video
   itu sendiri.

Ini sama seperti prinsip kerja [cobalt](https://github.com/imputnet/cobalt)
(referensi open-source 40k+ star yang dipelajari untuk proyek ini) — bedanya
cobalt reverse-engineer API tiap platform sendiri, sedangkan proyek ini
memakai yt-dlp sebagai mesin ekstraksi (sudah terbukti jalan baik di versi
Android app kita sebelumnya).

## ⚠️ Keterbatasan yang jujur perlu diketahui

**Kualitas tinggi yang butuh merge video+audio TIDAK bisa jadi satu file
otomatis di browser.** yt-dlp biasa melakukan merge ini pakai ffmpeg — tapi
ffmpeg butuh proses di server yang App Router Vercel tidak cocok untuk itu
(limit bundle 250MB, limit durasi, dan ffmpeg sendiri "tidak direkomendasikan"
resmi oleh Vercel untuk serverless function). Untuk kualitas semacam ini,
sistem memberi user **2 link terpisah** (video tanpa audio, dan audio) dengan
instruksi jelas untuk menggabungkannya manual (VLC, atau situs gratis seperti
online-video-cutter.com).

Kualitas **progresif** (video+audio sudah satu stream dari sumbernya —
biasanya tersedia sampai 720p) tetap bisa didownload sebagai satu file
langsung tanpa masalah ini.

**Instagram sering minta login** bahkan untuk konten publik — ini
pembatasan dari sisi Instagram sendiri (anti-bot), bukan bug proyek ini.
Sudah kita temukan pola yang sama saat mengerjakan versi Android app.

**YouTube makin agresif melawan downloader** di 2026 — bahkan cobalt.tools
(proyek 40k+ star) melaporkan instance publik mereka diblokir YouTube.
Kalau fetch YouTube gagal terus-menerus, itu kemungkinan besar bukan bug
kode, tapi pembatasan terbaru dari YouTube yang butuh workaround lanjutan
(cookies, proxy khusus) di luar scope setup dasar ini.

## Setup lokal

```bash
npm install
cp .env.example .env
npm run dev
```

Buka http://localhost:3000

## Deploy ke Vercel

### 1. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <url-repo-kamu>
git push -u origin main
```

### 2. Import project di Vercel

- Buka https://vercel.com/new
- Import repo GitHub yang baru dibuat
- Framework Preset akan otomatis terdeteksi sebagai **Next.js**

### 3. WAJIB — Set Environment Variable

Sebelum klik Deploy, buka tab **Environment Variables** dan tambahkan:

```
YOUTUBE_DL_SKIP_PYTHON = 1
```

**Ini wajib**, bukan opsional. Tanpa ini, proses `npm install` di server
Vercel akan gagal karena package `youtube-dl-exec` mencoba mengecek
`python3` tersedia di sistem — sesuatu yang tidak selalu ada di environment
build Vercel. Binary yt-dlp standalone yang didownload package ini sudah
menyertakan Python sendiri (dibundel PyInstaller), jadi pengecekan itu
aman dilewati.

### 4. Deploy

Klik **Deploy**. Build pertama biasanya makan waktu 1-3 menit (termasuk
proses download binary yt-dlp ~15-20MB saat `npm install`).

## Struktur project

```
app/
  api/
    fetch-info/route.ts   — POST: ambil metadata + daftar kualitas
    resolve/route.ts      — POST: resolve format_id -> URL stream asli
  layout.tsx
  page.tsx
  globals.css
components/
  Downloader.tsx           — seluruh UI interaktif (client component)
lib/
  ytdlp.ts                 — wrapper yt-dlp, logic fetch & resolve
next.config.js              — outputFileTracingIncludes (wajib untuk
                               bundling binary yt-dlp ke Vercel Function)
```

## Kenapa H.264 diprioritaskan?

Sama seperti pelajaran dari versi Android app: banyak player TIDAK bisa
memutar video dengan codec AV1/VP9 meski dibungkus `.mp4`. Kode di
`lib/ytdlp.ts` memakai kombinasi **exclude filter eksplisit**
(`vcodec!*=av01`, `vcodec!*=vp09`) DAN **`--format-sort codec:h264:aac`**
untuk memaksa H.264 diprioritaskan — satu filter saja terbukti tidak
selalu cukup kuat melawan default sorting internal yt-dlp yang kadang
menomorsatukan AV1.
