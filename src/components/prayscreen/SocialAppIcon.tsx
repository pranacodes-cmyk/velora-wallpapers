import instagram from "@/assets/social/instagram.svg";
import tiktok from "@/assets/social/tiktok.svg";
import youtube from "@/assets/social/youtube.svg";
import facebook from "@/assets/social/facebook.svg";
import snapchat from "@/assets/social/snapchat.svg";
import x from "@/assets/social/x.svg";

const iconById: Record<string, string> = {
  instagram,
  tiktok,
  youtube,
  facebook,
  snapchat,
  x,
  "com.instagram.android": instagram,
  "com.zhiliaoapp.musically": tiktok,
  "com.google.android.youtube": youtube,
  "com.facebook.katana": facebook,
  "com.snapchat.android": snapchat,
  "com.twitter.android": x,
};

export function SocialAppIcon({ id, name, size = "md" }: { id: string; name: string; size?: "sm" | "md" | "lg" }) {
  const icon = iconById[id.toLowerCase()] ?? iconById[id];
  const dimensions = size === "lg" ? "h-14 w-14 rounded-2xl" : size === "sm" ? "h-9 w-9 rounded-[11px]" : "h-11 w-11 rounded-[13px]";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden ${icon ? "" : "border border-border/70 bg-secondary p-2"} ${dimensions}`}>
      {icon ? <img src={icon} alt="" className="h-full w-full object-contain" /> : <span className="text-[11px] font-black text-foreground">{name.slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}