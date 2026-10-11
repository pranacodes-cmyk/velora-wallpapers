import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeAppLogs, clearAppLogs, type AppLogEntry } from "@/services/app-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function DebugLogs() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AppLogEntry[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => subscribeAppLogs(setEntries), []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        (e.context ?? "").toLowerCase().includes(q) ||
        e.level.includes(q),
    );
  }, [entries, filter]);

  const formatted = useMemo(
    () =>
      filtered
        .map((e) => {
          const t = new Date(e.timestamp).toISOString().split("T")[1]?.replace("Z", "");
          return `[${t}] [${e.level.toUpperCase()}] ${e.message}${e.context ? ` ${e.context}` : ""}`;
        })
        .join("\n"),
    [filtered],
  );

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      toast.success("Logs copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-semibold">Debug logs</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} of {entries.length} entries</p>
        </div>
        <Button variant="ghost" size="icon" onClick={copyAll} title="Copy all">
          <Copy className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => clearAppLogs()} title="Clear">
          <Trash2 className="w-5 h-5" />
        </Button>
      </header>

      <div className="px-4 py-2 border-b border-border">
        <Input
          placeholder="Filter (e.g. PaywallPrices)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          {["PaywallPrices", "RevenueCat", "error", "warn"].map((q) => (
            <button
              key={q}
              onClick={() => setFilter(q)}
              className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40"
            >
              {q}
            </button>
          ))}
          <button
            onClick={() => setFilter("")}
            className="text-xs px-2 py-1 rounded-full border border-border"
          >
            clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center mt-10">No log entries yet.</p>
        ) : (
          filtered
            .slice()
            .reverse()
            .map((e) => {
              const color =
                e.level === "error"
                  ? "text-red-400"
                  : e.level === "warn"
                  ? "text-yellow-400"
                  : e.level === "info"
                  ? "text-blue-300"
                  : "text-foreground/80";
              const t = new Date(e.timestamp).toLocaleTimeString();
              return (
                <div key={e.id} className="mb-2 border-b border-border/40 pb-2">
                  <div className={`${color}`}>
                    <span className="opacity-60">[{t}]</span>{" "}
                    <span className="uppercase">{e.level}</span> {e.message}
                  </div>
                  {e.context && (
                    <pre className="whitespace-pre-wrap break-all text-muted-foreground mt-1">
                      {e.context}
                    </pre>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
