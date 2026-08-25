import { Link, Outlet, useNavigate, useRouterState, useRouter } from "@tanstack/react-router";
import { ClipboardList, History, LayoutDashboard, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useAccount } from "@/components/account/AccountProvider";
import { SettingsMenu } from "@/components/account/SettingsMenu";
import { ChatButton } from "@/components/chat/ChatButton";
import { finalizeExpiredPausedWorkouts } from "@/lib/paused-workouts";
import { cn } from "@/lib/utils";

type ClientNavItem = {
  to: "/client/dashboard" | "/client/program" | "/client/workout-history";
  label: string;
  icon: LucideIcon;
};

const CLIENT_NAV_ITEMS: ClientNavItem[] = [
  { to: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/client/program", label: "Your Program", icon: ClipboardList },
  { to: "/client/workout-history", label: "Workout History", icon: History },
];

export function ClientShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { account, loading } = useAccount();

  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (account?.role === "client" && !account.approvedAt) {
      void navigate({ to: "/onboarding", replace: true });
    } else if (account?.role !== "client") {
      void navigate({ to: "/access", replace: true });
    }
  }, [account, loading, navigate]);

  useEffect(() => {
    if (loading || account?.role !== "client" || !account.approvedAt) return;
    // Paused workouts from a previous day are finalized into history automatically.
    void finalizeExpiredPausedWorkouts(account.id);
  }, [account, loading]);

  useEffect(() => {
    if (loading || account?.role !== "client" || !account.approvedAt) return;
    const id = window.setTimeout(async () => {
      try {
        const { preloadClientRoutes, warmStaticCache } = await import("@/lib/route-preloader");
        await warmStaticCache();
        await preloadClientRoutes(router);
      } catch {}
      try {
        // From any client page, preload all other client bottom-nav destinations
        const allClientDestinations = [
          "/client/dashboard",
          "/client/program",
          "/client/workout-history",
          "/client/chat",
          "/client/progress-pictures",
        ] as const;
        for (const to of allClientDestinations) {
          if (to !== pathname) {
            // @ts-ignore - some routes have params but preload without params is okay for code-split
            await router.preloadRoute({ to }).catch(() => {});
          }
        }
      } catch {}
    }, 350);
    return () => window.clearTimeout(id);
  }, [account, loading, router, pathname]);

  if (loading || account?.role !== "client" || !account.approvedAt) {
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
            {account.isPreview && (
              <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Client Preview
              </span>
            )}
            <ChatButton />
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
        aria-label="Client sections"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex w-full max-w-3xl items-stretch">
          {CLIENT_NAV_ITEMS.map((item) => {
            const active =
              item.to === "/client/dashboard"
                ? pathname === item.to || pathname.startsWith("/client/progress-pictures")
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
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
