import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAccount } from "./AccountProvider";

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { account, signOut } = useAccount();

  const leaveAccount = async () => {
    await signOut();
    setOpen(false);
    void navigate({ to: "/access", replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open settings" className="shrink-0">
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-sm bg-[#0d0d0d] border border-border text-left">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-lg font-bold text-foreground">Account & Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Profile Info Section */}
          {account && (
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-black/40 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1rem] font-semibold text-foreground">
                  {account.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{account.username}
                  <span className="text-white/40 ml-1.5">
                    · {account.role === "coach" ? "Coach" : account.role === "payment_manager" ? "Payment Manager" : "Client"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          <Button
            variant="ghost"
            className="min-h-12 w-full justify-start gap-2.5 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void leaveAccount()}
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span className="text-[0.9375rem] font-medium">Sign out</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
