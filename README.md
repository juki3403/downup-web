# DownUp Web

Versi web dari DownUp — download video YouTube, Facebook, dan Instagram langsung dari browser, di-deploy di Vercel.

## Setup Vercel

Wajib set environment variable berikut di Vercel Project Settings > Environment Variables **sebelum deploy**:

`YOUTUBE_DL_SKIP_PYTHON=1`

Kemudian jalankan `npm install` di folder project dan deploy ke Vercel.
