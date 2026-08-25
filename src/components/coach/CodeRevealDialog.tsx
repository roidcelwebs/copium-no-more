import { Copy, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAccessCode } from "@/lib/access-codes";

/**
 * Shows a freshly generated access code exactly once (plaintext is never
 * retrievable again). Used by the Access Codes page and Client Management.
 */
export function CodeRevealDialog({
  code,
  note,
  onClose,
}: {
  code: string;
  note: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatAccessCode(code));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-[1.25rem] font-semibold tracking-tight text-foreground">
            Access code ready
          </DialogTitle>
          <DialogDescription className="text-[1rem] leading-6 text-muted-foreground">
            {note ? `${note} — ` : ""}send this to your client. It works once and
            expires soon.
          </DialogDescription>
        </DialogHeader>

        <div className="my-5 flex items-center justify-center rounded-xl border border-white/10 bg-[#080808] px-4 py-6">
          <p
            className="font-mono text-[clamp(1.4rem,7vw,2rem)] font-semibold tracking-[0.08em] text-white"
            aria-label={`Access code ${formatAccessCode(code)}`}
          >
            {formatAccessCode(code)}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[1rem] leading-6 text-muted-foreground">
            This code is shown only once. It expires in 72 hours (or the expiry
            you chose) and stops working the moment it is used.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => void copy()}
              className="min-h-12 flex-1 rounded-xl text-[1rem] font-semibold"
            >
              <Copy className="mr-2 h-5 w-5" aria-hidden="true" />
              {copied ? "Copied" : "Copy code"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-12 flex-1 rounded-xl text-[1rem] font-semibold"
            >
              <X className="mr-2 h-5 w-5" aria-hidden="true" />
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
