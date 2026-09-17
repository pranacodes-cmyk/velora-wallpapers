PRAYLY - FULL CLOUD EXPORT (FLAT FOLDER)
========================================

This folder contains everything from the Lovable Cloud backend
so you can migrate to your own Supabase project.

FILES:
------
schema.sql               -- Full database schema (CREATE TYPE, CREATE TABLE, indexes, functions, policies, grants)
data.sql                 -- All table data as INSERT statements (categories, wallpapers, live_wallpapers)
config.toml              -- Supabase project configuration (edge function settings)
storage_info.txt         -- Storage buckets list and migration notes
secrets_to_set.txt       -- List of 17 secrets to recreate in your new project
auth_note.txt            -- How to handle auth users (cannot be exported)

Edge Functions (30 total):
edge-function-ai-pastoral.ts
edge-function-apply-upscale-bytes.ts
edge-function-apply-upscale.ts
edge-function-bible-companion.ts
edge-function-check-broken.ts
edge-function-check-r2-files.ts
edge-function-clone-data.ts
edge-function-export-data.ts
edge-function-firecrawl-scrape.ts
edge-function-firecrawl-search.ts
edge-function-full-seed.ts
edge-function-generate-day-narration.ts
edge-function-generate-missing.ts
edge-function-generate-prayer-audio.ts
edge-function-generate-thumbnails.ts
edge-function-generate-wallpaper.ts
edge-function-image-proxy.ts
edge-function-meta-capi.ts
edge-function-migrate-to-r2.ts
edge-function-push-ad-asset-to-r2.ts
edge-function-r2-manager.ts
edge-function-rank-live-wallpapers.ts
edge-function-revenuecat-webhook.ts
edge-function-scan-and-seed.ts
edge-function-seed-live-wallpapers.ts
edge-function-seed-wallpapers.ts
edge-function-setup-admin.ts
edge-function-upload-live-videos.ts
edge-function-upload-wallpaper.ts
edge-function-upscale-wallpapers.ts

MIGRATION STEPS:
----------------
1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run schema.sql
3. Run data.sql
4. Recreate the 3 storage buckets (wallpapers, reels, narrations) as public
5. Set the 17 secrets listed in secrets_to_set.txt
6. Deploy the 30 edge functions (use supabase CLI: supabase functions deploy)
7. Create your admin user via Supabase Auth, then insert one row into user_roles
8. Update your app code to point to the new Supabase URL and anon key

DATABASE COUNTS:
----------------
- categories:        8
- wallpapers:        282
- live_wallpapers:   211
- pending_assets:    0
- user_roles:        0 (admin row is not exportable, see auth_note.txt)

NOTE: Most image/video assets are hosted on R2 (Cloudflare), not in Supabase Storage.
The URLs in the database reference the image-proxy edge function or direct R2 URLs.
