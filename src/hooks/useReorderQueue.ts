import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReorderJob {
  id: string;
  title: string;
  position: number;
  table: "live" | "static";
}

/**
 * Serializes reorder operations so they execute one at a time.
 * Prevents race conditions where concurrent calls cancel each other.
 */
export function useReorderQueue(onComplete?: () => void) {
  const queueRef = useRef<ReorderJob[]>([]);
  const processingRef = useRef(false);

  const processNext = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;

    const job = queueRef.current.shift()!;
    try {
      const { data, error } = await supabase.functions.invoke("rank-live-wallpapers", {
        body: { rankings: [{ id: job.id, position: job.position }], table: job.table },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`"${job.title}" → #${job.position}`, { duration: 1500 });
    } catch (err: any) {
      toast.error(`Failed: ${err?.message || "Unknown error"}`);
    } finally {
      processingRef.current = false;
      if (queueRef.current.length > 0) {
        processNext();
      } else {
        onComplete?.();
      }
    }
  }, [onComplete]);

  const enqueue = useCallback((job: ReorderJob) => {
    // If same item already queued, update its position instead of duplicating
    const existing = queueRef.current.findIndex(j => j.id === job.id);
    if (existing >= 0) {
      queueRef.current[existing] = job;
    } else {
      queueRef.current.push(job);
    }
    processNext();
  }, [processNext]);

  const pending = useCallback(() => queueRef.current.length + (processingRef.current ? 1 : 0), []);

  return { enqueue, pending };
}
