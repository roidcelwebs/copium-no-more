import { createFileRoute } from "@tanstack/react-router";
import { AccessCodesPage } from "@/components/coach/AccessCodesPage";

export const Route = createFileRoute("/coach/access-codes")({
  head: () => ({
    meta: [
      { title: "Access Codes — No More Copium" },
      { name: "description", content: "Generate one-time access codes for clients." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessCodesPage,
});
