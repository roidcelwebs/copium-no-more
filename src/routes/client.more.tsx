import { createFileRoute } from "@tanstack/react-router";
import { ClientMorePage } from "@/components/client/ClientMorePage";

export const Route = createFileRoute("/client/more")({
  head: () => ({
    meta: [
      { title: "More — No More Copium" },
      { name: "description", content: "Additional services, workout history, and specialized tools." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientMorePage,
});
