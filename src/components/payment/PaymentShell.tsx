import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Receipt, Send, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useAccount } from "@/components/account/AccountProvider";
import { SettingsMenu } from "@/components/account/SettingsMenu";
import { cn } from "@/lib/utils";

type PaymentNavItem = {
  to: "/payment/dashboard" | "/payment/payouts";
  label: string;
  icon: LucideIcon;
};

const PAYMENT_NAV_ITEMS: PaymentNavItem[] = [
  { to: "/payment/dashboard", label: "Payments", icon: Receipt },
  { to: "/payment/payouts", label: "Payouts", icon: Send },
];

export function PaymentShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { account, loading } = useAccount();

  useEffect(() => {
    if (loading) return;
    if (account?.role !== "payment_manager") {
      void navigate({ to: "/access", replace: true });
    }
  }, [account, loading, navigate]);

  if (loading || account?.role !== "payment_manager") {
    return <div className="min-h-[100dvh] bg-background" />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link to="/" className="text-base font-semibold tracking-tight">
            No More Copium
          </Link>
          <div className="flex items-center gap-1">
            <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Payment Manager
            </span>
            <SettingsMenu />
          </div>
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6"
        style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}
      >
        <Outlet />
      </main>
      <nav
        aria-label="Payment Manager sections"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex w-full max-w-3xl items-stretch">
          {PAYMENT_NAV_ITEMS.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 py-2.5 text-center text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active && "text-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} aria-hidden="true" />
                  <span className={cn("leading-none", active && "underline underline-offset-4")}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
