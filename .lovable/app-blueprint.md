# Velora App Blueprint — Complete Configuration Reference
# Created: 2026-02-15
# Purpose: After remixing, read this file to restore full app functionality by just entering R2 credentials.

---

## 1. REQUIRED SECRETS (Enter these after remix)

| Secret Name | Where to Get | Example Value |
|---|---|---|
| `R2_ACCESS_KEY_ID` | Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create Token (Object Read & Write) | 32-char string |
| `R2_SECRET_ACCESS_KEY` | Same token creation page | 64-char string |
| `R2_ENDPOINT` | Cloudflare R2 bucket settings | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET_NAME` | Cloudflare R2 | `wallpaper` |
| `R2_PUBLIC_URL` | Cloudflare R2 bucket public URL | `https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev` |

**IMPORTANT**: The R2 public CDN URL is: `https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev`
The bucket name is: `wallpaper`

---

## 2. IMAGE PROXY URL PATTERN

All assets are served through the Supabase image-proxy edge function:
- Static wallpapers: `https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/image-proxy/static/<filename>.jpg`
- Live wallpapers: `https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/image-proxy/live/<filename>.mp4`

The image-proxy fetches from R2: `https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev/<path>`

**After remix, the SUPABASE_PROJECT_ID will change.** All URLs stored in DB reference the old project ID. You need to either:
- Run a SQL update to replace old project URLs with new ones, OR
- The URLs are dynamically constructed so the DB already stores full URLs — you'll need to update them.

### URL Update SQL (run after remix)
```sql
-- Replace OLD_PROJECT_ID with the old Supabase project ID
-- Replace NEW_PROJECT_ID with the new Supabase project ID

UPDATE wallpapers 
SET image_url = REPLACE(image_url, 'OLD_PROJECT_ID', 'NEW_PROJECT_ID');

UPDATE categories 
SET thumbnail_url = REPLACE(thumbnail_url, 'OLD_PROJECT_ID', 'NEW_PROJECT_ID');

