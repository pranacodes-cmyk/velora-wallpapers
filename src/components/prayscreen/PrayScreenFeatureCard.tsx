import { Shield, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

export function PrayScreenFeatureCard() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <div className="px-3 pb-4">
      <Button
        variant="ghost"
        onClick={() => { haptic("soft"); navigate("/prayscreen"); }}
        className="h-auto w-full justify-start gap-3.5 whitespace-normal rounded-lg border border-border bg-card p-4 text-left hover:bg-muted"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-foreground">{t("premium.benefit.shield.title")}</span>
          <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">{t("ps.tagline")}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
    </div>
  );
}