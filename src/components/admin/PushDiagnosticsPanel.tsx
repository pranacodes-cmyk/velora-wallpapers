import { useCallback, useEffect, useState } from "react";
import ContentPush, { type PushDiagnostics, type ContentPushKind } from "@/plugins/content-push";
import { toast } from "sonner";

const KINDS: ContentPushKind[] = ["verse", "quiz", "companion", "journey"];

function importanceLabel(v?: number): string {
  switch (v) {
    case 0: return "NONE (blocked)";
    case 1: return "MIN";
    case 2: return "LOW";
    case 3: return "DEFAULT";
    case 4: return "HIGH (heads-up)";
    case 5: return "MAX";
    default: return `unknown (${v})`;
  }
}

export default function PushDiagnosticsPanel({ autoRun = false }: { autoRun?: boolean }) {
  const [data, setData] = useState<PushDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const d = await ContentPush.diagnostics();
      setData(d);
      console.log("[PushDiagnostics]", d);
    } catch (e: any) {
      toast.error(`Diagnostics failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (autoRun) void run();
  }, [autoRun, run]);

  const fire = async (k: ContentPushKind) => {
    try {
      await ContentPush.preview({ kind: k });
      toast.success(`Fired ${k} — check tray within ~1s`);
    } catch (e: any) {
      toast.error(`Fire ${k} failed: ${e?.message ?? e}`);
    }
  };

  const reschedule = async () => {
    try {
      const r = await ContentPush.enable();
      toast.success(`Re-armed ${r.scheduled} alarms`);
      run();
    } catch (e: any) {
      toast.error(`Enable failed: ${e?.message ?? e}`);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 mb-4 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Notification Diagnostics</h3>
        <button
          onClick={run}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50"
        >
          {busy ? "…" : "Run"}
        </button>
      </div>

      {!data && (
        <p className="text-muted-foreground text-[11px]">
          Tap Run to read live state from Android: permissions, channel importance, scheduled times, and the on-device build tag.
        </p>
      )}

      {data && (
        <div className="space-y-3">
          <div className="rounded-lg bg-background/50 p-3 space-y-1">
            <Row label="Build tag (on device)" value={data.buildTag} accent />
            <Row label="Device" value={`${data.manufacturer} ${data.model} · SDK ${data.sdkInt}`} />
            <Row label="Notifications enabled" value={data.notificationsEnabled} bad={!data.notificationsEnabled} />
            <Row label="POST_NOTIFICATIONS granted" value={data.postNotificationsGranted} bad={!data.postNotificationsGranted} />
            <Row label="Can schedule exact alarms" value={data.canScheduleExactAlarms} bad={!data.canScheduleExactAlarms} />
            <Row label="Ignoring battery optim." value={data.ignoringBatteryOptimizations} />
            <Row label="Enabled pref" value={data.enabledPref} bad={!data.enabledPref} />
            <Row label="Daily cap count" value={`${data.dailyCapCount} / 4`} bad={data.dailyCapCount >= 4} />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Channels</div>
            <div className="space-y-1">
              {data.channels.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded bg-background/50 px-2 py-1">
                  <span className="font-mono text-[10px]">{c.id}</span>
                  <span className={c.blocked || !c.exists ? "text-red-400" : "text-emerald-400"}>
                    {c.exists ? importanceLabel(c.importance) : "MISSING"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Next scheduled</div>
            <div className="space-y-1">
              {data.nextSlots.map((s) => (
                <div key={s.kind} className="flex items-center justify-between rounded bg-background/50 px-2 py-1">
                  <span>{s.kind} · {String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")}</span>
                  <span className={s.alarmArmed ? "text-emerald-400" : "text-red-400"}>
                    {s.alarmArmed ? `armed · ${s.nextHuman}` : "NOT ARMED"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button onClick={reschedule} className="px-2.5 py-1.5 rounded-lg bg-secondary text-foreground text-[11px]">
              Re-arm all
            </button>
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => fire(k)}
                className="px-2.5 py-1.5 rounded-lg bg-secondary text-foreground text-[11px]"
              >
                Fire {k}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bad, accent }: { label: string; value: React.ReactNode; bad?: boolean; accent?: boolean }) {
  const v = typeof value === "boolean" ? (value ? "yes" : "no") : value;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={
        accent ? "font-mono text-[10px] text-primary" :
        bad ? "text-red-400 font-medium" : "text-foreground font-medium"
      }>{v}</span>
    </div>
  );
}
