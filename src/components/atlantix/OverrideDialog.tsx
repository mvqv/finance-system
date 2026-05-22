import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function OverrideDialog({
  open,
  onOpenChange,
  action,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  action: "approve" | "reject";
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" strokeWidth={1.6} />
            Protocol Override Required
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are about to {action === "approve" ? "APPROVE" : "REJECT"} this idea outside the standard protocol
            (Risk verdict or status conflicts). This action will be logged as an override violation in the audit trail.
          </p>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Reason (required)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you are overriding the standard protocol…"
              className="mt-1 min-h-[120px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={action === "approve" ? "default" : "destructive"}
            disabled={reason.trim().length < 10 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onOpenChange(false);
                setReason("");
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm {action === "approve" ? "Override Approve" : "Override Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
