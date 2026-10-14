import lamb from "@/assets/journey/avatars/lamb.webp";
import dove from "@/assets/journey/avatars/dove.webp";
import lion from "@/assets/journey/avatars/lion.webp";
import star from "@/assets/journey/avatars/star.webp";
import whale from "@/assets/journey/avatars/whale.webp";
import olive from "@/assets/journey/avatars/olive.webp";
import lantern from "@/assets/journey/avatars/lantern.webp";
import bear from "@/assets/journey/avatars/bear.webp";
import turtle from "@/assets/journey/avatars/turtle.webp";
import rabbit from "@/assets/journey/avatars/rabbit.webp";
import bird from "@/assets/journey/avatars/bird.webp";
import cloud from "@/assets/journey/avatars/cloud.webp";
import { cn } from "@/lib/utils";

// Preserve the existing wire identifiers; only their visual presentation changes.
const portraits: Record<string, string> = {
  "🐑": lamb, "🕊️": dove, "🦁": lion, "⭐": star,
  "🌊": whale, "🌿": olive, "🔥": lantern, "🌻": bear,
  "⛰️": turtle, "🌸": rabbit, "🌙": bird, "☀️": cloud,
};

export function JourneyAvatar({ avatar, className, label = "" }: {
  avatar: string; className?: string; label?: string;
}) {
  return <img src={portraits[avatar] ?? lamb} alt={label} width={256} height={256}
    loading="lazy" draggable={false}
    className={cn("aspect-square h-full w-full shrink-0 rounded-full object-cover", className)} />;
}