import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
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

  const leaveAccount = async () => {
    await signOut();
    setOpen(false);
    void navigate({ to: "/", replace: true });
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
          <DialogTitle>Settings</DialogTitle>
          {account && (
            <DialogDescription>
              {account.name} · @{account.username}
              {account.role === "coach" ? " · Coach" : " · Client"}
            </DialogDescription>
          )}
        </DialogHeader>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => void leaveAccount()}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </DialogContent>
    </Dialog>
  );
}
