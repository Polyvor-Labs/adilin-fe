# Justika Frontend

Frontend statis untuk deploy ke Vercel. Browser memanggil endpoint relatif `/api/analyze`, lalu Vercel mem-proxy request itu ke backend:

```text
http://151.243.222.93:37990/api/analyze
```

Pola ini dipakai agar halaman HTTPS dari Vercel tidak melakukan request browser langsung ke backend HTTP.

## Deploy Vercel

1. Buat project Vercel baru dari repo ini.
2. Set Root Directory ke `frontend`.
3. Build Command kosongkan.
4. Output Directory kosongkan.
5. Deploy.

Health proxy tersedia di `/health`.

## Local Preview

```bash
npm run dev
```

Buka `http://127.0.0.1:5173`. Local dev server juga mem-proxy `/api/*` ke backend yang sama.
