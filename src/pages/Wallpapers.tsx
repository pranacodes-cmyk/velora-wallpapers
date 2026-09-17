import { useEffect, useState } from "react";
import LiveFeed from "@/pages/LiveFeed";
import StaticWallpapers from "@/pages/StaticWallpapers";
import BothFeed from "@/pages/BothFeed";
import { WallpaperModePill, type WallpaperMode } from "@/components/WallpaperModePill";

const STORAGE_KEY = "wallpapers.mode.v1";

function readStoredMode(): WallpaperMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "live" || v === "photos" || v === "both") return v;
  } catch {}
  return "live";
}

interface Props {
  initialMode?: WallpaperMode;
}

export default function Wallpapers({ initialMode }: Props = {}) {
  const [mode, setMode] = useState<WallpaperMode>(() => initialMode ?? readStoredMode());

  // Keep storage in sync.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [mode]);

  const pill = <WallpaperModePill mode={mode} onChange={setMode} />;

  if (mode === "photos") return <StaticWallpapers modeControl={pill} />;
  if (mode === "both") return <BothFeed modeControl={pill} />;
  return <LiveFeed modeControl={pill} />;
}
