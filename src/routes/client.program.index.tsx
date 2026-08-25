import { createFileRoute } from "@tanstack/react-router";
import { YourProgramPage } from "@/components/client/YourProgramPage";

export const Route = createFileRoute("/client/program/")({
  head: () => ({
    meta: [
      { title: "Your Program — No More Copium" },
      { name: "description", content: "Review your assigned training program." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: YourProgramPage,
});
