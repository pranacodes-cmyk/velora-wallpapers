import { useEffect, useRef, useState } from "react";
import film from "@/assets/paywall/welcome.mp4.asset.json";
import browserFilm from "@/assets/paywall/welcome.webm.asset.json";
import poster from "@/assets/paywall/welcome.jpg.asset.json";
import { toAbsoluteAssetUrl } from "@/utils/assetUrl";

export function PaywallWelcomeFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(reduced.matches);
      if (!video.current) return;
      if (document.hidden || reduced.matches) video.current.pause();
      else void video.current.play().catch((error: DOMException) => {
        if (error.name === "NotSupportedError") setFailed(true);
      });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, [reducedMotion]);
  return failed || reducedMotion
    ? <img src={toAbsoluteAssetUrl(poster.url)} alt="Jesus welcoming a child at heaven's gates" className="paywall-film-media" />
    : <video ref={video} poster={toAbsoluteAssetUrl(poster.url)} autoPlay muted loop playsInline preload="auto" onError={() => setFailed(true)} className="paywall-film-media" aria-label="Jesus welcomes and embraces a child at heaven's gates">
        <source src={toAbsoluteAssetUrl(browserFilm.url)} type="video/webm" />
        <source src={toAbsoluteAssetUrl(film.url)} type="video/mp4" />
      </video>;
}