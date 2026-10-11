import { useState, useCallback, useRef } from "react";
import { Upload, RefreshCw, Check, X, HardDrive, AlertTriangle, Rocket, Trash2, Pause, Play, Database, Zap, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AuditResult {
  name: string;
  exists: boolean;
  size: number;
  status: string;
}

interface AuditSummary {
  ok: number;
  tiny: number;
  missing: number;
  errors: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-manager`;
const SEED_LIVE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-live-wallpapers`;

function getHeaders() {
  return {
    "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

// Complete manifest of ALL 196 local MP4 files in public/live-wallpapers/
function getLocalLiveFiles(): string[] {
  return [
    "ai_neural_core.mp4",
    "animal-deer-firefly.mp4",
    "animal-eagle-swoop.mp4",
    "animal-horse-autumn.mp4",
    "animal-husky-run.mp4",
    "animal-jellyfish-glow.mp4",
    "animal-lion-roar.mp4",
    "animal-panther-prowl.mp4",
    "animal-tiger-fog.mp4",
    "animal-whale-deep.mp4",
    "animal-wolf-howl.mp4",
    "assassins_vigil.mp4",
    "aurora_frost.mp4",
    "autumn-cliff-samurai.mp4",
    "autumn-tunnel-walk.mp4",
    "batch2_coral_reef.mp4",
    "batch2_cyberpunk_rain.mp4",
    "batch2_galaxy_spin.mp4",
    "batch2_gaming_glow.mp4",
    "batch2_lambo_drive.mp4",
    "batch2_lavender_wind.mp4",
    "batch2_lightning_storm.mp4",
    "batch2_magic_tree.mp4",
    "batch2_samurai_blossom.mp4",
    "batch2_wolf_howl.mp4",
    "bio_wave_night.mp4",
    "black_hole_orbit.mp4",
    "blade_runner.mp4",
    "cherry_blossom_river.mp4",
    "cosmic-accretion-disk.mp4",
    "cosmic-black-hole.mp4",
    "cosmic-eclipse-cliff.mp4",
    "cosmic-fire-wave.mp4",
    "cosmic-galaxy-walk.mp4",
    "cosmic-meteor-rain.mp4",
    "cosmic-nebula-witness.mp4",
    "cosmic-ringed-planet.mp4",
    "cosmic-solar-flare.mp4",
    "cosmic-supernova-burst.mp4",
    "cosmic_nebula.mp4",
    "crimson-aura-meditation.mp4",
    "crimson-blade-forest.mp4",
    "crimson-field-ronin.mp4",
    "crimson_autumn.mp4",
    "crimson_mist_ronin.mp4",
    "crusaders_dawn.mp4",
    "crystal_cavern.mp4",
    "cyber_samurai_rain.mp4",
    "dark_castle_storm.mp4",
    "dark_paladin.mp4",
    "deep_abyss.mp4",
    "desert_mustang.mp4",
    "doom_castle_power.mp4",
    "dr-doom-power.mp4",
    "dragon_fire_moon.mp4",
    "dragon_peak.mp4",
    "dual_blade_dawn.mp4",
    "dune_sandworm.mp4",
    "enchanted_ruins.mp4",
    "enchanted_tree.mp4",
    "epic-black-hole-witness.mp4",
    "epic-frozen-aurora.mp4",
    "epic-galaxy-spiral.mp4",
    "epic-golden-ring-portal.mp4",
    "epic-golden-vortex.mp4",
    "epic-milkyway-trees.mp4",
    "epic-ronin-autumn-path.mp4",
    "epic-samurai-cloud-sea.mp4",
    "epic-samurai-maple-rest.mp4",
    "epic-samurai-moon-med.mp4",
    "epic-samurai-spider-lily.mp4",
    "epic-space-float-blue.mp4",
    "epic-space-float-crimson.mp4",
    "epic-space-float-gold.mp4",
    "epic-storm-cliff.mp4",
    "epic-temple-gate-night.mp4",
    "epic-wanderer-bridge.mp4",
    "epic-warrior-valley.mp4",
    "fairy_forest.mp4",
    "fallen_knight.mp4",
    "firefly_lake.mp4",
    "forest_challenger.mp4",
    "ghibli_meadow.mp4",
    "golden_orb.mp4",
    "golden_phoenix_rise.mp4",
    "hero_anime_rooftop.mp4",
    "hero_aurora_lake.mp4",
    "hero_batman_vigil.mp4",
    "hero_doom_sorcery.mp4",
    "hero_dragon_sunset.mp4",
    "hero_galaxy_drift.mp4",
    "hero_ironman_power.mp4",
    "hero_jellyfish_glow.mp4",
    "hero_koi_pond.mp4",
    "hero_neon_alley.mp4",
    "hero_neon_drive.mp4",
    "hero_sakura_meditation.mp4",
    "hero_scarlet_chaos.mp4",
    "hero_space_drift.mp4",
    "hero_spiderman_swing.mp4",
    "hero_strange_mandala.mp4",
    "hero_thor_summon.mp4",
    "hero_waterfall_mist.mp4",
    "hero_wolf_moon.mp4",
    "hologram_city.mp4",
    "interstellar_void.mp4",
    "katana_strike.mp4",
    "knights_rest.mp4",
    "lone_wolf.mp4",
    "lost_astronaut.mp4",
    "matrix_rain.mp4",
    "mech_warrior.mp4",
    "midnight_drive.mp4",
    "midnight_lambo.mp4",
    "monsoon_forest.mp4",
    "mountain_gt.mp4",
    "mountain_storm.mp4",
    "neon_rain.mp4",
    "nihilist-penguin-reference.mp4",
    "nihilist_penguin.mp4",
    "ocean_abyss.mp4",
    "ocean_train.mp4",
    "penguin-dark-shore.mp4",
    "penguin-ice-cliff-edge.mp4",
    "penguin-mountain-walk.mp4",
    "penguin-snowfall-walk.mp4",
    "penguin-sunset-ice.mp4",
    "phoenix_flight.mp4",
    "phoenix_rise.mp4",
    "rain_porsche.mp4",
    "red_field_ronin.mp4",
    "rooftop_sunset.mp4",
    "sakura_koi_night.mp4",
    "sakura_temple.mp4",
    "sakura_walk.mp4",
    "samurai-crow-blood-moon.mp4",
    "samurai_bridge_duel.mp4",
    "samurai_crimson.mp4",
    "samurai_horseback.mp4",
    "samurai_moonlit.mp4",
    "samurai_reflection.mp4",
    "samurai_ronin.mp4",
    "samurai_shadow.mp4",
    "saturn_rings.mp4",
    "sh-dark-knight-vigil.mp4",
    "sh-doom-sorcery-power.mp4",
    "sh-infinity-gauntlet-power.mp4",
    "sh-iron-repulsor-blast.mp4",
    "sh-mystic-portal-open.mp4",
    "sh-scarlet-chaos-magic.mp4",
    "sh-solar-flight-power.mp4",
    "sh-speed-force-run.mp4",
    "sh-thunder-god-power.mp4",
    "sh-web-swing-night.mp4",
    "sh_cap_rain.mp4",
    "sh_dark_knight_vigil.mp4",
    "sh_doom_power.mp4",
    "sh_ghost_ride.mp4",
    "sh_green_power.mp4",
    "sh_green_smash.mp4",
    "sh_iron_flight.mp4",
    "sh_ironman_flight.mp4",
    "sh_ironman_reactor.mp4",
    "sh_phoenix_ascend.mp4",
    "sh_scarlet_speed.mp4",
    "sh_sorcerer_portal.mp4",
    "sh_strange_mirror.mp4",
    "sh_strange_portal.mp4",
    "sh_thor_bifrost.mp4",
    "sh_thor_lightning.mp4",
    "sh_thunder_strike.mp4",
    "sh_web_swing.mp4",
    "shadow_assassin.mp4",
    "solar_flare.mp4",
    "spartan_stand.mp4",
    "starfall_night.mp4",
    "temple_guardian.mp4",
    "thunder_strike.mp4",
    "tokyo_drift.mp4",
    "tron_grid.mp4",
    "viking_berserker.mp4",
    "volcanic_fury.mp4",
    "white_tiger_forest.mp4",
    "wormhole_transit.mp4",
  ].sort();
}

export default function FileManager() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [totalSize, setTotalSize] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "missing" | "tiny" | "ok">("all");

  // Migration state
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<Array<{ file: string; status: string; size?: number }>>([]);
  const [migrationProgress, setMigrationProgress] = useState({ done: 0, total: 0, skipped: 0, uploaded: 0, failed: 0 });
  const pauseRef = useRef(false);
  const [paused, setPaused] = useState(false);

  // Seed DB state
  const [seeding, setSeeding] = useState(false);
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [liveDbCount, setLiveDbCount] = useState<number | null>(null);

  // Thumbnail generator state
  const [thumbGenerating, setThumbGenerating] = useState(false);
  const [thumbMissing, setThumbMissing] = useState<Array<{ id: string; title: string; video_url: string }>>([]);
  const [thumbProgress, setThumbProgress] = useState({ done: 0, total: 0, success: 0, failed: 0 });
  const [thumbLog, setThumbLog] = useState<Array<{ title: string; status: string }>>([]);
  const thumbPauseRef = useRef(false);
  const [thumbPaused, setThumbPaused] = useState(false);

  // Check live DB count
  const checkLiveDbCount = useCallback(async () => {
    const { count } = await supabase.from("live_wallpapers").select("*", { count: "exact", head: true });
    setLiveDbCount(count || 0);
  }, []);

  // Seed all live wallpapers into DB (nukes existing first)
  const seedLiveDatabase = async () => {
    const files = getLocalLiveFiles();
    if (!confirm(`⚠️ This will DELETE all existing live wallpaper records, then INSERT ${files.length} fresh records with auto-categorization. Continue?`)) return;

    setSeeding(true);
    setSeedLog(["⏳ Preparing file list..."]);

    const fileData = files.map(f => ({
      filename: f,
      isPremium: false,
    }));

    setSeedLog(prev => [...prev, `📦 Sending ${fileData.length} files (nukes DB first, then inserts)...`]);

    try {
      const resp = await fetch(SEED_LIVE_URL, {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileData, nukeFirst: true }),
      });
      const data = await resp.json();

      if (data.error) {
        setSeedLog(prev => [...prev, `❌ Error: ${data.error}`]);
        toast.error("Seed failed: " + data.error);
      } else {
        setSeedLog(prev => [...prev, `🗑️ Old records deleted`]);
        setSeedLog(prev => [...prev, `✅ Inserted: ${data.inserted}`]);
        setSeedLog(prev => [...prev, `🔢 Verified DB count: ${data.dbCount}`]);
        if (data.errors) {
          data.errors.forEach((e: string) => setSeedLog(prev => [...prev, `⚠️ ${e}`]));
        }
        if (data.inserted !== data.dbCount) {
          setSeedLog(prev => [...prev, `❌ MISMATCH! Inserted ${data.inserted} but DB has ${data.dbCount}`]);
          toast.error(`Count mismatch: inserted ${data.inserted}, DB has ${data.dbCount}`);
        } else {
          setSeedLog(prev => [...prev, `🎉 Verified! ${data.dbCount} live wallpapers in DB ✅`]);
          toast.success(`Seeded & verified: ${data.dbCount} live wallpapers!`);
        }
        setLiveDbCount(data.dbCount);
      }
    } catch (err) {
      setSeedLog(prev => [...prev, `❌ Network error: ${String(err)}`]);
      toast.error("Seed failed: " + String(err));
    }

    setSeeding(false);
  };

  // Nuke all live wallpapers from DB
  const nukeLiveDb = async () => {
    if (!confirm("⚠️ DELETE ALL live wallpaper records from the database? This cannot be undone!")) return;
    setSeedLog(["🗑️ Deleting all live wallpapers..."]);

    const { error } = await supabase.from("live_wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      setSeedLog(prev => [...prev, `❌ Error: ${error.message}`]);
      toast.error("Failed to delete: " + error.message);
    } else {
      setSeedLog(prev => [...prev, "✅ All live wallpapers deleted!"]);
      toast.success("Live DB nuked!");
      checkLiveDbCount();
    }
  };

  const runAudit = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}?action=audit&type=live`, { headers: getHeaders() });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results || []);
      setSummary(data.summary || null);
      setTotalSize(data.totalSize || "");
      setTotal(data.total || 0);
    } catch (err) {
      toast.error("Audit failed: " + String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Batch check many files
  const batchCheckR2 = async (keys: string[], minSize = 10000): Promise<{ missing: string[]; existingCount: number }> => {
    const CHUNK = 100;
    const allMissing: string[] = [];
    let totalExisting = 0;

    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK);
      try {
        const resp = await fetch(`${API_BASE}?action=batch-check`, {
          method: "POST",
          headers: { ...getHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ keys: chunk, minSize }),
        });
        const data = await resp.json();
        allMissing.push(...(data.missing || chunk));
        totalExisting += data.existingCount || 0;
      } catch {
        allMissing.push(...chunk);
      }
      setMigrationLog([{ file: `⏳ Scanning R2...`, status: `${i + chunk.length}/${keys.length} checked` }]);
    }

    return { missing: allMissing, existingCount: totalExisting };
  };

  // Upload a blob to R2
  const uploadBlobToR2 = async (blob: Blob, r2Key: string, filename: string): Promise<{ success: boolean; size: number }> => {
    try {
      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("key", r2Key);

      const uploadResp = await fetch(`${API_BASE}?action=upload`, {
        method: "POST",
        headers: getHeaders(),
        body: formData,
      });
      const data = await uploadResp.json();
      return { success: !data.error, size: data.verifiedSize || blob.size };
    } catch {
      return { success: false, size: 0 };
    }
  };

  // MIGRATE LIVE — 20 concurrent uploads
  const migrateAllLive = async (skipExisting: boolean) => {
    const files = getLocalLiveFiles();
    const msg = skipExisting
      ? `Batch-check ${files.length} live files — upload only missing. Continue?`
      : `DELETE and re-upload ALL ${files.length} live files. Continue?`;
    if (!confirm(msg)) return;

    setMigrating(true);
    setPaused(false);
    pauseRef.current = false;
    setMigrationLog([]);
    const counters = { skipped: 0, uploaded: 0, failed: 0 };
    setMigrationProgress({ done: 0, total: files.length, skipped: 0, uploaded: 0, failed: 0 });

    let filesToUpload = files;

    if (skipExisting) {
      setMigrationLog([{ file: "⏳ Batch-checking all live files on R2...", status: "Scanning..." }]);
      const allKeys = files.map(f => `live/${f}`);
      const { missing, existingCount } = await batchCheckR2(allKeys, 1000000);
      const missingSet = new Set(missing);
      counters.skipped = existingCount;
      filesToUpload = files.filter(f => missingSet.has(`live/${f}`));
      setMigrationLog([{ file: `✅ Batch check done`, status: `${counters.skipped} on R2, ${filesToUpload.length} to upload` }]);
      setMigrationProgress({ done: counters.skipped, total: files.length, skipped: counters.skipped, uploaded: 0, failed: 0 });

      if (filesToUpload.length === 0) {
        toast.success(`All ${files.length} live files already on R2!`);
        setMigrating(false);
        return;
      }
    }

    const PARALLEL = 20;
    for (let i = 0; i < filesToUpload.length; i += PARALLEL) {
      while (pauseRef.current) await new Promise(r => setTimeout(r, 500));

      const batch = filesToUpload.slice(i, i + PARALLEL);
      await Promise.all(batch.map(async (filename) => {
        const r2Key = `live/${filename}`;
        const localPath = `/live-wallpapers/${filename}`;
        const addLog = (status: string, size?: number) => {
          setMigrationLog(prev => [{ file: filename, status, size }, ...prev]);
        };
        addLog("⬆️ Uploading...");
        try {
          const resp = await fetch(localPath);
          if (!resp.ok) { counters.failed++; addLog("❌ Local file not found"); return; }
          const blob = await resp.blob();
          if (blob.size < 1000) { counters.failed++; addLog("❌ File too small"); return; }
          const result = await uploadBlobToR2(blob, r2Key, filename);
          if (result.success) { counters.uploaded++; addLog(`✅ ${formatSize(result.size)}`, result.size); }
          else { counters.failed++; addLog("❌ Upload failed"); }
        } catch { counters.failed++; addLog("❌ Error"); }
      }));
      const processed = counters.skipped + counters.uploaded + counters.failed;
      setMigrationProgress({ done: processed, total: files.length, ...counters });
    }

    setMigrating(false);
    toast.success(`Live done! ${counters.skipped} skipped, ${counters.uploaded} uploaded, ${counters.failed} failed`);
    runAudit();
  };

  // ── Thumbnail Bulk Generator ──
  const checkThumbStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-thumbnails", {
        body: { action: "status" },
      });
      if (error) throw error;
      setThumbMissing(data.wallpapers || []);
      toast.success(`${data.missing} wallpapers need thumbnails`);
    } catch (err) {
      toast.error("Failed to check: " + String(err));
    }
  };

  const captureVideoFrame = (videoUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "auto";
      let resolved = false;
      const cleanup = () => { video.src = ""; video.load(); };
      const timeout = setTimeout(() => { if (!resolved) { resolved = true; cleanup(); resolve(null); } }, 15000);
      
      video.onloadeddata = () => {
        video.currentTime = 0.5;
      };
      video.onseeked = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(video.videoWidth, 480);
          canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
          const ctx = canvas.getContext("2d");
          if (!ctx) { cleanup(); resolve(null); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          const base64 = dataUrl.split(",")[1];
          cleanup();
          resolve(base64 || null);
        } catch { cleanup(); resolve(null); }
      };
      video.onerror = () => { if (!resolved) { resolved = true; clearTimeout(timeout); cleanup(); resolve(null); } };
      video.src = videoUrl;
      video.load();
    });
  };

  const generateAllThumbnails = async () => {
    if (thumbMissing.length === 0) {
      toast.error("Check status first to find wallpapers missing thumbnails");
      return;
    }
    setThumbGenerating(true);
    setThumbPaused(false);
    thumbPauseRef.current = false;
    setThumbLog([]);
    const counters = { success: 0, failed: 0 };
    setThumbProgress({ done: 0, total: thumbMissing.length, success: 0, failed: 0 });

    // Process 2 at a time (browser video decode is heavy)
    const PARALLEL = 2;
    for (let i = 0; i < thumbMissing.length; i += PARALLEL) {
      while (thumbPauseRef.current) await new Promise(r => setTimeout(r, 500));

      const batch = thumbMissing.slice(i, i + PARALLEL);
      await Promise.all(batch.map(async (wp) => {
        const addLog = (status: string) => setThumbLog(prev => [{ title: wp.title, status }, ...prev]);
        addLog("🎬 Loading video...");
        
        const base64 = await captureVideoFrame(wp.video_url);
        if (!base64) {
          counters.failed++;
          addLog("❌ Frame capture failed");
          return;
        }

        addLog("⬆️ Uploading thumbnail...");
        const { error } = await supabase.functions.invoke("generate-thumbnails", {
          body: { action: "upload", id: wp.id, imageData: base64 },
        });

        if (error) {
          counters.failed++;
          addLog("❌ Upload failed");
        } else {
          counters.success++;
          addLog("✅ Done");
        }
      }));

      const done = counters.success + counters.failed;
      setThumbProgress({ done, total: thumbMissing.length, ...counters });
    }

    setThumbGenerating(false);
    toast.success(`Thumbnails done! ${counters.success} generated, ${counters.failed} failed`);
  };

  const toggleThumbPause = () => {
    thumbPauseRef.current = !thumbPauseRef.current;
    setThumbPaused(!thumbPaused);
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(!paused);
  };

  const filtered = results.filter(r => filterStatus === "all" || r.status === filterStatus);
  const localLiveCount = getLocalLiveFiles().length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">R2 File Manager</h1>
        <p className="text-xs text-muted-foreground mb-4">
          Manage live wallpaper files on Cloudflare R2 • {localLiveCount} live videos
        </p>

        {/* ═══════════════════════════════════════════ */}
        {/* LIVE DATABASE SEED SECTION */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-secondary/30 rounded-xl p-4 mb-4 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold">Live Wallpapers — Database Seed</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {liveDbCount !== null ? `${liveDbCount} records in DB` : <button onClick={checkLiveDbCount} className="underline">Check count</button>}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Auto-categorize and insert all {localLiveCount} live wallpaper files into the live_wallpapers table. Nukes existing records first to prevent duplicates.
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={seedLiveDatabase} disabled={seeding || migrating} variant="default" size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Seed All {localLiveCount} to DB
            </Button>
            <Button onClick={nukeLiveDb} disabled={seeding || migrating} variant="outline" size="sm" className="text-destructive border-destructive/50">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Nuke Live DB (Delete All)
            </Button>
            <Button onClick={checkLiveDbCount} disabled={seeding} variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh Count
            </Button>
          </div>

          {/* Seed log */}
          {seedLog.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto bg-background/50 rounded-lg p-2 space-y-0.5">
              {seedLog.map((log, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* BULK THUMBNAIL GENERATOR */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-secondary/30 rounded-xl p-4 mb-4 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold">Bulk Thumbnail Generator</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {thumbMissing.length > 0 ? `${thumbMissing.length} missing` : "Check status first"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Loads each live wallpaper video in-browser, captures a frame at 0.5s, and uploads JPEG thumbnails to R2. Processes 2 at a time.
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={checkThumbStatus} disabled={thumbGenerating} variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Check Missing
            </Button>
            <Button onClick={generateAllThumbnails} disabled={thumbGenerating || thumbMissing.length === 0} variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
              Generate All ({thumbMissing.length})
            </Button>
            {thumbGenerating && (
              <Button onClick={toggleThumbPause} variant="outline" size="sm">
                {thumbPaused ? <Play className="w-3.5 h-3.5 mr-1" /> : <Pause className="w-3.5 h-3.5 mr-1" />}
                {thumbPaused ? "Resume" : "Pause"}
              </Button>
            )}
          </div>

          {/* Thumbnail progress */}
          {thumbProgress.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                <span className="font-bold">THUMBNAILS</span>
                <span>{thumbProgress.done} / {thumbProgress.total}</span>
                <span>({Math.round((thumbProgress.done / thumbProgress.total) * 100)}%)</span>
                {thumbProgress.success > 0 && <span className="text-green-400">✅ {thumbProgress.success}</span>}
                {thumbProgress.failed > 0 && <span className="text-destructive">❌ {thumbProgress.failed}</span>}
                {thumbPaused && <span className="text-yellow-500 font-medium">PAUSED</span>}
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(thumbProgress.done / thumbProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Thumbnail log */}
          {thumbLog.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto bg-background/50 rounded-lg p-2 space-y-0.5">
              {thumbLog.slice(0, 60).map((log, i) => (
                <div key={`${log.title}-${i}`} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0">{log.status.startsWith("✅") ? "✅" : log.status.startsWith("❌") ? "❌" : "⏳"}</span>
                  <span className="font-mono truncate flex-1">{log.title}</span>
                  <span className="text-muted-foreground shrink-0">{log.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit button */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button onClick={runAudit} disabled={loading || migrating} variant="default" size="sm">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Audit Live (R2)
          </Button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="bg-secondary/50 rounded-xl p-4 mb-4 flex flex-wrap gap-4 items-center text-sm">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="font-medium">{total} files</span>
            </div>
            <span className="text-muted-foreground">{totalSize}</span>
            <span className="text-green-500">✅ {summary.ok} OK</span>
            {summary.tiny > 0 && <span className="text-yellow-500">⚠️ {summary.tiny} tiny</span>}
            {summary.missing > 0 && <span className="text-destructive">❌ {summary.missing} missing</span>}
          </div>
        )}

        {/* === LIVE WALLPAPER MIGRATION === */}
        <div className="bg-secondary/30 rounded-xl p-4 mb-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold">Live Wallpapers → R2</h2>
            <span className="text-xs text-muted-foreground ml-auto">{localLiveCount} files • 20 concurrent</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Upload live video wallpapers from <code>public/live-wallpapers/</code> to R2. Resume-capable — skips files already on R2.
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => migrateAllLive(true)} disabled={migrating} variant="default" size="sm">
              <Rocket className="w-3.5 h-3.5 mr-1.5" />
              Upload Missing Only
            </Button>
            <Button onClick={() => migrateAllLive(false)} disabled={migrating} variant="outline" size="sm" className="text-destructive border-destructive/50">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete & Re-Upload All
            </Button>
          </div>
        </div>

        {/* Pause button + Migration progress */}
        {migrating && (
          <div className="mb-4">
            <Button onClick={togglePause} variant="outline" size="sm" className="mb-2">
              {paused ? <Play className="w-3.5 h-3.5 mr-1" /> : <Pause className="w-3.5 h-3.5 mr-1" />}
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
        )}

        {migrationProgress.total > 0 && (
          <div className="mb-4 bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
              <span className="font-bold">LIVE MIGRATION</span>
              <span>{migrationProgress.done} / {migrationProgress.total}</span>
              <span>({Math.round((migrationProgress.done / migrationProgress.total) * 100)}%)</span>
              {migrationProgress.skipped > 0 && <span className="text-blue-400">⏭️ {migrationProgress.skipped} skipped</span>}
              {migrationProgress.uploaded > 0 && <span className="text-green-400">✅ {migrationProgress.uploaded} uploaded</span>}
              {migrationProgress.failed > 0 && <span className="text-destructive">❌ {migrationProgress.failed} failed</span>}
              {paused && <span className="text-yellow-500 font-medium">PAUSED</span>}
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(migrationProgress.done / migrationProgress.total) * 100}%` }}
              />
            </div>

            {/* Migration log */}
            {migrationLog.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto bg-background/50 rounded-lg p-2 space-y-0.5">
                {migrationLog.slice(0, 80).map((log, i) => (
                  <div key={`${log.file}-${i}`} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0">{log.status.startsWith("✅") ? "✅" : log.status.startsWith("⏭") ? "⏭️" : log.status.startsWith("❌") ? "❌" : "⏳"}</span>
                    <span className="font-mono truncate flex-1">{log.file}</span>
                    <span className="text-muted-foreground shrink-0">{log.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter tabs */}
        {results.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["all", "missing", "tiny", "ok"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterStatus === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                {f === "all" && `All (${results.length})`}
                {f === "missing" && `Missing (${results.filter(r => r.status === "missing").length})`}
                {f === "tiny" && `Tiny (${results.filter(r => r.status === "tiny").length})`}
                {f === "ok" && `OK (${results.filter(r => r.status === "ok").length})`}
              </button>
            ))}
          </div>
        )}

        {/* Manual upload area */}
        <div className="mb-4 border-2 border-dashed border-muted rounded-xl p-6 text-center">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">
            Manual upload to: <code className="text-primary font-bold">live/</code>
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Select up to <strong>40 files</strong> at once • 20 concurrent uploads
          </p>
          <input
            type="file"
            multiple
            accept="video/mp4"
            className="hidden"
            id="file-upload"
            onChange={async (e) => {
              if (!e.target.files?.length) return;
              if (e.target.files.length > 40) {
                toast.error("Max 40 files at once!");
                return;
              }
              const fileArr = Array.from(e.target.files);
              for (let i = 0; i < fileArr.length; i += 20) {
                const batch = fileArr.slice(i, i + 20);
                await Promise.all(batch.map(async (file) => {
                  const key = `live/${file.name}`;
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("key", key);
                    await fetch(`${API_BASE}?action=upload`, {
                      method: "POST",
                      headers: getHeaders(),
                      body: formData,
                    });
                  } catch {}
                }));
              }
              toast.success(`${fileArr.length} files uploaded!`);
              e.target.value = "";
            }}
          />
          <label htmlFor="file-upload">
            <Button asChild size="sm"><span>Choose Files (up to 40)</span></Button>
          </label>
        </div>

        {/* Results list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Checking files against R2...
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground mb-2">
              Showing {filtered.length} of {results.length}
            </div>
            {filtered.map(r => (
              <div
                key={r.name}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  r.status === "missing" ? "bg-destructive/10 border border-destructive/20" :
                  r.status === "tiny" ? "bg-yellow-500/10 border border-yellow-500/20" :
                  "bg-secondary/20"
                }`}
              >
                {r.status === "missing" ? (
                  <X className="w-3.5 h-3.5 text-destructive shrink-0" />
                ) : r.status === "tiny" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}
                <span className="font-mono text-xs truncate flex-1">{r.name}</span>
                <span className={`text-xs font-medium shrink-0 ${
                  r.status === "missing" ? "text-destructive" :
                  r.status === "tiny" ? "text-yellow-500" :
                  "text-green-500"
                }`}>
                  {r.status === "missing" ? "MISSING" : formatSize(r.size)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
