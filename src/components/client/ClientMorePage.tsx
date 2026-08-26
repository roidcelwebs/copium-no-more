import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  History,
  ScanFace,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ClientMorePage() {
  const navigate = useNavigate();
  const [faceModalOpen, setFaceModalOpen] = useState(false);

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-[1.375rem] font-bold tracking-tight text-foreground">More</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          Additional services, workout logs, and specialized analysis.
        </p>
      </div>

      {/* Navigation Cards Stack */}
      <div className="grid gap-3">
        {/* 1. Workout History Card */}
        <Link
          to="/client/workout-history"
          className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <History className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[1.0625rem] font-semibold text-foreground">Workout History</h2>
              <p className="mt-0.5 text-[0.875rem] leading-5 text-muted-foreground">
                Review past workout sessions and performance logs
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>

        {/* 2. Get Your Face Analysis Card */}
        <button
          type="button"
          onClick={() => setFaceModalOpen(true)}
          className="group flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ScanFace className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[1.0625rem] font-semibold text-foreground">
                Get Your Face Analysis
              </h2>
              <p className="mt-0.5 text-[0.875rem] leading-5 font-medium text-muted-foreground">
                No AI used, Human analyzed rating
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </button>
      </div>

      {/* Face Analysis Details Modal */}
      <Dialog open={faceModalOpen} onOpenChange={setFaceModalOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md p-6 bg-[#0d0d0d] border border-border text-left">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Get Your Face Analysis
              </DialogTitle>
            </div>
            <DialogDescription className="text-[0.9375rem] font-medium text-primary">
              No AI used, Human analyzed rating
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
            <div className="rounded-xl border border-border bg-black/40 p-4 space-y-2.5">
              <div className="flex items-start gap-2.5 text-foreground font-medium">
                <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>100% Hand-Analyzed by Hal</span>
              </div>
              <p className="text-xs text-muted-foreground pl-7.5">
                Comprehensive assessment of your facial harmony, bone structure, eye area, jawline, and dimorphism. Zero automated AI slop.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-black/40 p-4 space-y-2.5">
              <div className="flex items-start gap-2.5 text-foreground font-medium">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Personalized Actionable Protocol</span>
              </div>
              <p className="text-xs text-muted-foreground pl-7.5">
                Direct feedback on soft and hard-tissue improvements, styling, and bodyfat optimization tailored to your facial structure.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              onClick={() => {
                setFaceModalOpen(false);
                void navigate({ to: "/client/chat" });
              }}
              className="min-h-12 w-full rounded-xl bg-primary text-[1rem] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Request in Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