UPDATE live_wallpapers 
SET video_url = REPLACE(video_url, 'OLD_PROJECT_ID', 'NEW_PROJECT_ID');
```

Current project ID: `knollkfojgrxlqktqwkc`

---

## 3. DATABASE SCHEMA

### Table: `categories` (20 categories)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | auto-generated |
| name | text | Display name |
| slug | text | URL-safe identifier |
| thumbnail_url | text nullable | Full proxy URL to thumbnail image |
| sort_order | int | Display order |
| created_at | timestamptz | auto |

### Table: `wallpapers` (1,001 static wallpapers)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | auto-generated |
| title | text | Display name |
| image_url | text | Full proxy URL |
| is_premium | bool | Premium flag |
| category_id | uuid FK→categories | Category reference |
| sort_order | int | Display order |
| created_at | timestamptz | auto |

### Table: `live_wallpapers` (184 live video wallpapers)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | auto-generated |
| title | text | Display name |
| subtitle | text nullable | Secondary text |
| video_url | text | Full proxy URL to .mp4 |
| category | text | Category string (not FK) |
| is_premium | bool | Premium flag |
| sort_order | int | Display order |
| created_at | timestamptz | auto |

### Table: `user_roles` (RBAC for admin)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | auto-generated |
| user_id | uuid | Auth user reference |
| role | app_role enum | 'admin', 'moderator', 'user' |

### Enum: `app_role` = 'admin' | 'moderator' | 'user'

### Function: `has_role(_user_id uuid, _role app_role)` → boolean

---

## 4. CATEGORY DATA (Complete Reference)

| Name | Slug | Wallpaper Count | Thumbnail File |
|---|---|---|---|
| Viral | viral | 115 | static/batch4-wolf-aurora-peak.jpg |
| Nature | nature | 117 | static/nature-4.jpg |
| Abstract | abstract | 96 | static/abstract-1.jpg |
| Space | space | 79 | static/space-1.jpg |
| Minimal | minimal | 30 | static/minimal-2.jpg |
| Urban | urban | 40 | static/urban-1.jpg |
| Dark AMOLED | dark-amoled | 51 | static/dark-2.jpg |
| Anime | anime | 40 | static/anime-2.jpg |
| Floral | floral | 32 | static/floral-1.jpg |
| Post Apocalyptic | post-apocalyptic | 41 | static/postapoc-1.jpg |
| Nihilist Penguin | penguin | 26 | static/penguin-4.jpg |
| Samurai | samurai | 39 | static/samurai-1.jpg |
| Cars | cars | 60 | static/cars-1.jpg |
| Motivation | motivation | 13 | static/motivation-1.jpg |
| Live Wallpaper | live-wallpaper | 0 | static/live/live-nebula.jpg |
| Gaming | gaming | 9 | static/gaming-arena.jpg |
| Superheroes | superheroes | 150 | static/batch4-superhero-shield-storm.jpg |
| Animals | animals | 49 | static/animal-white-tiger-glow.jpg |
| Cyberpunk | cyberpunk | 7 | static/cyberpunk-bike.jpg |
| Aesthetic | aesthetic | 7 | static/aesthetic-sakura-pond.jpg |

---

## 5. LIVE WALLPAPER CATEGORIES

| Category | Count |
|---|---|
| samurai | 27 |
| cosmic | 31 |
| nature | 24 |
| superheroes | 37 |
| animals | 16 |
| fantasy | 13 |
| warrior | 10 |
| sci-fi | 10 |
| cars | 7 |
| penguin | 7 |
| anime | 2 |

---

## 6. CURATED HOME FEED CONFIGURATION

The home feed (`useHomeFeed.ts`) uses specific curated live wallpaper IDs for the top of the feed:

```
CURATED_LIVE_IDS = [
  "08ebfbfa-4eaf-42a3-847b-af9ad0fd58bf", // Nihilist Penguin Reference — FIRST
  "0ac27ae2-25a2-4bcf-8639-af03ef050c03", // Doom Sorcery Power
  "7a779cca-fb04-422a-ad19-befce0eea880", // Crimson Autumn
  "a4359b34-0a8b-4883-b983-fd6756045543", // Autumn Cliff Samurai
  "3c66fa4b-12f4-4aa6-a43f-7d7a3a4b8682", // Crimson Field Ronin
  "2780103d-f35b-45e4-9417-31279b63e9c6", // Red Field Ronin
]
```

**Feed Pattern**: Lead with Nihilist Penguin (live) → 2 static → 1 live → repeat (2:1 ratio)
**Static Diversity**: Round-robin across ALL categories (2 items per category per page) for visual variety

**NOTE**: After remix, these UUIDs will be different if the DB is re-seeded. You'll need to find the new IDs by title:
- `Nihilist Penguin Reference`
- `Doom Sorcery Power`
- `Crimson Autumn`
- `Autumn Cliff Samurai`
- `Crimson Field Ronin`
- `Red Field Ronin`

---

## 7. LIVE WALLPAPER PAGE CATEGORIES (UI Pills)

```
categoryList = [
  { id: "all", label: "All", icon: "🔥" },
  { id: "samurai", label: "Samurai", icon: "⚔️" },
  { id: "warrior", label: "Warrior", icon: "🛡️" },
  { id: "nature", label: "Nature", icon: "🌿" },
  { id: "cosmic", label: "Cosmic", icon: "🌌" },
  { id: "sci-fi", label: "Sci-Fi", icon: "🤖" },
  { id: "fantasy", label: "Fantasy", icon: "🐉" },
  { id: "anime", label: "Anime", icon: "🎨" },
  { id: "cars", label: "Cars", icon: "🏎️" },
  { id: "superheroes", label: "Superheroes", icon: "🦸" },
  { id: "penguin", label: "Penguin", icon: "🐧" },
  { id: "animals", label: "Animals", icon: "🐾" },
]
```

---

## 8. BOTTOM NAVIGATION TABS

| Path | Icon | Label |
|---|---|---|
| / | Compass | Explore |
| /categories | Grid3X3 | Categories |
| /live-wallpapers | Sparkles | Live |
| /favorites | Heart | Favorites |
| /test | FlaskConical | Test |

Hidden on: `/categories/:id`, `/admin/*`

---

## 9. APP ROUTES

| Route | Component | Purpose |
|---|---|---|
| / | Explore | Home feed (interleaved static + live) |
| /categories | Categories | Category grid |
| /categories/:id | CategoryView | Category wallpaper list |
| /favorites | Favorites | Saved wallpapers |
| /live-wallpapers | LiveWallpapers | Live wallpaper browser |
| /edge-lighting | EdgeLightingPage | Edge lighting feature |
| /admin/login | AdminLogin | Admin auth |
| /admin | AdminDashboard | Admin panel |
| /admin/files | FileManager | R2 file management |

**Special**: `/categories/live-wallpaper` redirects to `/live-wallpapers`

---

## 10. DESIGN SYSTEM

### Color Tokens (HSL)
| Token | Value | Usage |
|---|---|---|
| --background | 230 25% 6% | Deep dark blue-black |
| --foreground | 220 20% 98% | Light text |
| --card | 230 25% 8% | Card backgrounds |
| --primary | 45 93% 60% | Rich Gold (brand) |
| --secondary | 230 25% 12% | Secondary surfaces |
| --accent | 250 80% 65% | Vivid Indigo |
| --muted | 230 20% 16% | Muted surfaces |
| --premium-gold | 45 93% 60% | Premium badge |
| --premium-gold-glow | 40 100% 70% | Premium glow |
| --radius | 1.25rem | Border radius |

### Custom Utilities
- `.glass-surface` — Glassmorphism with blur
- `.glass-nav` — Navigation glass effect
- `.premium-gradient` — Gold gradient for premium elements
- `.text-premium` — Gold gradient text
- `.golden-glow` — Gold box-shadow
- `.golden-border` — Subtle gold border
- `.shimmer-skeleton` — YouTube-style loading animation
- `.safe-top` / `.safe-bottom` — Safe area insets

### Typography
- Body: Inter, SF Pro Display, system-ui
- Display: SF Pro Display, Inter, system-ui
- App title uses `.text-premium` gradient

---

## 11. KEY ARCHITECTURAL PATTERNS

### Image Loading
- `useProxyImage` hook: Fetches images via CORS fetch → blob URL (bypasses ORB blocking)
- Concurrency limiter: max 8 simultaneous fetches
- In-memory blob cache survives component re-mounts
- Cache-buster rotates every 60 seconds

### Video Playback (Live Wallpapers)
- Global concurrent limiter: max 4 playing videos
- IntersectionObserver triggers play/pause
- Waiting queue for videos beyond the limit

### Pagination
- Static wallpapers: 20 per page
- Live wallpapers: 20 per page (8 per page in home feed)
- Infinite scroll with 800px trigger distance

### Premium System
- localStorage-based (`velora_premium_unlocked`)
- Premium wallpapers show "Pro" Diamond badge
- Plans: 1 Day/$0.99, 7 Days/$2.99, 1 Month/$4.99, 1 Year/$19.99, Lifetime/$29.99
- Currently unlocks instantly (no payment integration)

### Favorites
- localStorage-based (`velora-favorites`)
- Array of wallpaper IDs

---

## 12. EDGE FUNCTIONS

| Function | Purpose |
|---|---|
| image-proxy | Proxies R2 assets with CORS headers and caching |
| r2-manager | Upload/delete/audit/check files on R2 |
| seed-wallpapers | Seed static wallpaper DB records |
| seed-live-wallpapers | Seed live wallpaper DB records |
| setup-admin | Create initial admin user |
| check-r2-files | Check R2 file existence |
| generate-missing | AI-regenerate missing wallpapers |
| migrate-to-r2 | Migration tool |

---

## 13. R2 FILE STRUCTURE

```
wallpaper/
├── static/
│   ├── abstract-1.jpg
│   ├── abstract-2.jpg
│   ├── ... (1001 static wallpapers)
│   ├── batch4-superhero-shield-storm.jpg
│   └── live/
│       └── live-nebula.jpg (category thumbnail)
└── live/
    ├── autumn-cliff-samurai.mp4
    ├── crimson-field-ronin.mp4
    ├── ... (184 live wallpapers)
    └── sh-doom-sorcery-power.mp4
```

---

## 14. POST-REMIX CHECKLIST

1. ✅ Enter all 5 R2 secrets (Section 1)
2. ✅ Run URL update SQL (Section 2) — replace old project ID with new one
3. ✅ Update CURATED_LIVE_IDS if DB was re-seeded (Section 6)
4. ✅ Verify image-proxy edge function works
5. ✅ Test home feed loads wallpapers
6. ✅ Test categories page shows thumbnails
7. ✅ Test live wallpapers page plays videos
8. ✅ Run setup-admin edge function if admin access needed

---

## 15. NATIVE ANDROID FEATURES

- **WallpaperSetterPlugin**: Set static wallpapers to home/lock/both screens
- **LiveWallpaperPlugin**: Download + set video as Android live wallpaper
- **EdgeLightingPlugin**: Edge lighting effects (disabled in main nav)
- Package: `com.aurawalls.app`
- Capacitor 8.x based

---

## 16. CONTENT STATS (as of 2026-02-15)

- Static wallpapers: 1,001
- Live wallpapers: 184
- Categories: 20 (19 static + 1 "Live Wallpaper" redirect)
- Live wallpaper categories: 11
- Total assets on R2: ~1,185 files
