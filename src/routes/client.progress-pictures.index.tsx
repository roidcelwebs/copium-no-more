import { createFileRoute } from "@tanstack/react-router";
import { ProgressPicturesPage } from "@/components/client/progress-pictures/ProgressPicturesPage";

export const Route = createFileRoute("/client/progress-pictures/")({
  head: () => ({
    meta: [
      { title: "Progress Pictures — No More Copium" },
      { name: "description", content: "Review and organize your progress pictures." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProgressPicturesPage,
});
