import { createFileRoute } from "@tanstack/react-router";
import { PaymentDashboard } from "@/components/payment/PaymentDashboard";

export const Route = createFileRoute("/payment/dashboard")({
  head: () => ({
    meta: [
      { title: "Payments — No More Copium" },
      {
        name: "description",
        content: "Track client payments and the developer's balance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentDashboard,
});
