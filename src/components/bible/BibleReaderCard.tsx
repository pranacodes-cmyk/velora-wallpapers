import { BookOpen, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export function BibleReaderCard() {
  const { t } = useT();
  const navigate = useNavigate();
  return <div className="mx-5 my-5 border-y border-border py-5"><Button variant="ghost" className="h-auto w-full justify-between gap-4 px-1 py-3" onClick={() => navigate("/bible")}><BookOpen className="h-8 w-8 text-primary" /><span className="flex-1 text-left text-lg font-semibold">{t("bible.read")}</span><ArrowUpRight className="h-5 w-5 text-primary" /></Button></div>;
}