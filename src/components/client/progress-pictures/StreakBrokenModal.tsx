import { useState } from "react";
import { Flame, Sparkles, Check, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type BrokenStreakCheck,
  decrementStreakRevives,
  dismissBrokenStreakNotice,
  readStreakRevives,
} from "@/lib/progress-pictures";

type ModalStep = "initial" | "revived" | "zero_prompt" | "hal_message";

export function StreakBrokenModal({
  clientId,
  brokenInfo,
  onResolved,
}: {
  clientId: string;
  brokenInfo: BrokenStreakCheck;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<ModalStep>("initial");
  const [revivesLeft, setRevivesLeft] = useState(() => readStreakRevives(clientId));
  const [isAnimating, setIsAnimating] = useState(false);

  const handleReviveClick = () => {
    if (revivesLeft <= 0) {
      setStep("zero_prompt");
      return;
    }

    setIsAnimating(true);
    // Smooth transition: decrement revives and illuminate icon
    setTimeout(() => {
      const nextCount = decrementStreakRevives(clientId);
      setRevivesLeft(nextCount);
      setStep("revived");
      setIsAnimating(false);
    }, 450);
  };

  const handleClose = () => {
    dismissBrokenStreakNotice(clientId, brokenInfo.eventId);
    setOpen(false);
    onResolved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md text-center p-6 bg-[#0d0d0d] border border-border">
        {step === "initial" && (
          <div className="space-y-6">
            <DialogHeader className="space-y-1.5 text-center">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Progress Picture Streak Broken
              </DialogTitle>
              <DialogDescription className="text-[0.9375rem] text-muted-foreground">
                You missed yesterday&apos;s daily picture upload window.
              </DialogDescription>
            </DialogHeader>

            {/* Fire Icon Container with Top-Left Streak Count Badge */}
            <div className="flex justify-center py-2">
              <div className="relative inline-flex items-center justify-center p-4">
                {/* Top-Left Streak Badge */}
                <span className="absolute -top-1 -left-1 flex h-8 min-w-8 items-center justify-center rounded-full border border-border bg-card px-2 text-xs font-bold tabular-nums text-foreground shadow-sm">
                  {brokenInfo.previousStreak}
                </span>

                {/* Gray Fire Icon */}
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border/80 bg-black/40">
                  <Flame className="h-14 w-14 fill-zinc-600/40 text-zinc-500" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            {/* Revive Action Area */}
            <div className="space-y-3 pt-1">
              {!isAnimating && (
                <Button
                  type="button"
                  onClick={handleReviveClick}
                  className="min-h-12 w-full rounded-xl bg-primary text-[1rem] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Revive Streak
                </Button>
              )}

              <p
                className={`text-[0.875rem] font-medium transition-all duration-300 ${
                  isAnimating ? "text-primary text-[1rem] font-semibold" : "text-muted-foreground"
                }`}
              >
                {revivesLeft > 0
                  ? `Only ${revivesLeft} revives left this month`
                  : "0 revives left this month"}
              </p>
            </div>
          </div>
        )}

        {step === "revived" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <DialogHeader className="space-y-1.5 text-center">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Streak Revived!
              </DialogTitle>
              <DialogDescription className="text-[0.9375rem] text-muted-foreground">
                Your {brokenInfo.previousStreak}-day progress picture streak continues.
              </DialogDescription>
            </DialogHeader>

            {/* Glowing Red Fire Icon with Badge */}
            <div className="flex justify-center py-2">
              <div className="relative inline-flex items-center justify-center p-4">
                <span className="absolute -top-1 -left-1 flex h-8 min-w-8 items-center justify-center rounded-full border border-[#E50910]/40 bg-[#E50910]/20 px-2 text-xs font-bold tabular-nums text-[#E50910] shadow-sm">
                  {brokenInfo.previousStreak}
                </span>

                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-[#E50910]/40 bg-[#E50910]/10 shadow-[0_0_24px_rgba(229,9,16,0.25)]">
                  <Flame className="h-14 w-14 fill-[#E50910] text-[#E50910] animate-pulse" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <p className="text-[0.875rem] font-medium text-muted-foreground">
                Only {revivesLeft} {revivesLeft === 1 ? "revive" : "revives"} left this month
              </p>
              <Button
                type="button"
                onClick={handleClose}
                className="min-h-12 w-full rounded-xl bg-primary text-[1rem] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Check className="mr-2 h-5 w-5" />
                Continue to Dashboard
              </Button>
            </div>
          </div>
        )}

        {step === "zero_prompt" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="text-lg font-bold text-foreground">
                Streak Revives
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-black/40 p-5">
              <p className="text-[1.0625rem] font-medium leading-relaxed text-foreground">
                You ran out of streak revives for this month, but....
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setStep("hal_message")}
              className="min-h-12 w-full rounded-xl bg-primary text-[1rem] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              But?
            </Button>
          </div>
        )}

        {step === "hal_message" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <DialogHeader className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                From Your Coach
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border border-primary/30 bg-[#141414] p-5 text-left shadow-sm">
              <p className="text-[1.0625rem] italic leading-relaxed text-white/90">
                &ldquo;streaks are not everything. Your consistency over time is all that matters.
                Best wishes.&rdquo;
              </p>
              <div className="mt-4 text-right">
                <span className="text-[1rem] font-bold tracking-wide text-primary">— Hal</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleClose}
              className="min-h-12 w-full rounded-xl bg-primary text-[1rem] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Got it, Hal
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
