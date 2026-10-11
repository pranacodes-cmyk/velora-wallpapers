import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";

interface ReorderDialogProps {
  open: boolean;
  title: string;
  currentPos: number;
  onConfirm: (newPos: number) => void;
  onCancel: () => void;
}

export function ReorderDialog({ open, title, currentPos, onConfirm, onCancel }: ReorderDialogProps) {
  const { t } = useT();
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return;
    setValue("");
    onConfirm(n);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValue(""); onCancel(); } }}>
      <DialogContent className="max-w-[320px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{t("wp.reorder.moveTitle", { title })}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("wp.reorder.currentPos", { pos: currentPos })}</p>
        <Input
          type="number"
          min={1}
          placeholder={t("wp.reorder.newPosition")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setValue(""); onCancel(); }}>{t("wp.reorder.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit}>{t("wp.reorder.move")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
