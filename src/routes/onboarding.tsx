import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAccount } from "@/components/account/AccountProvider";
import { ClientOnboardingScreen } from "@/components/chat/ClientOnboardingScreen";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — No More Copium" },
      { name: "description", content: "Chat with your coach and wait for approval." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { account, loading } = useAccount();

  useEffect(() => {
    if (loading) return;
    if (!account) {
      void navigate({ to: "/access", replace: true });
    } else if (account.role === "coach") {
      void navigate({ to: "/coach/dashboard", replace: true });
    } else if (account.role === "payment_manager") {
      void navigate({ to: "/payment/dashboard", replace: true });
    } else if (account.approvedAt) {
      void navigate({ to: "/client/dashboard", replace: true });
    }
  }, [account, loading, navigate]);

  if (
    loading ||
    !account ||
    account.role === "coach" ||
    account.role === "payment_manager" ||
    account.approvedAt
  ) {
    return <main className="min-h-[100dvh] bg-background" aria-label="Opening onboarding" />;
  }

  return <ClientOnboardingScreen account={account} />;
}
