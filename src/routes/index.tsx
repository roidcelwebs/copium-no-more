import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAccount } from "@/components/account/AccountProvider";
import { AccountAccess } from "@/components/account/AccountAccess";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "No More Copium — Prototype" },
      {
        name: "description",
        content: "No More Copium Local Prototype Mode.",
      },
      { property: "og:title", content: "No More Copium" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RootEntryPage,
});

function RootEntryPage() {
  const navigate = useNavigate();
  const { account, loading } = useAccount();

  useEffect(() => {
    if (loading || !account) return;
    if (account.role === "coach") {
      void navigate({ to: "/coach/dashboard", replace: true });
    } else if (account.role === "payment_manager") {
      void navigate({ to: "/payment/dashboard", replace: true });
    } else if (account.approvedAt) {
      void navigate({ to: "/client/dashboard", replace: true });
    } else {
      void navigate({ to: "/onboarding", replace: true });
    }
  }, [account, loading, navigate]);

  if (loading) {
    return <main className="min-h-[100dvh] bg-[#080808]" />;
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">No More Copium</h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
          Local Prototype · Instant Coach & Client Access
        </p>
        <div className="mt-6">
          <AccountAccess />
        </div>
      </div>
    </main>
  );
}
