import { createFileRoute, redirect } from "@tanstack/react-router";
import { PaymentShell } from "@/components/payment/PaymentShell";

export const Route = createFileRoute("/payment")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/payment" || location.pathname === "/payment/") {
      throw redirect({ to: "/payment/dashboard" });
    }
  },
  component: PaymentShell,
});
