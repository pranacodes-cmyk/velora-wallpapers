import { BookOpen, HandHeart, Heart, PenLine } from "lucide-react";
import type { TaskId } from "@/data/challenge75";

/** One icon per daily step, shared by the hub, day screen, Home card and onboarding. */
export const TASK_ICON: Record<TaskId, typeof BookOpen> = { read: BookOpen, pray: HandHeart, live: Heart, reflect: PenLine };
