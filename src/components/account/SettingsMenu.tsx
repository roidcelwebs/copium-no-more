import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAccount } from "./AccountProvider";

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { account, signOut } = useAccount();

  const switchAccount = () => {
    setOpen(false);
    void navigate({ to: "/access", replace: true });
  };

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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings & Account</DialogTitle>
          {account && (
            <DialogDescription>
              {account.name} · @{account.username}
              {account.role === "coach"
                ? " · Coach"
                : account.role === "payment_manager"
                  ? " · Payment Manager"
                  : " · Client"}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={switchAccount}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Switch account / role
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10"
            onClick={() => void leaveAccount()}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
