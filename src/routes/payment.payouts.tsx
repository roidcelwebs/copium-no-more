import { createFileRoute } from "@tanstack/react-router";
import { PayoutsPage } from "@/components/payment/PayoutsPage";

export const Route = createFileRoute("/payment/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — No More Copium" },
      {
        name: "description",
        content: "Submit and track payouts to the developer.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayoutsPage,
});
