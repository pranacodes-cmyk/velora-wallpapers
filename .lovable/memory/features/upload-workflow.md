Manual asset ingestion workflow for Christian Wallpapers app.

## Upload Components
- Local raw seeders were removed from `/test` after assets were moved to R2.
- `LiveWallpaperUploader`: File picker for MP4s, uploads 4 in parallel to R2 via `r2-manager`. Category + title editable per video. No manifest dependency — pure file-based.

## R2 Upload Flow
- Key format: `static/{filename}` or `live/{filename}`
- Edge function: `r2-manager?action=upload-and-register`
- Sends FormData with file, key, type, title, category
- Auth: anon key in Authorization + apikey headers

## Test Page (`/test`)
- Shows clean workspace status only; it must not mount local raw seeders or legacy preview sections.
- Accessible via temporary header button.
- No local test images/videos stored — content lives in R2 after upload.

## Local Files Policy
- No raw generated clips/images should live in `public/test-walls/`, `remotion/public/clips`, `remotion/public/videos`, `remotion/public/images`, or `remotion/public/screenshots`.
- Do not recreate local manifests for uploaded assets.
- Render one-off outputs to `/mnt/documents/`, then push final assets to R2.
