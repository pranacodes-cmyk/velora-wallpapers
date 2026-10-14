import lamp1 from "@/assets/challenge/lamp-1.webp";
import lamp2 from "@/assets/challenge/lamp-2.webp";
import lamp3 from "@/assets/challenge/lamp-3.webp";
import lamp4 from "@/assets/challenge/lamp-4.webp";
import lamp5 from "@/assets/challenge/lamp-5.webp";
import taskRead from "@/assets/challenge/task-read.webp";
import taskPray from "@/assets/challenge/task-pray.webp";
import taskLive from "@/assets/challenge/task-live.webp";
import taskReflect from "@/assets/challenge/task-reflect.webp";
import heroNight from "@/assets/challenge/hero-night.webp";
import heroDawn from "@/assets/challenge/hero-dawn.webp";
import circleFamily from "@/assets/challenge/circle-family.webp";
import type { TaskId } from "@/data/challenge75";

/**
 * Lamp art per tier. `wick` is the normalized wick tip (x, y) inside the
 * trimmed image, measured from the art, so the live flame sits exactly on it.
 * Flutter mirror: flutter_app/lib/screens/challenge/challenge_assets.dart.
 */
export const LAMPS = [
  { src: lamp1, w: 560, h: 299, wick: [0.961, 0.268] },
  { src: lamp2, w: 560, h: 298, wick: [0.954, 0.245] },
  { src: lamp3, w: 560, h: 326, wick: [0.953, 0.261] },
  { src: lamp4, w: 560, h: 300, wick: [0.97, 0.133] },
  { src: lamp5, w: 560, h: 437, wick: [0.985, 0.114] },
] as const;

export const TASK_ART: Record<TaskId, string> = {
  read: taskRead,
  pray: taskPray,
  live: taskLive,
  reflect: taskReflect,
};

export const HERO = { night: heroNight, dawn: heroDawn };
export const CIRCLE_ART = circleFamily;
